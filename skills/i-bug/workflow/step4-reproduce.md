# 步骤四：复现与精确定位 执行指导

## 输入信息

**必须入参**：
- `investigation.md`（含 `reproducible` 标志、第一现场、根因类型）
- 代码库（Read/Grep/Glob 访问）

## 目标要求

**任务**：产出精确因果链「当 X 时，因为 Y，导致 Z」，有代码/日志交叉验证
**目标**：根因陈述完整、可追溯、可验证；不在本步骤生成修复代码

**特性要求**：
- 因果链三段必须完整：输入条件（When）、内部原因（Why）、外部表现（What）
- 必须有原文交叉验证（代码片段 or 日志原文），不接受纯推理
- 若偶现，必须有可复现的方式（压测/日志快照），不接受"应该是并发问题"

## 工作依据

### 必现 Bug 的定位方法

**原则：追问直到找到数据来源**

报错行 → 该行的变量从哪来 → 上一个赋值处 → ... → 数据的真正来源（DB 查询 / 第三方返回 / 入参）

```typescript
// 示例追溯路径：
// 1. 报错行：order.service.ts:87 → user.id 访问 undefined 的 .id
// 2. user 来自哪？→ 第 70 行 userDao.findOne({ where: { id: userId } })
// 3. findOne 什么时候返回 null？→ 当 userId 对应的用户不存在时
// 4. 根因：Service 未对 findOne 的 null 返回做守卫
```

**逐行读上下文而非只看报错行**：定位到文件:行号后，往上读 20-30 行，理解：
- 这个函数的入参是什么
- 在到达报错行之前，数据经历了哪些变换

**当需要在本地复现验证时**（比如需要特定数据库数据、特定环境变量才能触发）：

> 🔍 **需要你确认**：请在本地执行以下操作后告知结果，或把输出粘贴过来：
> - 启动 dev server（按照项目 README / AGENTS.md 的指引）
> - 构造触发条件：[Agent 在此描述具体的触发步骤]
> - 观察到的结果是否与生产一致？

### 偶现 Bug 的特殊方法论（假设-验证循环）

**三步让偶现变必现**：

```
步骤 1：建立假设树
  根据已有线索（错误类型 + 触发频率 + 并发特征），列出 3-5 个候选假设
  优先级：Node.js TOCTOU/共享变量 > DB 事务隔离 > 特定数据组合

步骤 2：针对最高优先级假设设计压测
  使用 autocannon/k6，固定触发参数，提高并发度
  目标：在本地 50-200 并发下稳定触发问题

步骤 3：从中间状态日志破局
  当问题触发时，通过 correlation ID 串联完整链路
  找到"读到了错误中间值"的那一步 → 根因确认
```

**Node.js 偶现 Bug 最高频的三种形态**（优先排查）：

```typescript
// 形态一：模块级共享变量（最常见）
const cache = new Map(); // ← 危险！多个请求共享这一个 Map

// 形态二：async/await 之间的 TOCTOU
const val = await db.read(key); // 读
// ← 这里另一个请求修改了 DB
await db.write(key, val + 1);   // 写（丢失了其他请求的修改！）

// 形态三：read-modify-write 不在同一事务
const row = await db.select('... WHERE id=$1', [id]);   // T1 读
// ← T2 也读了，得到同样的值
await db.update('... SET val=$1 WHERE id=$2', [newVal, id]); // T1 写，T2 的写覆盖了 T1！
```

**并发压测**：

Agent 会设计压测命令，需要你在本地执行后把结果粘贴回来：

> 🔍 **需要你执行**：请在本地启动 dev server 后，运行以下命令（如果没有 autocannon，可用 `npm install -g autocannon` 安装，或告诉我你们项目用什么压测工具，我来换命令）。
>
> ```bash
> npx autocannon \
>   -c 50 \
>   -d 30 \
>   --method POST \
>   --body '{"id": "test-42", "x": 100}' \
>   http://localhost:3000/api/your-endpoint
> ```
>
> 执行完把：① autocannon 的统计输出、② 同时段的应用日志 粘贴到这里。
> 我需要从日志中找到同一输入下产生不同结果的那对请求。

### 性能类 Bug 的查询分析

Agent 无法直接访问你的数据库，需要你执行后把结果粘贴回来：

> 🔍 **需要你提供**：请在你的数据库客户端执行以下命令，并把完整输出粘贴到这里。
>
> ```sql
> -- PostgreSQL
> EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
> SELECT ... FROM your_table WHERE ...;
>
> -- MySQL
> EXPLAIN SELECT ... FROM your_table WHERE ...;
> ```
>
> 同时，如果 ORM 有查询日志功能，请临时开启后执行一次请求，把打印的 SQL 语句也粘贴过来。

我会从输出中识别：
- `Seq Scan`（全表扫描）→ 索引缺失
- 行数 >> LIMIT → 大 OFFSET 问题
- 重复出现的同类 SQL → N+1 问题

## 产出格式

在 `investigation.md` 中追加：

```markdown
## 精确根因陈述

**因果链**：
- **当**（输入条件）：用户提交表单，且该商品品类在 DB 中无 active 促销记录
- **因为**（内部原因）：`order.service.ts:80` 调用 `getActiveDiscount()` 后未做 null 守卫，直接访问 `discount.rate`
- **导致**（表现）：`TypeError: Cannot read properties of null (reading 'rate')`，接口返回 500

**交叉验证**：
- `src/services/promotion.service.ts:32`：`getActiveDiscount` 返回类型明确为 `Promise<Discount | null>`，调用方未处理 null 分支
- 本地复现：删除 DB 中对应 categoryId 的 promotion 记录后，100% 必现 500

**（若偶现）压测/日志证据**：
- 50 并发压测命令：`npx autocannon -c 50 -d 30 --body '...' http://localhost:3000/api/calc`
- 错误率：~5%，与生产观测一致
- traceId `calc_xxx` 的中间状态日志显示 `cacheHit: false` 且两个请求同时读到 `baseValue: 100`，最终一个写入被覆盖
```

## 根因校验门禁（步骤结束前自检）

在进入步骤五前，逐项核对：

- [ ] 因果链包含 When / Why / What 三段
- [ ] 有代码片段或日志原文至少一处交叉验证
- [ ] 若偶现，有压测复现或中间状态日志证明假设成立
- [ ] 根因指向数据来源/设计决策，不只是报错行号
- [ ] 未在本步骤编写任何修复代码

**任何一项未满足 → 回到本步骤补充证据，禁止进入步骤五。**
