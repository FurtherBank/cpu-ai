# 修改 feature 技能：合并风险自审环节

## 用户需求

/feature 修改skill 实现：风险信号 review 环节，放到 coder subagent 中执行。

修改时间：2026-03-16 16:30:00

## 阶段一：完成标准

### 理解用户意图

- 用户希望简化 `feature` 技能的工作流，将原本独立的“阶段四：识别代码风险信号”（由 Review Subagent 负责）合并到“阶段三：编码实现与测试闭环”（由 Coder Subagent 负责）。
- 这样做的目的是提高效率，让 Coder 在完成编码和自测后直接进行风险自审。

### 关键实现点

- 修改 `SKILL.md`，将阶段三改为“编码实现、测试与风险自审”，移除原阶段四（Review Subagent 环节）。
- 更新 `SKILL.md` 中的派发 Prompt，要求 Coder Subagent 同时负责风险自审并返回报告。
- 更新 `SKILL.md` 中的“最后：输出功能记录”部分，风险信号来源从阶段四改为阶段三。
- 更新 `SKILL.md` 中的“注意事项”，反映阶段合并后的逻辑。
- 修改 `workflow/feature_task.md`，在交付自测闭环后增加“风险自审”要求，并引用 `feature_review.md`。
- 修改 `workflow/feature_review.md`，将执行主体从 Review Subagent 改为 Coder Subagent。

### 自测用例

- ⭐ 验证 `SKILL.md` 中阶段三的描述已包含风险自审要求。
- ⭐ 验证 `SKILL.md` 中已移除阶段四。
- ⭐ 验证 `workflow/feature_task.md` 已包含风险自审的执行指令。
- ⭐ 验证 `workflow/feature_review.md` 的执行主体说明已更新。

## 代码修改路径

**1. 修改 `SKILL.md`**
- 文件路径：`/Users/lrt/Desktop/weavefox/.cursor/skills/feature/SKILL.md`
- 合并阶段三和阶段四，更新 Prompt 模板、记录汇总逻辑和注意事项。

**2. 修改 `workflow/feature_task.md`**
- 文件路径：`/Users/lrt/Desktop/weavefox/.cursor/skills/feature/workflow/feature_task.md`
- 在“交付自测闭环”后添加风险自审的指令。

**3. 修改 `workflow/feature_review.md`**
- 文件路径：`/Users/lrt/Desktop/weavefox/.cursor/skills/feature/workflow/feature_review.md`
- 更新文档开头的执行主体说明。

## 测试执行情况

- **交付自测**：已通过 Coder Subagent 验证了所有自测用例。
  - `SKILL.md` 阶段描述已更新，阶段四已移除。
  - `SKILL.md` 派发 Prompt 已要求返回“代码风险报告”。
  - `feature_task.md` 包含“交付自测与风险自审闭环”及相关指令。
  - `feature_review.md` 执行主体已更新为“Coder Subagent 进行代码风险自审”。

## 代码风险信号

### 无风险信号
本次修改属于对技能定义（Markdown 文档）的流程调整，不涉及业务逻辑代码。修改确保了主控 Agent 在派发任务时逻辑更加紧凑，减少了 Subagent 切换的开销，同时强化了 Coder 对代码质量的闭环责任。
