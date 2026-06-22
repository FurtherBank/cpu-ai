# ${skill-name}：行为日志可比对质量标准

> 供运行时审计与后续契约偏差检测（L2）消费。由 s-workflow-sop 阶段四/七或 behavior-log-audit 注入时生成。

## 结构完整性

- [ ] 日志文件位于 `.skill-logs/${skill-slug}/yyyy-mm-dd/hhmm-*.md`
- [ ] 元数据表含 `规范版本: behavior-log/v1`、执行 ID、Skill、状态、时间、工作区、执行目标
- [ ] 11 个固定章节齐全，顺序正确
- [ ] 封口后无「执行中，待收敛」类占位符

## 阶段覆盖（Audit Hook）

| 阶段 | 日志须更新的章节 | 完成判据 |
| --- | --- | --- |
${stage-audit-rows}

## 子 Skill 链

- [ ] 每个显式 Skill 子调用在「子 Skill 调用」表有登记
- [ ] 子日志链接可访问（workspace-relative）
- [ ] 子 Skill 材料性影响已汇总进父「影响清单」

## 影响闭包

- [ ] 「影响清单」覆盖本次所有材料性文件/版本库/外部动作变更
- [ ] 负向边界（明确未修改的路径）在影响清单或执行边界可查
- [ ] 顶层执行摘要语义覆盖整个执行链主要影响

## 与交付物对齐

${delivery-alignment-rows}
