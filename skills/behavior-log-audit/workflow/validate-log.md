# 校验行为日志（behavior-log/v1）

## 输入

- 日志文件 workspace-relative 路径
- 可选：目标 Skill 的 `references/audit-quality-standards.md`

## 结构检查

- [ ] 路径符合 `.skill-logs/<skill-slug>/yyyy-mm-dd/hhmm-*.md`
- [ ] 元数据表 8 项齐全
- [ ] 11 章节标题与顺序正确
- [ ] 规范版本为 `behavior-log/v1`

## 封口检查（若声称已结束）

- [ ] 状态 ∈ {成功, 部分成功, 失败, 阻断, 取消}，非 `执行中`
- [ ] 完成时间非 `—`
- [ ] 顶层执行摘要非「待收敛」占位
- [ ] 「子 Skill 调用」无未解释空表（无子调用时写「无」）
- [ ] 「更正记录」有内容或「无」

## 链路检查

- [ ] 子日志 Markdown 链接可解析
- [ ] 影响清单与资源索引无矛盾

## 契约检查（若有 audit-quality-standards.md）

逐条对照阶段 Audit Hook 行，标记未更新的阶段。

## 输出格式

```markdown
## 校验结果：${pass|fail|partial}

### 结构
...

### 封口
...

### 缺口
1. ...

### 建议
- ...
```
