---
name: chair2-api-structure
description: chair2 项目后端分层架构规范，包含 Router / Controller / Service / DAO 四层的职责边界与禁止事项。编写或审查后端接口代码（controller、service、repository、dao 等文件）时应遵守其中规则。
---

# Node.js 企业级后端分层架构与实战指南

在企业级的 Node.js 后端开发中，尤其是面对成百上千个接口的复杂项目，**“高内聚、低耦合”**是核心原则。为了避免代码退化为难以维护的“面条代码”，业界通常采用**经典的分层架构（N-Tier Architecture）**。

本指南将详细梳理标准的四层架构及其职责边界，并结合“为现有接口增加分页与关键字查询”的实战案例，手把手教你如何优雅地进行代码迭代。

---

## 第一部分：标准的四层架构与职责边界

对于一个特定的接口，从 HTTP 请求打到应用，再到最底层查询数据库并返回，标准的水平分层通常包含以下 4 个核心层：

### 1. 路由层 (Router Layer)

- **管什么：** 负责将特定的 HTTP 方法（GET/POST 等）和 URL 路径，映射（分发）到对应的控制器函数上。挂载“路由级别”的中间件（如鉴权拦截、接口限流）。
- **不管什么：** 绝对不涉及参数的具体解析，不涉及任何业务判断，不抛出业务异常。
- **新人避坑：** 不要在这个文件里写任何 `if-else`。它就是一个纯粹的“指路牌”。

### 2. 控制层 / 接入层 (Controller Layer)

- **管什么：** 负责“对外的 HTTP 协议”与“对内的纯 Node.js 代码”的翻译工作。
  1.  **参数接收与校验：** 从 `req.query/body/params` 提取参数，进行格式校验（如必填项、类型检查）。
  2.  **调用服务：** 将校验好的纯数据对象（DTO）传递给下层的 Service。
  3.  **统一响应：** 拿到 Service 的结果后，包装成统一的 JSON 格式（如 `{ code: 0, data: {...}, msg: 'success' }`）并处理 HTTP 状态码。
- **不管什么：** 绝对不要写核心业务逻辑！不要写 SQL 语句！不要调用第三方业务 API。
- **新人避坑：** 绝对不允许将 `req` 和 `res` 对象传给下层的 Service！Service 层应当是感知不到 HTTP 的存在的。

### 3. 业务服务层 (Service Layer) —— 核心！

- **管什么：** 承载该接口的所有**业务规则和逻辑**。
  1.  **业务校验：** 比如“检查该用户是否已被拉黑”、“库存是否充足”。
  2.  **逻辑编排：** 调用多个下层的数据访问方法（DAO），或调用其他的 Service。
  3.  **事务控制：** 开启和提交数据库事务。
- **不管什么：** 不管网络协议（HTTP），不管请求头，不管底层数据库是 MySQL 还是 MongoDB（不写原生 SQL）。
- **新人避坑：** 这一层的代码应该是纯粹的 JS/TS 函数。哪怕以后项目改用 RPC 调用，这部分代码也应该能原封不动地被复用。

### 4. 数据访问层 (DAO / Repository Layer)

- **管什么：** 负责和底层数据源打交道。执行 SQL、调用 ORM 方法、读写 Redis 缓存。
- **不管什么：** 不涉及业务逻辑。它只是一台无情的“数据读写机器”。
- **新人避坑：** 方法命名应该是面向数据的（如 `findUserById`），而不是面向业务的（如 `checkUserLogin`）。

---

## 第二部分：实战改造 —— 增加分页与关键字查询

**需求背景：**
假设我们有一个老接口 `GET /api/v1/users`，原本是全量查出所有用户列表。
现在前端需求变更：**“列表太长了，需要加入分页（`page`, `pageSize`），并且支持按用户昵称模糊搜索（`keyword`）。”**

**架构迭代黄金法则：从外向内，按需穿透。**

下面我们一层层来看如何用 `diff` 的方式改造代码：

### 1. 路由层 (Router) - 无需修改

接口的 URL 路径和 HTTP 方法完全没有变化，依然是 `GET /api/v1/users`。
路由层**完全不管参数长什么样**，所以直接跳过，零修改。

### 2. 控制层 (Controller) - 增加参数提取与格式校验

