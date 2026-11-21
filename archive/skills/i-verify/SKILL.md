---
name: i-verify
description: |
  WHAT：迭代测试验收与交付全流程技能，串联基线同步、自测（含 i-bug 修复循环）、单测补全、PR 合并（CI+评审）、非代码资产变更、预发部署与验证、生产发布八个阶段；状态持久化至 **工作区根目录** `.iteration/verify-state.json` 以支持幂等重跑。Step 0 对六类指引扫描仅 WARN；进入某阶段时若确认该阶段依赖的指引缺失，输出「缺少{规范标题}指引，需要人工介入操作」并结束当次 verify，补全指引后可再跑并从状态断点继续。
  WHEN：完成本次迭代所有变更计划表的研发阶段编码后，启动测试与验收流程；预发验证失败通过 i-bug 修复后重跑时继续调用。
iterationStages:
  - UNIT_TEST
  - PR_MERGE
  - PRE_RELEASE
  - PRODUCTION
skillKind: stage-bound
---

# i-verify：测试验收与交付

在本次迭代完成所有变更计划表的研发阶段编码后，执行此 Skill 完成测试验收与交付全流程。

> **路径根**：`{workspaceRoot}` 指 **Cursor 工作区根目录**（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），**非**各子项目 Git 根。本文档中凡 `.iteration/` 均相对于 `{workspaceRoot}`。

**核心原则**：

