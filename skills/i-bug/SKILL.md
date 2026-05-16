---
name: i-bug
description: |
  资深工程师视角的 Bug 定位与修复工作流。基于「线索心智」（把每个异常表现当线索，层层推理锁定问题范围）和「假设-验证循环」（偶现/疑难 Bug 专项方法论），完成从接收工单到归档关闭的完整闭环。
  适用于：由 i-todo 路由的 bug 类任务；受理入轨后类型为 bug 或由 iteration-ctl 派发至本技能时调用；或直接 @i-bug 触发处理单个 Bug 工单。
iterationStages:
  - PLANNING
  - EXECUTION
  - SELF_TEST
skillKind: stage-bound
---

# i-bug：Bug 定位与修复工作流

本 skill 以**资深工程师视角**，从接收 bug 工单到代码修复、测试补全、上线归档，完成完整的 Bug 处理闭环。

核心方法论：

- **线索心智**：不急着看代码，先把每个异常表现当作线索，通过逐步观测-判断-下一步的循环锁定问题范围
- **偶现 Bug 专项**：偶现必现化三步法——日志增强 → 压测触发 → 中间状态快照破局
- **根因而非症状**：修复必须追溯到数据/配置的来源，而非只修报错行

## 工作流程（主控 Agent 调度模式）

> **任务阶段规划**：使用 TodoWrite 按以下步骤创建待办项，每步对应一项。

**全局上下文约束**：

- 每步执行前，检查 TodoWrite 待办项，完成一步后立刻更新状态
- 项目 AGENTS.md 在步骤一中读取一次，后续按需引用，不重复全量注入
- 所有中间产物写入需求目录下的 `investigation.md`（临时文件，步骤七归档时清理）

---

### 步骤一：信息锚定

**执行模式**：在`PLANNING`阶段，主控执行

**输入**：

- 工单上下文：`dimaLocalState`、`remoteDetail`（含 description）、`comments`
- 需求目录路径（调用者通过提示词传入，通常对应 recordings-plan 的目录）
- 项目 AGENTS.md（若存在，读取一次）

**目标**：把「模糊的 bug 描述」变成「可操作的精确现象描述」

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step1-anchor.md](workflow/step1-anchor.md) 作为指导。
预期正常执行后，会产出 `{需求目录}/investigation.md` 文件，其中包含 bug 的精确现象描述。

---

### 步骤二：证据采集

**执行模式**：在迭代规划阶段，即`PLANNING`阶段，主控执行

**输入**：

- `investigation.md`（步骤一产出）
- 代码库（通过 Read/Grep/Glob 按需访问）
- 工单中的 stacktrace / 日志文本（软上下文）

**目标**：定位「第一现场」（具体文件:行号 或 SQL 或 错误码）；偶现 Bug 则输出日志增强方案

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step2-evidence.md](workflow/step2-evidence.md) 作为指导。
预期正常执行后，会在`investigation.md` 中补充第一现场定位 + 初步根因类型猜测

---

### 步骤三：根因归类与范围定界

**执行模式**：在迭代规划阶段，即`PLANNING`阶段，主控执行

**输入**：

- `investigation.md`（含第一现场）
- 上下文参考：[references/bug-identify.md](references/bug-identify.md)

**目标**：用根因分类框架归类；用 rg/Grep 建立完整调用点清单

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step3-classify.md](workflow/step3-classify.md) 作为指导。
预期正常执行后，会在 `investigation.md` 中补充根因类型标签 + 影响范围清单

---

### 步骤四：复现与精确定位

**执行模式**：在迭代规划阶段，即`PLANNING`阶段，主控执行

**输入**：

- `investigation.md`（含根因类型 + 影响范围清单）
- 代码库

**目标**：产出精确因果链陈述「当 X 时，因为 Y，导致 Z」，有代码/日志交叉验证

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step4-reproduce.md](workflow/step4-reproduce.md) 作为指导。
预期正常执行后，会在 `investigation.md` 中补充精确根因陈述 + 证据

---

### 步骤五：修复方案选型

**执行模式**：在迭代规划阶段，即`PLANNING`阶段，主控执行

**输入**：

- `investigation.md`（含精确根因陈述）
- 项目约束（从 AGENTS.md + 工单 comments 中提取）

**目标**：选定修复方案，附决策依据

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step5-design.md](workflow/step5-design.md) 作为指导。
预期正常执行后，会在 `investigation.md` 中补充选定方案 + 候选方案对比 + 发布顺序（如有）

---

### 步骤六：实施修复与测试补全

**执行模式**：

- 在迭代执行阶段，即`EXECUTION`阶段执行
- 主控执行编码；
- 高危 DDL 操作（ALTER TABLE 等）委派 shell subagent

**输入**：

- `investigation.md`（含选定方案）
- 代码库

**目标**：完成代码修复 + 新增测试 + 全量测试通过

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step6-implement.md](workflow/step6-implement.md) 作为指导。
预期正常执行后，会产出修复代码 diff + 新增测试用例 + 测试通过输出

---

### 步骤七：上线验证与归档

**执行模式**：主控执行

**输入**：

- 测试验证 subagent 返回的通过报告
- `workItemId`（来自工单上下文）

**目标**：完成线上验证 + 工单归档关闭

**执行指引**：执行到本步骤时，**必须**阅读 [workflow/step7-verify.md](workflow/step7-verify.md) 作为指导。
预期正常执行后，会产出根因记录摘要 + dima 工单关联文件

---

## 注意事项

1. **严格遵守步骤顺序**，不跳步，各步骤内的校验门禁（参考对应的 workflow 文档）不可绕过
2. **偶现 Bug** 在步骤二若判断为 `reproducible: false`，必须走日志增强路径再继续
3. **DB migration** 顺序：migration 先行，代码后部署；发布前备好 down() 回滚脚本
4. **横向搜索**：每次修代码前必须用 rg 确认全部调用点，"我记得只有一个入口"是最危险的信念
5. 修复**不涉及** dima 工单时（如直接 @i-bug），步骤七的 dima 关联写入可跳过