Controller 层需要知道前端传来了新参数。我们需要在这里提取它们，做基本的类型转换和默认值处理，然后塞给 Service。

```diff
  export class UserController {
      static async getUserList(req: Request, res: Response) {
-         // 老逻辑：没有参数
-         const users = await UserService.getUsers();
-
-         return res.json({ code: 0, data: users });

+         // 新逻辑：提取查询参数并给定默认值
+         const page = parseInt(req.query.page as string) || 1;
+         const pageSize = parseInt(req.query.pageSize as string) || 10;
+         const keyword = (req.query.keyword as string) || '';
+
+         // 简单的格式校验（比如 page 不能为负数）
+         if (page < 1 || pageSize < 1) {
+             return res.status(400).json({ code: 400, msg: '分页参数错误' });
+         }
+
+         // 将纯净的数据传入 Service 层
+         const result = await UserService.getUsers({ page, pageSize, keyword });
+
+         // 返回带分页结构的数据
+         return res.json({
+             code: 0,
+             data: {
+                 list: result.items,
+                 total: result.total
+             }
+         });
      }
  }
```

### 3. 服务层 (Service) - 调整入参结构与返回结构

Service 层的职责是编排逻辑。由于分页不仅需要“当前页的数据”，还需要“总条数”，所以这里我们要调用两次 DAO（一次查列表，一次查总数），并将结果组合返回。

```diff
  export class UserService {
-     // 老逻辑：无参，返回数组
-     static async getUsers() {
-         const items = await UserRepository.findAll();
-         return items;
-     }

+     // 新逻辑：接收 DTO 对象，返回包含总数的复杂对象
+     static async getUsers(params: { page: number; pageSize: number; keyword: string }) {
+         // 可以在这里做一些业务校验，例如：非超管最多只能查前100页
+         if (params.page > 100) {
+             throw new BusinessError('超出最大查询范围');
+         }
+
+         // 编排底层数据访问：并行请求数据列表和总条数
+         const [items, total] = await Promise.all([
+             UserRepository.findList(params),
+             UserRepository.countTotal(params.keyword)
+         ]);
+
+         // 组合结果返回给 Controller
+         return { items, total };
+     }
  }
```

### 4. 数据访问层 (DAO) - 拼接 SQL 与分页条件

这是最底层，所有的参数终于要变成真正的数据库查询语句了。计算 `OFFSET`，拼接 `LIKE` 和 `LIMIT`。

```diff
  export class UserRepository {
-     // 老逻辑：无脑全表扫描
-     static async findAll() {
-         const rows = await db.query('SELECT id, name, email FROM users ORDER BY created_at DESC');
-         return rows;
-     }

+     // 新逻辑 1：查询分页数据列表
+     static async findList(params: { page: number; pageSize: number; keyword: string }) {
+         const offset = (params.page - 1) * params.pageSize;
+         const limit = params.pageSize;
+
+         let sql = 'SELECT id, name, email FROM users';
+         const values: any[] = [];
+
+         // 如果有关键字，拼接 WHERE 条件
+         if (params.keyword) {
+             sql += ' WHERE name LIKE ?';
+             values.push(`%${params.keyword}%`);
+         }
+
+         sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
+         values.push(limit, offset);
+
+         return await db.query(sql, values);
+     }
+
+     // 新逻辑 2：查询符合条件的总条数（分页必备）
+     static async countTotal(keyword: string): Promise<number> {
+         let sql = 'SELECT COUNT(*) as total FROM users';
+         const values: any[] = [];
+
+         if (keyword) {
+             sql += ' WHERE name LIKE ?';
+             values.push(`%${keyword}%`);
+         }
+
+         const rows = await db.query(sql, values);
+         return rows[0].total;
+     }
  }
```

---

## 总结寄语

当你接手任何一个新的接口需求或迭代任务时，**请不要急着敲代码**，先在脑海中完成以下三步思考：

1.  **入参是什么？出参格式是什么？** —— 把它写在 Controller 层。
2.  **核心业务规则是什么？要调哪些底层方法？** —— 把它写在 Service 层。
3.  **最终落地到数据库的语句该怎么写？** —— 把它写在 DAO 层。

坚持这种清晰的边界感，你的代码将具备极高的可读性、可测试性和可维护性。这也是成为高级服务工程师的必经之路！
