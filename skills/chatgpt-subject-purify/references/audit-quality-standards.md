# chatgpt-subject-purify：行为日志可比对质量标准

> 供运行时审计与契约偏差检测。由 `$behavior-log-audit` retrofit 注入。

## 结构完整性

- [ ] 日志位于 `.skill-logs/chatgpt-subject-purify/yyyy-mm-dd/hhmm-*.md`
- [ ] 元数据含 `规范版本: behavior-log/v1`、执行 ID、Skill、状态、时间、工作区、执行目标
- [ ] 11 个固定章节齐全
- [ ] 封口后无「执行中，待收敛」占位

## 阶段覆盖（Audit Hook）

| 阶段 | 日志须更新的章节 | 完成判据 |
| --- | --- | --- |
| 初始化 | 元数据、执行边界 | 首次 `aichat` 或写 subject 之前已创建 |
| 1. 拉取阶段 | 关键行为、影响清单（chats）、子 Skill 调用或关键行为一行 | 拉取阶段总结已回传并登记 |
| 2. 整合阶段 | 关键行为、影响清单、资源索引、结果与验证 | 每轮主题产物更新后；校验通过并封口前 |

## 子 Skill 链

- [ ] 拉取 Subagent 若返回 `behaviorLogPath`，父日志「子 Skill 调用」表有登记
- [ ] 纯 Task 无子文件时，「关键行为」有拉取摘要一行

## 影响闭包

- [ ] 「影响清单」含 `cpu-matrix/public/chats/` 与 `public/subjects/<主题>/` 的材料性变更
- [ ] 负向声明：未修改原始聊天文件（只读来源资产）
- [ ] 顶层执行摘要覆盖拉取 + 整合完整影响

## 与交付物对齐

| 交付物 | 日志记录方式 |
| --- | --- |
| `public/subjects/<主题>/核心上下文.md` 等 | 资源索引链接，不复制正文 |
| `public/chats/` 新增目录 | 影响清单 + 资源索引 |
| `净化日志.md` | 资源索引；与 skill-logs 分工见 SKILL.md 协议节 |
| `.cursor` Skill 变更（若本次涉及） | 影响清单类型 `版本库` |
