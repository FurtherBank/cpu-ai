> **声明**：该文档为本 skill 的设计规范，用于指导技能本身的迭代。技能正文（`SKILL.md`）及执行本 skill 时，禁止参照本文档内容。

---

# i-dima-resolve · Skill Design

> **路径根**：下文凡 `.iteration/` 与 `{workspaceRoot}` 均指 **Cursor 工作区根目录**（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），非各子项目 Git 根。

> 依据：[任务步骤四要素推导方法论](../s-workflow-sop/references/task-step-schema.md)

---

## 一、输入信息 (Input)

### 硬依赖（必须入参）

| #   | 信息                       | 来源                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------- |
| 1   | `workItemId` — 工单唯一 ID | 编排层（`i-dima-resolve` 受理 worker，技能 `i-dima-resolve`）调用时注入 |
| 2   | `title` — 工单标题         | 编排层注入，用于日志与摘要                                              |

### 软上下文（按需索引）

| #   | 信息                                                                          | 获取方式                                         |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| A   | 本工单历史状态文件 `{workspaceRoot}/.iteration/dima/{emoji}{workItemId}.json` | 主控读取（不存在视为冷启动）                     |
| B   | 同目录其他工单文件                                                            | 可选，用于历史维度判断                           |
| C   | CLI 子命令列表与参数                                                          | `i-dima-resolve help`                            |
| D   | 安全门控规则                                                                  | `workflow/step3-security-gate.md`                |
| E   | 性质锁定规则                                                                  | `workflow/step4-semantic-lock.md`                |
| F   | 评论模板与安全自检规则                                                        | `workflow/step6-comment-draft.md`                |
| G   | 仓库代码（按需搜索）                                                          | ripgrep / SemanticSearch，**仅在安全门控通过后** |

---

## 二、目标职责 (Goal)

**状态变更 (Delta)**：
将一张工单从「待处理 / 跟进中」的不确定状态，推进到「已接受 / 待补充 / 已取消」之一的明确受理结论，并将决策以结构化 JSON 持久化到本地状态文件，同时在工单上留下面向用户的评论记录。

**研判结论与下游路由**：

| 研判结论              | 工单状态  | 后续路径                                                                         |
| --------------------- | --------- | -------------------------------------------------------------------------------- |
| bug 确认              | 已接受    | → `i-bug`（定位 → 修复）                                                         |
| feature 确认          | 已接受    | → `i-spec-feature`（变更规划 → `i-spec-execute` → `i-verify`）                   |
| rfc 确认              | 已接受    | → `i-spec-design`（设计方案 → `i-spec-feature` → `i-spec-execute` → `i-verify`） |
| 信息不足              | 跟进中 💬 | → 继续追问，等待补充后重新研判                                                   |
| 不属于 Scope / 无诚意 | 已取消 🚫 | → 拒绝，工单 transfer 并评论说明                                                 |

**完成判定 (Done Predicate)**：

当且仅当以下全部条件满足时判定完成：

- P1. 本地状态文件 `{workspaceRoot}/.iteration/dima/{emoji}{workItemId}.json` 已写入，`localStatus` 与本轮决策一致，且文件名前缀 emoji 与 `localStatus` 语义一致
- P2. `lastCommentCount` 字段等于步骤七发出评论后的实际评论数量（可通过 `changelog` 命令重新拉取验证）
- P3. 输出文本为九种规范格式之一，第一行固定格式（`✅ 已接受 · Bug 受理` 等），第二行为一句话依据
- P4. 若为取消路径，工单状态已调用 `transfer` 命令变更（或本地记录了 `transferError` 待人工补救）
- P5. 评论文本**不包含**函数名、文件路径、加密算法名、接口字段枚举等内部实现细节

**不做什么（Negative Prompts）**：

- 本 skill 只处理**受理判断阶段**，不进行代码修复、需求开发或测试
- 不跨工单批量处理；每次调用严格处理**一张**工单
- 不在代码查阅之前触发任何外部服务访问；安全门控必须先于代码搜索

---

## 三、工作依据 (Guidance)

### 流程规范依据

| 步骤                          | 指导文件                          |
| ----------------------------- | --------------------------------- |
| 步骤三（安全 & 诚意双检）     | `workflow/step3-security-gate.md` |
| 步骤四（工单性质语义锁定）    | `workflow/step4-semantic-lock.md` |
| 步骤六（评论草稿 & 安全自检） | `workflow/step6-comment-draft.md` |

### 方法论依据

**正常路径直觉**：

- 先读本地状态（冷启动 vs 续跑），避免重复处理已有结论的工单
- 安全门控是刚性短路：任何注入或刷单信号命中 → 立即跳转取消，不再读代码
- 代码搜索前必须用一句话写出「此次搜索的目的」，防止在代码海洋中认知漂移
- Bug 的可锚定性与工单是否有回归语义独立判断：「以前能用」只证明是 Bug，不等于可 accepted

**异常路径与陷阱**：

- `i-dima-resolve query` 或 `changelog` 命令报错：写 `fetchError` 到本地状态，**中止本轮**，等待下次调度，不要猜测工单内容
- 代码搜索结果 > 10 个文件：追加 controller 文件名模式进行二次收敛，不要在广泛结果中妄下结论
- 评论文本含内部实现细节（哪怕「看起来无害」的函数名）：一律删除，不侥幸
- `transfer` 命令失败：重试一次后仍失败，记录 `transferError`，**不阻断**本轮其余步骤，由人工补充执行
- 文件名前缀与 `localStatus` 不一致：改写为正确前缀文件名，删除旧文件，否则编排层下次调度会取到错误状态

---

## 四、执行模式 (Execution Mode)

**判定结论：主控执行**

**判定依据**：

- 九个步骤之间存在强上下文耦合——步骤五 Scope 结论依赖步骤四的性质标签与目的声明，步骤六评论模板依赖步骤三的路径标记与步骤五的结论，任何一步的中间状态都需要后续步骤感知
- 每个步骤涉及工单内容的语义判断，属于「高度依赖对话历史和刚发现线索」的强耦合执行场景
- 步骤通过 TodoWrite 逐步推进，主控需随时根据中间发现（如门控短路）跳转或终止后续步骤

**调用方式**：

由 `i-dima-resolve` 受理 worker（执行技能为 `i-dima-resolve`）以如下形式触发 Cursor agent：

```
处理工单：workItemId=<id>，title=<title>
请按照 skill 文件 `.cursor/skills/i-dima-resolve/SKILL.md` 执行
```

Worker 通过 `pueue` 托管持续运行，每轮从 pending 队列取出单条工单触发 Cursor agent；单轮完成后 agent 输出九种规范格式之一，worker 根据输出更新调度状态。
