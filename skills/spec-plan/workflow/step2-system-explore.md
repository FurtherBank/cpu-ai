# 阶段二：系统探索 执行指导

## 输入信息

**必须入参**：
- 阶段一条款索引表 — 驱动定向搜索，避免随机翻代码
- 目标仓库路径 or AGENTS.md — 确认搜索范围边界

**上下文参考**：
- 若存在 OpenAPI 文档/swagger/ER 图，按需查阅（可大幅减少探索工作量）

## 目标要求

**任务**：通过数据/接口/鉴权/实现范式四轨系统性探索，产出当前系统现状的客观摘要

**目标**：所有闭包完成信号均达成；摘要只写「现在是什么」，不写 gap 结论或变更建议

**特性要求**：
- 三条基础闭包完成信号（路由闭包 / 数据模型闭包 / 鉴权矩阵闭包）均有明确的达成描述或「未闭合风险：原因」
- 鉴权矩阵覆盖全部已枚举接口（无「忘记检查」空白行）
- 数据模型来自 migration/entity 双轨验证（标注来源文件）
- 已知盲区显式列出，不假装已全部探索
- **若条款索引表中存在「实现设计类=是」的条款，必须执行实现范式轨，产出实现范式摘要**

## 工作依据

### 三条闭包完成信号定义

**路由闭包**：已枚举「声明式路由注册入口」+ 若存在动态注册则已追到注册表或约定目录

**数据模型闭包**：已列出所有与规范相关概念（从条款索引表中的领域概念列表提取）对应的表与关键字段，并标注来源文件

**鉴权矩阵闭包**：对每个已枚举的 HTTP 入口，有一条记录（有鉴权 / 无鉴权 / 继承 / 未知）

**辅助停机信号**：「连续 10 个文件/15 分钟没有发现新的路由注册模式或新表名」可作为停机参考，不依赖主观感觉

---

### 数据轨（DB/模型）

**核心原则**：以 migration 为结构真值，entity 为读写路径线索；两者冲突时以 migration 为准

**搜索词**：`CREATE TABLE`、`@Entity`、`@Table`、`migration`、`schema`、`.prisma`、`TypeORM`

**查阅目录**：`**/migrations/**`、`**/migration/**`、`**/entity/**`、`**/model/**`

**产出**：表清单（表名 / 关键字段 / 来源文件 / 是否与规范概念相关）

**异常处理**：
- 若 entity 与 migration 不一致 → 在摘要中标注冲突点，以 migration 为准
- 若只有 sync 无 migration 文件 → 整个数据模型闭包置信度降一档，并在「已知盲区」章节记录

---

### 接口轨（路由/接口）

**核心原则**：从「路由注册的根」出发，而非搜路由字符串——前者不会漏，后者会漏动态拼接

**操作步骤**：
1. 找主程序入口（`main.ts`/`bootstrap`/`app.ts`）中的路由挂载调用
2. 沿 import 图展开，列出所有路由模块
3. 对每个路由文件：记录 method + path + handler 名

**搜索词**：`registerRoutes`、`app.use`、`@Controller`、`prefix`、`Router`、`route(`

**动态路由专项搜索**：`require.context`、`import.meta.glob`、`fs.readdir`、`@Get`、`@Post`、`RequestMapping`

**两轨验证**：
- 轨A（静态声明）：从路由文件导出路径模式
- 轨B（符号交叉）：搜 handler 函数名是否被多处注册，搜字符串字面量 `'/api` / `"/v1`
- 两轨求并集；只在轨B出现的条目标「中/低置信」

---

### 鉴权轨（鉴权矩阵）

**核心原则**：不用读懂业务逻辑，只判断「这个 handler 是否有鉴权门」

**对每个接口**，检查：
- 是否调用了鉴权 helper 函数（`requireUser`、`assertAuth`、`checkToken` 等）
- 是否有鉴权装饰器（`@Auth`、`@UseGuards`、`@Guard`）
- 是否在父类/全局 filter 中统一处理（继承型）
- 是否在白名单配置中（匿名可访问）

**搜索词**：`auth`、`authorize`、`jwt`、`bearer`、`session`、`cookie`、`middleware`、`guard`、`interceptor`、`whitelist`、`skipAuth`、`anonymous`

**鉴权矩阵格式**：

| 接口路径 | Method | 鉴权状态 | 鉴权方式 | 置信度 | 备注 |
|---|---|---|---|---|---|
| /openapi/xxx | GET | 有 | AuthService.check | 高 | 直接调用 |
| /internal/yyy | POST | 无 | — | 高 | 白名单配置 |
| /api/zzz | PUT | 未知 | — | 低 | 动态 filter，未完全展开 |

---

---

