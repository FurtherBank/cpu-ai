# Skill 阶段断点协议

本文定义参与 `iteration-ctl tick` / `dispatch` 调度的 skill 必须遵守的 Stage Hooks 协议。协议目标是让一个端到端 skill 仍以单个 `SKILL.md` 表达完整流程，但在运行时可按工作区全局阶段分段执行、完成后立即 yield。

## Frontmatter

参与调度的 skill 必须在 YAML frontmatter 中声明：

```yaml
iterationStages:
  - PLANNING
  - EXECUTION
skillKind: stage-bound
```

- `iterationStages` 必须是 `IDLE | INTAKE | DESIGN | PLANNING | EXECUTION | SELF_TEST | UNIT_TEST | PR_MERGE | PRE_RELEASE | PRODUCTION | ARCHIVED` 的顺序保持子集。
- `skillKind: stage-bound` 表示该 skill 接受调度器注入的当前阶段，只执行匹配阶段节。
- 未声明 `iterationStages` 的 skill 视为 `skillKind: terminal`，保持直接 @skill 的线性执行模式。

## 章节语法

正文必须包含顶层章节：

```markdown
## 阶段断点路由（Stage Hooks）
```

其下每个阶段使用精确标题：

```markdown
### When stage == PLANNING
```

每个 `When stage == <STAGE>` 节必须包含四个固定子节：

1. **前置输入**：调度器注入字段、上游阶段产物、仓库协议等。
2. **核心动作**：本阶段内部业务步骤，不得跨阶段执行。
3. **产出（完成契约）**：本阶段必须落盘的制品路径与校验条件。
4. **Yield 条件**：完成产出后立即结束当前 agent 调用，不继续下一阶段。

## 产物与 Yield

- 非测试阶段产物使用 `[<reqId>]` 前缀，例如 `.iteration/recordings-plan/[042] foo/change-plan.md`。
- 测试阶段（`SELF_TEST` / `UNIT_TEST` / `PRE_RELEASE`）的整轮报告使用 `[R<currentRoundId>]` 前缀，例如 `.iteration/recordings-test/[R2] unit-test.md`。
- `EXECUTION` 阶段产生的 commit message 第一行必须为 `reqId: <iterationId>-<reqId>`。
- 阶段成功时，最终响应以 `[stage-yield] stage=<STAGE> artifact=<path>` 收尾。
- 阶段失败时，不落盘本阶段完成产物，最终响应以 `[stage-failed] stage=<STAGE> reason=<text>` 收尾。

Skill 不应直接写 `iteration-context.json` 的业务字段；需求元数据写在 `.iteration/dima/[<reqId>]*.json` 或 `.iteration/todo/[<reqId>]*.json` 中，阶段完成由 `scanStageCompletion` 扫描制品文件推断。

## 兼容规则

stage-bound skill 必须支持直接 @skill 调用。若 `{workspaceRoot}/.iteration/iteration-context.json` 不存在，或本次调用未注入 `reqId` / `currentStage`，则按 `iterationStages` 顺序线性执行全部阶段节，等价于旧版端到端模式。

## 调度器注入

`iteration-ctl` 派发 agent 时会注入以下上下文：

```text
iterationId
currentStage
currentRoundId
isTestStage
reqId
source
workItemId
skillName
iteration-context.json path
```

agent 只能执行与 `currentStage` 匹配的 `### When stage == <STAGE>` 节；完成该节的 Yield 条件后必须停止。

## 示例

```markdown
## 阶段断点路由（Stage Hooks）

### When stage == EXECUTION

**前置输入**：

- `{workspaceRoot}/.iteration/recordings-plan/[<reqId>] <needName>/change-plan.md`

**核心动作**：

1. 按变更计划执行编码与测试。
2. 提交时使用 `reqId: <iterationId>-<reqId>` 作为 commit message 第一行。

**产出（完成契约）**：

- `{workspaceRoot}/.iteration/recordings-execute/[<reqId>] <commit-id>.md`

**Yield 条件**：
完成产出后立即结束当前 agent 调用；最终响应末尾输出 `[stage-yield] stage=EXECUTION artifact=<路径>`。
```
