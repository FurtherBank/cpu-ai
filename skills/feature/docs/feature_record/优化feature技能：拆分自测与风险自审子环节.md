# 优化 feature 技能：拆分自测与风险自审子环节

## 用户需求

优化 `feature_task.md`，将交付自测和代码风险自审拆分为两个独立的子环节。

修改时间：2026-03-16 16:40:00

## 阶段一：完成标准

### 理解用户意图

- 用户指出在 `feature_task.md` 中，交付自测和代码风险自审被挤在一个章节里，应当将它们明确拆分为两个独立的子环节，以提高流程的清晰度和执行的仪式感。

### 关键实现点

- 修改 `workflow/feature_task.md`，将“交付自测与风险自审闭环”章节拆分为“交付自测闭环”和“代码风险自审”两个独立的二级标题章节。

### 自测用例

- ⭐ 验证 `workflow/feature_task.md` 中已存在独立的 `## 交付自测闭环` 章节。
- ⭐ 验证 `workflow/feature_task.md` 中已存在独立的 `## 代码风险自审` 章节。

## 代码修改路径

**1. 修改 `workflow/feature_task.md`**
- 文件路径：`/Users/lrt/Desktop/weavefox/.cursor/skills/feature/workflow/feature_task.md`
- 拆分标题和内容。

## 测试执行情况

- **交付自测**：已确认 `workflow/feature_task.md` 的章节结构已按要求拆分。

## 代码风险信号

### 无风险信号
本次修改仅涉及文档章节结构的微调，不改变执行逻辑，无风险。
