---
name: s-auto-dev
description: |
  自动化迭代编排入口。通过 iteration-ctl 拉起 iteration、分配 reqId、按阶段 tick 派发 stage-bound skills，并在人工 advance / rollback / archive 的门控下完成整轮研发流程。
skillKind: terminal
---

# s-auto-dev：自动化迭代编排入口

本 skill 是编排者，不绑定单一 `IterationStage`，因此不声明 `iterationStages`。它负责串联 `iteration-ctl` 命令与 `i-*` stage-bound skills，直到迭代归档或进入 blocked 人工介入状态。

## 工作流程

1. 读取工作区根目录 `AGENTS.md` 与目标子仓 `AGENTS.md`，确认仓库协议与可执行命令。
2. 执行 `iteration-ctl start <iterationId>` 初始化 `.iteration/iteration-context.json`。
3. 对 dima / todo 来源需求完成 INTAKE：通过 `iteration-ctl allocate-req-id --source <dima|todo>` 分配 reqId，并写入 `.iteration/dima/` 或 `.iteration/todo/` 的 `[<reqId>]*.json` 文件。
4. 循环执行 `iteration-ctl tick --once` 或 `iteration-ctl tick --interval 60`，让当前阶段内所有候选需求按 `stageConcurrency` 派发。
5. 使用 `iteration-ctl status` 查看当前阶段完成度。只有守卫条件满足时，人工或外部 orchestrator 显式调用 `iteration-ctl advance` 推进阶段。
6. 遇到测试失败或人工 review 退回时，按回滚矩阵调用 `iteration-ctl rollback --to <STAGE> --reason <text>`；测试阶段回到编码方向时必须先分配修复需求 reqId，并传入 `--start-req-id`。
7. `PRODUCTION` 完成后执行 `iteration-ctl archive`，将 `.iteration/` 归档到 `.archive-iterations/<iterationId>/`。

## 人工介入点

- 仓库协议缺失或不可执行。
- `iteration-ctl status` 显示 `blockedReason` 非空。
- 同一轮多次 rollback，或 `roundHistory` 连续增长。
- 子 agent 失败且未落盘 `[stage-yield]` 产物。
- 需要权限、登录、发布窗口或生产操作确认。

详细生命周期见 [workflow/lifecycle.md](workflow/lifecycle.md)。Stage Hooks 协议见 [references/skill-stage-hooks-spec.md](references/skill-stage-hooks-spec.md)。

