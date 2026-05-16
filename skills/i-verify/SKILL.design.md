> **声明**：该文档为本 skill 的设计规范，用于指导技能本身的迭代。技能正文（`SKILL.md`）及执行本 skill 时，禁止参照本文档内容。

---

# i-verify · Skill Design

> **路径根**：下文凡 `.iteration/` 路径均相对于 **Cursor 工作区根目录** `{workspaceRoot}`（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），非各子项目 Git 根。

> 依据：[任务步骤四要素推导方法论](../s-workflow-sop/references/task-step-schema.md)

---

## 一、输入信息 (Input)

### 硬依赖（必须入参）

| # | 信息 | 来源 | 备注 |
|---|------|------|------|
| 1 | 变更计划表（`{workspaceRoot}/.iteration/recordings-plan/` 下所有 `change-plan.md`） | 上游 i-spec-execute 产出 | 必须 |
| 2 | 目标仓库路径 | 编排层注入 | 必须 |

### 软上下文（按需索引）

| # | 信息 | 获取方式 |
|---|------|----------|
| A | 仓库 `AGENTS.md` 中六类指引（🔀 合并 / 🧪 本地自测 / 📐 单测 / 📦 资产变更 / 🏗️ 预发部署&自测 / 🚀 生产） | 主控读取，作为各阶段执行依据 |
| B | 验收状态文件 `{workspaceRoot}/.iteration/verify-state.json` | 主控读取；不存在则初始化；用于幂等判断与重跑恢复 |
| C | 各阶段工作流指引 | `workflow/step{N}-*.md`，到达对应阶段时再读 |

---

## 二、目标职责 (Goal)

**状态变更 (Delta)**：
将「本次迭代所有变更计划表的仓库代码变更已提交」的状态，推进到「生产发布完成，变更经过完整测试验证并稳定上线」的终态。

**阶段链**：基线同步 → 自测验收 → 单元测试 → PR 合并 → 非代码资产变更 → 预发部署 → 预发验证 → 生产发布

**完成判定 (Done Predicate)**：

当且仅当以下全部条件满足时判定完成：

- P1. `verify-state.json` 中八个阶段状态均为 `completed`
- P2. 所有自测需求已逐项通过（`{workspaceRoot}/.iteration/recordings-test/` 有记录）
- P3. 单元测试 commit 已存在，单测命令返回 0，覆盖范围与 diff 文件对应
- P4. PR 已合并至主干（`gh pr list` 确认 merged，CI 全部通过，所有 review 评论已处理）
- P5. 变更计划表中所有非代码资产变更已按时机执行完毕并确认生效
- P6. 预发部署已按指引确认成功，预发验证报告结论为「全部通过」
- P7. 生产发布已按变更计划表的发布要求完成，发布后验证通过，记录已写入 `{workspaceRoot}/.iteration/recordings-publish/`

**不做什么（Negative Prompts）**：
- 预发验证通过前，**严禁进入生产发布**
- 不跳过任何 `[需仓库提供方案]` 步骤——Step 0 对指引的扫描**只警告**；进入某阶段并确认**该阶段依赖的**指引仍缺失时，按 `SKILL.md` 输出 **`缺少{规范标题}指引，需要人工介入操作`**，**当次 verify 终止**；补全指引后重跑，依 `verify-state.json` 从断点继续
- 不在同一主控 session 中执行预发验证（必须委派独立 subagent，不得由主控自测）

---

## 三、工作依据 (Guidance)

### 流程规范依据

| 阶段 | 指导文件（到达该阶段时必须先读） |
|------|--------------------------------|
| 前置初始化 | `workflow/step0-init-and-protocol.md` |
| 阶段一：基线同步 | `workflow/step1-baseline-sync.md` |
| 阶段二：自测验收 | `workflow/step2-self-test.md` |
| 阶段三：单元测试（委派 subagent） | `workflow/step3-unit-test-prompt.md` |
| 阶段四：PR 合并 | `workflow/step4-pr-merge.md` |
| 阶段七：预发验证（委派 subagent） | `workflow/step7-pre-release-test-prompt.md` |
| 阶段八：生产发布 | `workflow/step8-production.md` |

### 方法论依据

**正常路径直觉**：
- 每阶段入口读 `verify-state.json` 进行幂等检查，已完成且非重跑模式 → 跳过
- 预发验证失败时：记录问题 → 调用 `i-bug` 逐一修复 → 按重跑策略重置状态 → 从阶段一重跑；`run_count >= 3` 自动阻断

**异常路径与陷阱**：
- `AGENTS.md` 六类指引（🔀合并 / 🧪本地自测 / 📐单测 / 📦资产变更 / 🏗️预发部署&自测 / 🚀生产）中任一缺失：前置扫描落盘 `WARN` 与缺失清单；进入依赖缺失指引的阶段时输出带 `{规范标题}` 的固定句式并**结束当次 verify**；不因**仅扫描**而终止（与「阶段门控终止」区分）
- PR 已合并后预发失败：从最新主干创建 `fix/pre-release-{YYYYMMDD}` 分支，走完整 CI + 评审 + 合并，**禁止 force push 主干**
- 自测同一项 ≥3 次 FAIL：阻断，输出完整失败上下文，升级人工

---

## 四、执行模式 (Execution Mode)

**判定结论：主控主导；阶段三（单元测试）和阶段七（预发验证）委派独立 Subagent**

**判定依据**：
- 各阶段之间存在强状态依赖（`verify-state.json` 是持久化检查点），须由主控统一持有与驱动
- 阶段三（单元测试）为纯编码任务，输入可完整打包，适合委派 `generalPurpose` subagent 并行执行
- 阶段七（预发验证）必须由独立 subagent 执行，避免主控「先入为主」掩盖问题

**调用方式**：

由编排层在 i-spec-execute 产出所有代码提交后触发：

```
本次迭代所有代码变更已提交，请按照 .cursor/skills/i-verify/SKILL.md 执行测试验收与交付流程。

变更计划表路径：`{workspaceRoot}/.iteration/recordings-plan/`
目标仓库路径：{repo_path}
```

产出物路径约定：
- 验收状态：`{workspaceRoot}/.iteration/verify-state.json`
- 自测记录：`{workspaceRoot}/.iteration/recordings-test/`
- 发布记录：`{workspaceRoot}/.iteration/recordings-publish/`
