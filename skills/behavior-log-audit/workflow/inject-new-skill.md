# 为新 Workflow Skill 注入可审计协议

## 输入

- 目标 Skill 目录：`skills/<skill-name>/`
- s-workflow-sop 阶段四节点质量标准
- 各工作流阶段的 Audit Hook 清单

## 步骤

### 1. 创建 references/audit-quality-standards.md

复制 [templates/audit-quality-standards.md](../templates/audit-quality-standards.md)，替换：

- `${skill-name}`、`${skill-slug}`
- `${stage-audit-rows}`：每个阶段的表格行
- `${delivery-alignment-rows}`：交付物路径与日志资源索引的对齐规则

### 2. 写入 SKILL.md 协议节

在「工作流程」之前插入 [templates/skill-audit-protocol-snippet.md](../templates/skill-audit-protocol-snippet.md) 渲染结果。

### 3. 为每个阶段追加 Audit Hook

在主控阶段末尾追加：

```markdown
**Audit Hook**：本阶段完成后更新日志「关键行为」「影响清单」；${阶段特定章节}
```

在 Subagent 委派阶段的返回格式追加：

```markdown
## 返回格式

- 交付物：...
- behaviorLogPath：`.skill-logs/...`（若本阶段为显式 Skill 调用）
- 材料性影响摘要：...
```

### 4. 阶段 N-1 校验清单追加

```markdown
- [ ] 行为日志协议章节存在且触发点无空占位
- [ ] references/audit-quality-standards.md 存在且阶段行齐全
```

### 5. 自检

- [ ] 相对链接可解析到 behavior-log-audit
- [ ] 未在 SKILL.md 内嵌 BL03 全文
- [ ] 交付物路径与 skill-logs 边界写清
