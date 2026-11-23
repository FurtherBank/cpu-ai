# s-workflow-sop ↔ behavior-log-audit 桥接说明

s-workflow-sop 阶段七落盘 Workflow Skill 时，**必须**调用 `$behavior-log-audit` 完成可审计注入。

## 阶段职责

| s-workflow-sop 阶段 | behavior-log-audit 动作 |
| --- | --- |
| 四 | 节点质量标准增加「可审计性」维度；产出 Audit Hook 落点草案 |
| 五 | 四要素 Goal/Execution Mode 写入 Audit Hook；模板 B 返回格式加 `behaviorLogPath` |
| 六 | 嵌入行为日志完整性校验节点 |
| 七 | 执行 [inject-new-skill.md](../../behavior-log-audit/workflow/inject-new-skill.md) |

## 产出物清单

目标 Skill 目录须新增或更新：

- `SKILL.md` — 「行为日志执行协议」节 + 各阶段 Audit Hook
- `references/audit-quality-standards.md` — 可比对质量标准（L2 契约偏差检测输入）

## 引用路径

从 `skills/<target>/SKILL.md` 引用共享契约（路径相对于**目标 Skill 根目录**）：

```markdown
[behavior-log/v1 契约](../behavior-log-audit/references/behavior-log-v1-contract.md)
```

从 **本文件**（`s-workflow-sop/references/`）引用插件工作流时使用：

```markdown
[inject-new-skill.md](../../behavior-log-audit/workflow/inject-new-skill.md)
[retrofit-existing-skill.md](../../behavior-log-audit/workflow/retrofit-existing-skill.md)
[behavior-log-v1-contract.md](../../behavior-log-audit/references/behavior-log-v1-contract.md)
```

## Retrofit 已有 Skill

不经过完整七阶段时，使用 [retrofit-existing-skill.md](../../behavior-log-audit/workflow/retrofit-existing-skill.md)。
