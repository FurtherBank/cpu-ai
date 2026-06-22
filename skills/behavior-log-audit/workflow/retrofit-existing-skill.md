# Retrofit：为已有 Skill 接入可审计协议

## 输入

- 目标 Skill 路径（如 `skills/chatgpt-subject-purify/`）
- 该 Skill 的阶段/步骤列表
- 材料性触发点（阶段完成、子 Skill 返回、不可逆操作）

## 步骤

### 1. 盘点阶段与 Subagent 边界

列出每个阶段的执行模式（主控 / Subagent）及是否对应显式 Skill 调用。

### 2. 创建 references/audit-quality-standards.md

按 [inject-new-skill.md](./inject-new-skill.md) 步骤 1，根据既有阶段填 `${stage-audit-rows}`。

### 3. 插入行为日志执行协议节

位置：`SKILL.md` 中「工作流总览」或「工作流程」之前。

使用 [skill-audit-protocol-snippet.md](../templates/skill-audit-protocol-snippet.md)，填写：

| 占位符 | 示例（chatgpt-subject-purify） |
| --- | --- |
| init-trigger | 首次执行 `aichat sync` 或写入 `public/subjects/` 之前 |
| increment-triggers | 拉取阶段总结回传后；整合阶段每完成主题文件更新后；校验完成后 |
| seal-condition | 交付口径汇报前；全部校验项通过或已记录审计缺口 |
| subagent-return-format | 拉取 Subagent 返回 `{拉取阶段总结, behaviorLogPath?, 材料性影响摘要}`；纯 Task 无独立日志时在父日志记一行 |

### 4. 各阶段追加 Audit Hook

不改动原有 Input/Goal/Guidance/Execution Mode 语义，仅在阶段末尾追加 **Audit Hook** 一行或短段。

### 5. 更新拉取/委派 Prompt 返回格式

在 Subagent 派发 Prompt 的「返回格式」中增加 `behaviorLogPath`（若适用）。

### 6. 校验清单追加

在 Skill 末尾校验步骤增加行为日志完整性检查（或引用 [validate-log.md](./validate-log.md)）。

### 7. 试跑并封口

- 用一次真实或模拟执行创建 `.skill-logs/` 日志
- 运行 validate-log 工作流
- 根据缺口迭代本 Skill 或目标 Skill 的触发点描述

## 注意

- 不删除、不改写既有业务规则正文
- 不把 `净化日志.md` / `recordings-*` 与 `.skill-logs/` 混为同一 canonical
- retrofit 本身的 commit 可作为「影响清单」中的版本库条目