### 实现范式轨（条件轨道）

**触发条件**：条款索引表中存在「实现设计类=是」的条款

**核心原则**：为「新建类变更」找到具体的实现约定，使变更清单可以给出精确引用而非「参考现有实现」。

**对每个「实现设计类=是」的条款，执行以下探索**：

**探索目标 1：同类实现的目录结构与基类约定**

对规范中要求「新建 agent / 新建 service / 新建 processor」的条款：
- 找到目标目录（如 `src/agentic/agent/` 或 `src/modules/`）
- 列出目录下现有文件清单
- 选取一个最相关的现有实现文件，探索：
  - 类定义行（`class X extends Y`）→ 记录基类路径 + 基类名
  - 必须实现的接口方法（`abstract` 方法 / interface 定义）→ 记录方法签名
  - 运行/调用方式（谁调用这个 agent/service，怎么调用）→ 记录调用签名

```bash
# 查找目录结构
ls -la apps/server/src/agentic/agent/

# 查找基类定义
rg "abstract class|class.*extends|implements.*Agent" apps/server/src/agentic/ --type ts -l

# 查找调用方式
rg "new.*Agent\|runAgent\|agentRunner" apps/server/src/agentic/ --type ts
```

**探索目标 2：workflow 插入点（条件）**

若规范要求「在某个已有流程的特定节点触发某操作」：
- 找到对应 workflow 文件（如 `pro-mode.ts`）
- 阅读完整 workflow 执行链（关注 async 函数的串联调用顺序）
- 确定插入点：在哪个函数调用之后/之前
- 确定触发条件：基于 workflow context，哪些字段可以判断触发条件

```bash
# 找 workflow 文件
rg "pro-mode\|workflow" apps/server/src/agentic/planner/ --type ts -l

# 阅读完整执行链
# (直接 Read 对应文件，不能用 grep 片段替代，否则会漏掉执行顺序关系)
```

**实现范式摘要格式**：

```markdown
### 实现范式摘要

#### [条款 ID] - [条款描述]

**目标目录**：`apps/server/src/agentic/agent/weavefox-vibe/`

**现有实现参照**：`apps/server/src/agentic/agent/weavefox-vibe/some-agent.ts`

**基类/接口**：
- 继承：`BaseVibeAgent`（`src/agentic/agent/base-vibe-agent.ts`）
- 必须实现方法：`execute(context: AgentContext): Promise<AgentResult>`

**调用方式**：
```typescript
// 调用签名（来源：src/agentic/runner/agent-runner.ts）
agentRunner.run(new SomeAgent(chatId), { context })
```

**workflow 插入点**（若适用）：
- 文件：`src/agentic/planner/workflow/pro-mode.ts`
- 插入位置：`sendDingcardMessage` 调用之后（第 N 行）
- 触发条件：`context.chatInfo?.app_setting?.someFlag === true`
- 判断「有服务端代码变更」：`context.generatedFiles?.some(f => f.path.startsWith('server/'))`
```

---

### 现有概念与规范命名重叠的处理

若在系统中发现与规范条款中的概念名相同或相近的词（如系统已有 `tenant_id` 而规范也有「租户」），必须产出「术语映射表」：

| 规范术语 | 代码中出现的词 | 语义是否一致 | 说明 |
|---|---|---|---|
| 开放平台租户 | `tenant_id`（resource 表）| **否** | 当前是组织分组，非开放平台概念 |
| 个人 token | `api_key`（user_api_key 表）| 部分 | 缺 `type` 字段区分三类 token |

## 产出格式

```markdown
## 当前系统状态摘要

### 路由架构
（框架名称、全局 filter 有无、路由组织方式、入口文件路径）

### 接口全景
- 总接口数量：N
- 按模块分布：（表格）
- 动态路由：（是否存在、目录约定）

### 鉴权矩阵
（见上方鉴权矩阵格式）

### 数据模型
（受规范条款影响的表清单）

| 表名 | 关键字段 | 来源文件 | 相关规范概念 |
|---|---|---|---|

### 实现范式摘要（条件，若存在「实现设计类=是」条款）

（见上方「实现范式轨」的摘要格式）

### 已知盲区
- （动态路由/无迁移/第三方 IdP 等未能充分探索的区域）

---

## 闭包完成信号

- **路由闭包**：[达成 / 未闭合：原因]
- **数据模型闭包**：[达成 / 未闭合：原因]
- **鉴权矩阵闭包**：[达成 / 未闭合：原因]
- **实现范式闭包**（条件）：[达成：已产出实现范式摘要 / 不适用：无「实现设计类=是」条款]

---

## 术语映射表（条件，若规范词与代码词重叠）

（见上方术语映射表格式）
```
