# bilibili-crawl：行为日志可比对质量标准

> 供运行时审计与契约偏差检测。由 `$behavior-log-audit` retrofit 注入。

## 结构完整性

- [ ] 日志位于 `.skill-logs/bilibili-crawl/yyyy-mm-dd/hhmm-*.md`
- [ ] 元数据含 `规范版本: behavior-log/v1`、执行 ID、Skill、状态、时间、工作区、执行目标
- [ ] 11 个固定章节齐全
- [ ] 封口后无「执行中，待收敛」占位

## 阶段覆盖（Audit Hook）

| 阶段 | 日志须更新的章节 | 完成判据 |
| --- | --- | --- |
| 初始化 | 元数据、执行边界、依据与关键输入 | 首次 Shell 启动 `b-claw` / `bilibili-transform` / `b-consume` 之前已创建 |
| 命令映射 | 关键行为、依据与关键输入 | 已记录输入形态、映射决策与最终命令行 |
| 后台启动与 sanity check | 关键行为、偏离异常（若阻断） | 5 条启动健康信号已验证，或已记录阻断原因与用户待办 |
| 等待完成 | 关键行为、偏离异常 | 收到完成通知；记录 `exit_code`、末条 `__B_CLAW_PROGRESS__`（若有） |
| 复制 cpu-matrix | 影响清单、资源索引 | `summarys/` 与 `public/docs/<合集名>/` 文件数校验一致 |
| 交付封口 | 顶层执行摘要、结果与验证、影响闭包 | 按「完成后汇报模板」交付用户前封口 |

## 子 Skill 链

- [ ] 本 Skill 无显式子 Skill 委派；「子 Skill 调用」写「无」
- [ ] Shell 后台命令（`b-claw` 等）在「关键行为」记命令、terminal 引用、健康检查结论，不复制终端全文

## 影响闭包

- [ ] 「影响清单」含 `cpu-cli-tool/summarys/`、`cpu-matrix/public/docs/<合集名>/` 的材料性变更
- [ ] 负向声明：未擅自 `git commit`（除非用户明确要求）；`-a` 模式下 `downloads/` 变空为设计行为
- [ ] 顶层执行摘要覆盖映射 → 启动 → 完成 → 复制 → 汇报全链

## 与交付物对齐

| 交付物 | 日志记录方式 |
| --- | --- |
| `cpu-cli-tool/summarys/MMDD-HHMMSS/*.md` | 资源索引链接，不复制正文 |
| `cpu-cli-tool/downloads/MMDD-HHMMSS/` | 影响清单或负向声明（`-a` 整理后为空） |
| `cpu-matrix/public/docs/<合集名>/` | 影响清单 + 资源索引 |
| `b-claw` terminal 输出 | 关键行为引用 terminal 路径，不复制全文 |
