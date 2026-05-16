# Stage-Bound Skill 模板

将下列骨架复制到 `SKILL.md` 后，按实际阶段保留需要的 `When stage == ...` 节，并替换尖括号占位。

```markdown
---
name: <skill-name>
description: |
  <一句话说明 skill 处理什么任务>
iterationStages:
  - PLANNING
  - EXECUTION
  - SELF_TEST
skillKind: stage-bound
---

# <skill-name>：<标题>

> **调度兼容说明**：本 skill 支持由 `iteration-ctl tick` / `dispatch` 按阶段派发；也支持用户直接 `@<skill-name>` 调用。若 `{workspaceRoot}/.iteration/iteration-context.json` 不存在，或当前调用未注入 `reqId` / `currentStage`，则按 `iterationStages` 顺序线性执行全部阶段节。

## 阶段断点路由（Stage Hooks）

> 被调度执行时，仅执行与当前 `currentStage` 匹配的 `When stage == ...` 节。完成本节 Yield 条件后立即结束当前 agent 调用，不继续下一阶段。

### When stage == PLANNING

**前置输入**：
- 调度器注入：`iterationId`、`currentStage`、`currentRoundId`、`reqId`、`workItemId`、`skillName`
- 上游需求文件：`{workspaceRoot}/.iteration/dima/[<reqId>]*.json` 或 `{workspaceRoot}/.iteration/todo/[<reqId>]*.json`

**核心动作**：
1. <分析需求并形成计划>
2. <确认仓库范围、风险和自测用例>

**产出（完成契约）**：
- `{workspaceRoot}/.iteration/recordings-plan/[<reqId>] <needName>/change-plan.md`
- 不写 `iteration-context.json` 的业务字段；完成判定由调度器扫描 `[<reqId>]*` 产物。

**Yield 条件**：
完成产出后立即结束当前 agent 调用；最终响应末尾输出 `[stage-yield] stage=PLANNING artifact=<路径>`。

---

### When stage == EXECUTION

**前置输入**：
- `{workspaceRoot}/.iteration/recordings-plan/[<reqId>] <needName>/change-plan.md`
- 目标仓库 `AGENTS.md`

**核心动作**：
1. 按计划执行代码变更与验证。
2. 每条 git commit 的 message 第一行必须为 `reqId: <iterationId>-<reqId>`，第二行起写常规描述。

**产出（完成契约）**：
- `{workspaceRoot}/.iteration/recordings-execute/[<reqId>] <commit-id>.md`
- 本阶段相关验证命令已执行并记录结果。

**Yield 条件**：
完成产出后立即结束当前 agent 调用；最终响应末尾输出 `[stage-yield] stage=EXECUTION artifact=<路径>`。

---

### When stage == SELF_TEST

**前置输入**：
- `{workspaceRoot}/.iteration/recordings-execute/[<reqId>]*`
- 当前 `currentRoundId`

**核心动作**：
1. 按仓库自测指引执行回归验证。
2. 若失败，不落盘本阶段成功产物，输出 `[stage-failed]` 并交由 i-verify 或人工触发回滚。

**产出（完成契约）**：
- `{workspaceRoot}/.iteration/recordings-test/[R<currentRoundId>] self-test.md`

**Yield 条件**：
成功时输出 `[stage-yield] stage=SELF_TEST artifact=<路径>`；失败时输出 `[stage-failed] stage=SELF_TEST reason=<原因>`，并立即结束。
```