- 每步执行前读取 `{workspaceRoot}/.iteration/verify-state.json` 判断是否已完成（幂等检查）
- **指引扫描（Step 0）**：对六类指引做完备性扫描时，**仅产出警告并落盘**，不因指引缺失而宣告整次 i-verify「无法启动」。
- **阶段执行**：所有 `[需仓库提供方案]` 步骤严格以仓库 `AGENTS.md` 中对应指引为准。进入某一阶段并**确认**该阶段所依赖的指引缺失或不可执行（含 `found-empty`）时：
  1. 按下方[缺指引输出句式](#缺指引输出句式与规范标题)输出一句，**该次 verify 过程到此停止**（不再自动进入后续阶段），当前阶段在 `verify-state.json` 的 `steps` 中保持非 `completed`，并写入 `blocked_reason`（建议 `missing_guide:<规范标题>`）；
  2. 人工在仓库中补全对应章节后，**重新执行** i-verify：读取 `{workspaceRoot}/.iteration/verify-state.json`，对已 `completed` 的步骤做幂等跳过，从首个未完成且指引已就绪的阶段继续。
- 预发验证失败时：记录问题 → 调用 `i-bug` 修复 → 重跑本 Skill（按[重跑策略](#重跑策略)决定各步是否跳过）
- 预发验证通过前，**严禁进入生产发布**

> **调度兼容说明**：本 skill 支持由 `iteration-ctl tick` / `dispatch` 在验证与发布阶段派发；也支持直接 `@i-verify` 调用。若没有迭代上下文注入，则按原线性流程执行。

## 阶段断点路由（Stage Hooks）

> 被调度执行时，仅执行与当前 `currentStage` 匹配的 `When stage == ...` 节。每节都以「前置：初始化状态与协议门控」作为隐式前置；完成本节 Yield 条件后立即结束当前 agent 调用。

### When stage == UNIT_TEST

**前置输入**：

- 当前 `currentRoundId`
- `{workspaceRoot}/.iteration/recordings-execute/[<reqId>]*`
- 仓库 `AGENTS.md` 中的单测指引

**核心动作**：

1. 执行「前置：初始化状态与协议门控」。
2. 执行下方「阶段三：单元测试」。
3. 若测试失败且需要修复需求，先通过 `iteration-ctl allocate-req-id` 创建修复 req，并由人工或 verify 流程调用 `iteration-ctl rollback --to EXECUTION --start-req-id <firstFixReqId>`。

**产出（完成契约）**：

- 制品路径：`{workspaceRoot}/.iteration/recordings-test/[R<currentRoundId>] unit-test.md`
- 测试阶段产物使用 `[R<currentRoundId>]` 前缀，不含 reqId。

**Yield 条件**：
成功时输出 `[stage-yield] stage=UNIT_TEST artifact=<路径>`；失败时不落盘成功产物，输出 `[stage-failed] stage=UNIT_TEST reason=<原因>`。

---

### When stage == PR_MERGE

**前置输入**：

- 仓库 `AGENTS.md` 中的合并指引
- 当前分支与本轮代码变更

**核心动作**：

1. 执行「前置：初始化状态与协议门控」。
2. 执行下方「阶段四：PR 合并」。

**产出（完成契约）**：

- 制品路径：`{workspaceRoot}/.iteration/recordings-publish/[<reqId>] pr-merge.md`
- 制品记录 PR 链接、CI 状态、review 处理结果和 merge 结果。

**Yield 条件**：
完成产出后立即结束当前 agent 调用；最终响应末尾输出 `[stage-yield] stage=PR_MERGE artifact=<路径>`。

---

### When stage == PRE_RELEASE

**前置输入**：

- 当前 `currentRoundId`
- 仓库 `AGENTS.md` 中的非代码资产、预发部署与预发自测指引
- 变更计划表中的预发验证要求

**核心动作**：

1. 执行「前置：初始化状态与协议门控」。
2. 执行下方「阶段五：非代码资产变更」「阶段六：预发部署」「阶段七：预发验证」。
3. 预发验证失败时，为每个新发现问题分配修复 reqId 并写入 dima 文件；以第一条修复 reqId 调用 `iteration-ctl rollback --to EXECUTION --reason "<失败说明>" --start-req-id <firstFixReqId>`，不落盘本轮成功产物。

**产出（完成契约）**：

- 制品路径：`{workspaceRoot}/.iteration/recordings-publish/[R<currentRoundId>] pre-release.md`
- 测试阶段产物使用 `[R<currentRoundId>]` 前缀，不含 reqId。

**Yield 条件**：
成功时输出 `[stage-yield] stage=PRE_RELEASE artifact=<路径>`；失败时输出 `[stage-failed] stage=PRE_RELEASE reason=<原因>`，并立即结束。

---

### When stage == PRODUCTION

**前置输入**：

- 仓库 `AGENTS.md` 中的生产发布指引
- `{workspaceRoot}/.iteration/recordings-publish/[R<currentRoundId>] pre-release.md`

**核心动作**：

1. 执行「前置：初始化状态与协议门控」。
2. 执行下方「阶段八：生产发布」。

**产出（完成契约）**：

- 制品路径：`{workspaceRoot}/.iteration/recordings-publish/[<reqId>] production.md`
- 制品记录生产发布动作、验证结果、观察项和回滚预案。

**Yield 条件**：
完成产出后立即结束当前 agent 调用；最终响应末尾输出 `[stage-yield] stage=PRODUCTION artifact=<路径>`。

**缺指引时的阶段门控（与 Step 0 的 WARN 配合）**：进入某一阶段前，根据 `{workspaceRoot}/.iteration/protocol-scan-result.json`（或当场从 `AGENTS.md` 解析）确认该阶段所需指引存在且非空。若缺失，按[缺指引输出句式](#缺指引输出句式与规范标题)输出并**终止当次 verify**；不猜测执行该阶段。前序已完成的步骤不回滚。补全 `AGENTS.md` 后再次运行本 Skill，依状态文件从断点继续。

### 缺指引输出句式与规范标题

**输出句式（字面模板）**：`缺少{规范标题}指引，需要人工介入操作`

其中 **`{规范标题}`** 为下表「规范标题」列字符串（**不含**句末「指引」二字，以免与模板尾部「指引」重复），须与仓库 `AGENTS.md` 中该章节名称一致（含 emoji）。

| 依赖指引                    | 规范标题 `{规范标题}` 取值示例 |
| --------------------------- | ------------------------------ |
| 🔀 仓库迭代合并指引         | `🔀 仓库迭代合并`              |
| 🧪 仓库本地自测指引         | `🧪 仓库本地自测`              |
| 📐 仓库单测指引             | `📐 仓库单测`                  |
| 📦 其它类型研发资产变更指引 | `📦 其它类型研发资产变更`      |
| 🏗️ 仓库预发部署 & 自测指引  | `🏗️ 仓库预发部署 & 自测`       |
| 🚀 仓库生产发布指引         | `🚀 仓库生产发布`              |

**示例**：若缺合并指引，输出：`缺少「🔀 仓库迭代合并」指引，需要人工介入操作`。

若 `AGENTS.md` 整文件缺失，可取首个将执行阶段对应的规范标题输出上述句式（或逐条列出缺失项后仍**终止当次 verify**）。

## 工作流程（主控 Agent 调度模式）

> **任务阶段规划**：使用 TodoWrite 按以下阶段创建待办项，阶段名称与顺序与本文档一致。

### 前置：初始化状态与协议门控

**执行模式**：主控执行

实际执行此步骤时，**必须**阅读 [workflow/step0-init-and-protocol.md](workflow/step0-init-and-protocol.md) 并按其执行。

**核心动作**：

1. 读取 `{workspaceRoot}/.iteration/verify-state.json`，不存在则初始化（见文件内结构定义）
2. 扫描仓库 `AGENTS.md`，检测六类指引是否存在且可解析：🔀合并 / 🧪本地自测 / 📐单测 / 📦资产变更 / 🏗️预发部署&自测 / 🚀生产
3. 若有指引缺失或为空：写入 `protocol-scan-result.json` 的缺失清单与 `result: WARN`，**仅警告**，不将整次流程置为「扫描失败即终止」

**完成标准**：

- [ ] 状态文件已初始化或读取
- [ ] 已产出 `protocol-scan-result.json`（各指引 `found` / `missing` / `found-empty` 可查；`result` 为 `PASS` 或 `WARN`）
- [ ] 变更计划表路径已确认（`{workspaceRoot}/.iteration/recordings-plan/` 下至少一个文件）

---

### 阶段一：基线同步

**执行模式**：主控执行

**幂等检查**：重跑时**强制重新执行**（不可跳过，原因：需要拉取修复提交的最新基线）

**输入**：

- 仓库 `AGENTS.md` 中的 **🔀 仓库迭代合并指引**（硬依赖）
- 当前 git 分支名（`git branch --show-current`）

**目标**：确定迭代分支，拉取基线新代码，解决冲突，确保基线正确

实际执行时，**必须**阅读 [workflow/step1-baseline-sync.md](workflow/step1-baseline-sync.md) 并按其执行。

**完成标准**：

- [ ] 按 🔀 指引确认迭代分支
- [ ] 已拉取基线最新代码（`git fetch` + `rebase` / `pull` 成功）
- [ ] 无未解决冲突（`git status` 无 conflict markers）
- [ ] `git diff <基线分支>...HEAD` 仅含本次迭代变更

**状态更新**：完成后将 `baseline_sync` 置为 `completed` 并写入状态文件。

---

### 阶段二：自测验收

**执行模式**：主控执行（含 i-bug 循环）

**幂等检查**：`self_test == completed` 且非重跑模式 → 跳过

**输入**：

- 仓库 `AGENTS.md` 中的 **🧪 仓库本地自测指引**（硬依赖）
- **变更计划表**中的自测需求列表（硬依赖）

**目标**：执行全部自测需求，所有项通过；问题通过 `i-bug` 修复后重验

实际执行时，**必须**阅读 [workflow/step2-self-test.md](workflow/step2-self-test.md) 并按其执行。

**完成标准**：

- [ ] 变更计划表中所有自测需求已逐项执行
- [ ] 所有测试项状态=PASS（无遗留失败项）
- [ ] 自测记录已写入 `{workspaceRoot}/.iteration/recordings-test/self-test-{timestamp}.md`

**状态更新**：完成后将 `self_test` 置为 `completed` 并写入状态文件。

---

### 阶段三：单元测试

**执行模式**：subagent 委派（编码类，**必须通过 subagent 执行**）

**幂等检查**：`unit_test == completed` 且非重跑模式（或重跑时无新增业务代码） → 跳过

**输入**：

- 仓库 `AGENTS.md` 中的 **📐 仓库单测指引**（硬依赖）
- 本次迭代代码变更 Diff 范围：`git diff <基线分支>...HEAD --name-only`（硬依赖）
- 仓库绝对路径（硬依赖）

**通过 Task 工具调用 Subagent 执行，配置**：

- subagent_type: `generalPurpose`
- **派发 Prompt** 见 [workflow/step3-unit-test-prompt.md](workflow/step3-unit-test-prompt.md)，将以下变量替换后发送：
  - `{仓库绝对路径}`
  - `{diff 文件列表}`（来自上方命令输出）
  - `{📐单测指引全文}`（从 AGENTS.md 提取）

_主控等待 subagent 返回，确认单元测试全部通过且有 commit 后进入下一阶段。若报告有失败，调用 `i-bug` 修复业务代码，再重新派发此阶段。_

**完成标准**：

- [ ] 新增单测 commit 存在（subagent 返回 commit hash）
- [ ] 单测命令返回 0（无 FAIL）
- [ ] 单测覆盖范围与 diff 文件对应

**状态更新**：完成后将 `unit_test` 置为 `completed` 并写入状态文件。

---

### 阶段四：PR 合并

**执行模式**：主控执行（轮询）

**幂等检查**：启动前执行 `gh pr list --head $(git branch --show-current) --state all --json state,number`：

- 已合并且无新提交 → 跳过
- 已合并且有新修复提交 → 走新 fix 分支流程（见[重跑策略](#重跑策略)）
- 已开放 → 跳过创建步骤，继续推进合并

**输入**：

- 仓库 `AGENTS.md` 中的 **🔀 仓库迭代合并指引**（硬依赖）

**目标**：推送分支，通过 CI 与代码评审，合并至主干

实际执行时，**必须**阅读 [workflow/step4-pr-merge.md](workflow/step4-pr-merge.md) 并按其执行。

**完成标准**：

- [ ] 分支已通过仓库指引规定的命令推送（如 `gmr`）
- [ ] PR 已创建且描述完整
- [ ] CI 全部通过（`gh pr checks` 无 failing）
- [ ] 所有 review 评论已处理（无 unresolved）
- [ ] PR 状态=merged

**状态更新**：完成后将 `pr_merge` 置为 `completed` 并写入状态文件。

---

### 阶段五：非代码资产变更

**执行模式**：主控执行（条件）

**幂等检查**：`other_assets == completed` → 跳过（重跑时若修复涉及新的资产变更，需人工确认是否重跑此步）

**输入**：

- 仓库 `AGENTS.md` 中的 **📦 其它类型研发资产变更指引**（硬依赖）
- **变更计划表**中的「其它研发资产变更」列表（硬依赖）

**目标**：按指引，在正确时机执行数据库迁移、配置更新、基础设施变更等

**条件逻辑**：

- 变更计划表中无「其它研发资产变更」条目 → 将 `other_assets` 置为 `completed`，跳过
- 有条目 → 按 📦 指引执行，并确认每项变更生效

**完成标准**：

- [ ] 变更计划表中所有「其它研发资产变更」已按指引时机执行完毕
- [ ] 各变更已确认生效

**状态更新**：完成后将 `other_assets` 置为 `completed` 并写入状态文件。

---

### 阶段六：预发部署

**执行模式**：主控执行

**幂等检查**：`pre_release_deploy == completed` 且非重跑模式 → 跳过；**重跑时必须重新部署**

**输入**：

- 仓库 `AGENTS.md` 中的 **🏗️ 仓库预发部署 & 自测指引**（硬依赖）

**目标**：将合并至主干的最新代码部署到预发环境

按仓库 **🏗️ 仓库预发部署 & 自测指引** 中的部署部分执行部署命令，并按指引确认部署成功（而非仅「命令无报错」）。

**完成标准**：

- [ ] 预发部署命令已按指引执行
- [ ] 部署状态已按仓库指引确认为成功

**状态更新**：完成后将 `pre_release_deploy` 置为 `completed` 并写入状态文件。

---

### 阶段七：预发验证

**执行模式**：subagent 委派（测试类，**必须通过独立 subagent 执行，不得由主控自测**）

**幂等检查**：**无论如何必须执行**，不跳过

**输入**：

- 仓库 `AGENTS.md` 中的 **🏗️ 仓库预发部署 & 自测指引**（自测部分，硬依赖）
- **变更计划表**中的自测需求（硬依赖）

**通过 Task 工具调用 Subagent 执行，配置**：

- subagent_type: `generalPurpose`
- **派发 Prompt** 见 [workflow/step7-pre-release-test-prompt.md](workflow/step7-pre-release-test-prompt.md)，将以下变量替换后发送：
  - `{🏗️预发部署&自测指引全文}`（从 AGENTS.md 提取）
  - `{自测需求列表}`（从变更计划表提取）

**主控接收报告后的处理**：

```
若结论为「全部通过」：
  - 将 pre_release_verify 置为 completed，写入状态文件
  - 进入阶段八（生产发布）

若结论为「发现问题」：
  1. 将完整报告写入 `{workspaceRoot}/.iteration/recordings-test/pre-release-issues-{timestamp}.md`
  2. 将 pre_release_verify 置为 failed，追加问题列表到 verify-state.json
  3. 对每个问题调用 i-bug skill 定位并修复
  4. 所有问题修复后，按重跑策略重置状态，run_count + 1
  5. 从阶段一重新开始执行 i-verify
```

---

### 阶段八：生产发布

**执行模式**：主控执行

**前置门控**：`pre_release_verify` 状态必须为 `completed`，否则**阻断**，不得跳过

**输入**：

- 仓库 `AGENTS.md` 中的 **🚀 仓库生产发布指引**（硬依赖）
- **变更计划表**中的「生产发布要求」（灰度比例、配置开关、观察期等，硬依赖）

**目标**：按变更计划表的生产发布要求，完成生产环境发布

实际执行时，**必须**阅读 [workflow/step8-production.md](workflow/step8-production.md) 并按其执行。

**完成标准**：

- [ ] 变更计划表中「生产发布要求」已逐项落实
- [ ] 生产部署已执行
- [ ] 发布后验证通过（按 🚀 指引）
- [ ] 生产发布记录已写入 `{workspaceRoot}/.iteration/recordings-publish/`

**状态更新**：完成后将 `production` 置为 `completed` 并写入状态文件。整个 i-verify 流程结束。

---

## 重跑策略

当预发验证失败、通过 `i-bug` 完成修复后需重跑 i-verify 时，更新 `run_count + 1`，并按下表决定各步骤状态：

| 步骤               | 重置为 pending | 说明                                                 |
| ------------------ | :------------: | ---------------------------------------------------- |
| baseline_sync      |       ✅       | 需拉取主干最新修复提交                               |
| self_test          |       ✅       | 需验证修复代码的自测需求                             |
| unit_test          |       ✅       | 需为修复代码补充单元测试                             |
| pr_merge           |       ✅       | 需为修复提交创建新 PR（fix 分支）                    |
| other_assets       |       ❌       | 保持 completed，除非修复涉及新资产变更（需人工确认） |
| pre_release_deploy |       ✅       | 必须重新部署含修复代码的版本                         |
| pre_release_verify |       ✅       | 必须重新验证                                         |
| production         |       ✅       | 未执行时保持 pending                                 |

**修复分支处理**：PR 已合并后，修复代码禁止 force push 主干。从最新主干创建 `fix/pre-release-{YYYYMMDD}` 分支，走完整 CI + 评审 + 合并流程。

**重跑上限**：`run_count >= 3` 时自动阻断，输出所有历史问题记录，升级人工处理，不继续自动重跑。

---

## 异常处理

| 场景                                   | 处理方式                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step 0 扫描发现指引不全                | 落盘 `protocol-scan-result.json`，`result: WARN`，**不**因扫描结果单独终止整次 i-verify                                                                                                          |
| 执行到某阶段而**该阶段依赖的**指引缺失 | 按[缺指引输出句式](#缺指引输出句式与规范标题)输出（含具体规范标题）；**当次 verify 停止**；更新 `verify-state.json` 的 `blocked_reason`；补全指引后重新执行 i-verify，依已完成步骤**从断点继续** |
| 自测同一项 ≥3 次 FAIL                  | 阻断，输出完整失败上下文，升级人工                                                                                                                                                               |
| CI 持续失败超过重试上限                | 阻断，输出 CI 日志摘要，升级人工                                                                                                                                                                 |
| PR 评论涉及设计层面质疑                | 阻断，输出评论内容，等待人工决策                                                                                                                                                                 |
| 预发部署失败                           | 阻断，按 🏗️ 仓库预发部署 & 自测指引执行回滚，升级人工                                                                                                                                            |
| `run_count >= 3` 且预发仍失败          | 阻断，输出历史记录，升级人工                                                                                                                                                                     |
| 生产发布失败                           | **立即阻断，按 🚀 指引执行回滚**，升级人工                                                                                                                                                       |

---

## 工具链依赖

参见 [references/toolchain-requirements.md](references/toolchain-requirements.md) — 工具链规格与实现要求。

## 仓库协议要求

参见 [references/repo-protocol-spec.md](references/repo-protocol-spec.md) — 仓库 AGENTS.md 必须提供的指引规范。
