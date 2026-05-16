---
name: i-spec-feature
description: |
  WHAT：给定「规范文档（i-spec-design 产出 design.md）」或「feature 直达需求工单」，结合当前系统现状，**一次性**产出充分的 `change-plan.md`，并按计划落地为有序 git 提交。
  WHEN：当 i-spec-design 已产出 design.md，或 feature 类工单可直接编码时启用。
iterationStages:
  - PLANNING
  - EXECUTION
skillKind: stage-bound
---

# i-spec-feature：规范差距分析 → 变更清单 → 代码落地

本技能整合**规划阶段（一次性产出 change-plan.md）**与**执行阶段（按 plan 提交代码）**两个完整闭环。

## 核心约束

1. **PLANNING 必须完全收敛**：所有落点、字段名、设计决策必须在规划阶段确定；EXECUTION 不再做设计探索；EXECUTION 一旦发现 plan 留白，立即按 CRITICAL 流程阻断。
2. **EXECUTION 不写测试**：仅做编码 + `build` 编译自洽校验，**不**编写、**不**执行任何测试代码或单测命令；行为校验留给 `i-verify`。
3. **风险信号雷达**：编码过程中发现的风险信号只**记录**、**不**修复、**不**扩散。

## 边界外约定（上游负责拆分）

单次 `i-spec-feature` 调用仅处理**一个独立子需求**。当一个完整需求横跨多个独立范围（如同时涉及多个互不重叠的子系统）时，由 `i-todo` / `i-dima-resolve` 在入轨时**拆为多个 reqId**，每个 reqId 对应独立的 `design.md` / `change-plan.md` / `change-execute` 产物。本技能**不**做切片、**不**做并行编排、**不**做跨需求合并。

> **调度兼容说明**：本 skill 支持由 `iteration-ctl tick` / `dispatch` 在 `PLANNING` 或 `EXECUTION` 阶段派发；也支持直接 `@i-spec-feature` 调用。若没有迭代上下文注入，则按线性流程执行。

## 工作流程（主控 Agent 调度模式）

> **任务阶段规划**：使用 TodoWrite 按下方四个阶段创建待办项，每阶段一项，名称与顺序与本文档一致，**不得跳过或合并**。

---

### 阶段一：规范对齐与规划生成（PLANNING）

**执行模式**：在迭代规划阶段，即 `PLANNING` 阶段，主控执行
**输入**：

- 调度器注入的 `iterationId`、`reqId`、`workItemId`、`currentRoundId`、`skillName`
- 规范文档（`design.md`）/ 需求工单 + 工作区仓库范围 + 目标仓 `AGENTS.md`
  **目标**：一次性吃透规范、检索系统现状、决策落点，直接产出最终的 `change-plan.md`，无中间产物。
  **执行指引**：执行到本步骤时，**必须**阅读 [workflow/step1-plan.md](workflow/step1-plan.md) 作为指导。
  **预期产出**：`change-plan.md` 已写入约定路径，且通过自检 Checklist。完成后立即结束当前 agent 调用，并在最终响应末尾输出 `[stage-yield] stage=PLANNING artifact=<路径>`。

---

### 阶段二：执行前场准备（EXECUTION）

**执行模式**：在迭代执行阶段，即 `EXECUTION` 阶段，主控执行
**输入**：

- 调度器注入的 `iterationId`、`reqId`、`workItemId`、`currentRoundId`、`skillName`
- 规划阶段产出 `change-plan.md`、目标仓库 `AGENTS.md`
  **目标**：加载构建/commit 规范，构建（或恢复）`tasks.md`，确定执行起点（首次 / 续跑）。
  **执行指引**：执行到本步骤时，**必须**阅读 [workflow/step2-execute-init.md](workflow/step2-execute-init.md) 作为指导。
  **预期产出**：`tasks.md` 就绪；续跑模式下已确认 git 状态一致；commit 头部模板已加载。

---

### 阶段三：编码与提交循环（EXECUTION）

**执行模式**：在迭代执行阶段，即 `EXECUTION` 阶段，主控执行
**输入**：`tasks.md` 与各项目录代码
**目标**：严格按任务列表执行 编码 → 编译自洽 → pre-commit 校验 → Commit → 更新 tasks.md，循环至所有任务完成。每条 commit 的 message **第一行必须**为 `reqId: <iterationId>-<reqId>`。
**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step3-execute-loop.md](workflow/step3-execute-loop.md) 作为指导。
**预期产出**：所有 Cx 已带 commit 记录；遭遇设计冲突时按 CRITICAL 流程阻断、yield。

---

### 阶段四：收尾报告（EXECUTION）

**执行模式**：在迭代执行阶段，即 `EXECUTION` 阶段，主控执行
**输入**：执行完成后的 `tasks.md`、收集的代码风险信号
**目标**：生成纯净的提交清单与风险清单报告，全流程结束。
**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step4-execute-report.md](workflow/step4-execute-report.md) 作为指导。
**预期产出**：`{workspaceRoot}/.iteration/recordings-execute/[<reqId>] <summary>.md` 写入完成。完成后立即结束当前 agent 调用，并在最终响应末尾输出 `[stage-yield] stage=EXECUTION artifact=<路径>`。

---

## 全局注意事项

1. **严格遵守阶段顺序**，禁止跳过；阶段内自检不可绕过。
2. **PLANNING 阶段必须收敛**所有落点、字段名、设计决策；不得把模糊要求转交 EXECUTION。
3. MUST 类条款**必须 100% 有变更条目覆盖**或显式标注「不适用：原因」；发现遗漏立刻补条目。
4. EXECUTION **绝对禁止**自主探索、编写或运行任何测试。
5. **粒度留白须显式声明**：原则上极少出现；凡有意授权 EXECUTION 自行决策的点，必须用「粒度留白（已授权）」格式标注，否则视为 plan 设计缺陷。
6. **超大需求**应在 `i-todo` / `i-dima-resolve` 入轨阶段即拆为多个独立 reqId（design + plan + execute 各自独立产物），本技能不做切片合并。
