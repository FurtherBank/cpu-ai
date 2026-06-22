## 行为日志执行协议

- **规范引用**：[behavior-log/v1 契约](../behavior-log-audit/references/behavior-log-v1-contract.md)；日志骨架：[behavior-log-skeleton.md](../behavior-log-audit/templates/behavior-log-skeleton.md)
- **路径**：`{workspaceRoot}/.skill-logs/${skill-slug}/yyyy-mm-dd/hhmm-<任务标题slug>.md`
- **初始化**：${init-trigger}。写入元数据、执行边界、状态 `执行中`。任务标题来源：${task-title-source}
- **增量更新触发点**：
${increment-triggers}
- **子 Skill / Subagent 契约**：${subagent-return-format}
- **封口**：${seal-condition}。更新顶层执行摘要、影响清单、结果与验证、资源索引；终态与完成时间一致。子 Skill 应有日志但未返回路径时，终态最高 `部分成功`，并在「偏离、异常与未决事项」记审计缺口
- **与交付物边界**：主题/设计/代码等交付物写入各自 canonical 路径；本 Skill 行为日志只记录过程审计，通过「资源索引」链接交付物，不复制正文
