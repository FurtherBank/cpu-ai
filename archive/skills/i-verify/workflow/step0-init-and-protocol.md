# Step 0 - 初始化与协议门控

> **路径根**：本步骤写入的 `.iteration/*` 均位于 **Cursor 工作区根目录** `{workspaceRoot}`（studio 多仓顶层，与根级 `AGENTS.md`、`.cursor/` 同级），**非**下方「仓库根目录」所指子项目 Git 根。

## 输入信息

**必须入参**：
- `仓库根目录路径`：当前仓库的绝对路径
- `AGENTS.md 路径`：`{仓库根目录}/AGENTS.md`

**上下文参考**：
- [../references/repo-protocol-spec.md](../references/repo-protocol-spec.md)：各指引的要求规范

## 目标要求

**任务**：初始化验证状态文件，并验证仓库 AGENTS.md 的协议完备性

**目标**：
- 六类指引（🔀合并 / 🧪本地自测 / 📐单测 / 📦资产变更 / 🏗️预发部署&自测 / 🚀生产）全部存在且可解析时，扫描结果为 `PASS`
- 任一指引缺失、`found-empty`，或 `AGENTS.md` 不存在：**仅记录为 `WARN`**，落盘缺失清单，**不因扫描结果单独终止整次 i-verify**（与 `SKILL.md` 核心原则一致）
- 后续各阶段：若进入该阶段时**确认**所依赖指引仍缺失，按 `SKILL.md` [缺指引输出句式与规范标题](../SKILL.md#缺指引输出句式与规范标题) 输出 **`缺少{规范标题}指引，需要人工介入操作`**，**当次 verify 停止**；将 `verify-state.json` 的 `blocked_reason` 置为建议格式 `missing_guide:<规范标题>`（与句式中的 `{规范标题}` 同形），当前阶段保持未完成。补全 `AGENTS.md` 后再次运行 i-verify，依状态从断点继续

**特性要求**：
- 状态文件结构完整（含 run_count、steps 字段）
- 协议扫描结果以 JSON 格式落盘（便于后续步骤按需读取）
- 仅检查「是否存在」和「是否可被 AI 解析」，不执行指引内容
- 不得因「大概知道怎么部署」而在**阶段执行时**绕过缺失指引（阶段门控见 `SKILL.md`）

## 工作依据

**状态文件格式**：

```json
{
  "run_count": 1,
  "last_updated": "<ISO 时间戳>",
  "steps": {
    "baseline_sync":      "pending",
    "self_test":          "pending",
    "unit_test":          "pending",
    "pr_merge":           "pending",
    "other_assets":       "pending",
    "pre_release_deploy": "pending",
    "pre_release_verify": "pending",
    "production":         "pending"
  },
  "pre_release_issues": [],
  "blocked_reason": null
}
```

- `blocked_reason`：平时为 `null`；因缺指引而终止当次 verify 时建议写入 `missing_guide:🔀 仓库迭代合并`（与 `SKILL.md` 中 `{规范标题}` 取值一致，**不含**句末「指引」）；人工补全并再次运行前可清空或覆盖

**协议扫描结果格式**：

```json
{
  "scanned_at": "<ISO 时间戳>",
  "agents_md_path": "<路径>",
  "agents_md_present": true,
  "guides": {
    "merge_guide":       { "status": "found|missing|found-empty", "hint": "<匹配到的标题行或缺失说明>" },
    "self_test_guide":   { "status": "found|missing|found-empty", "hint": "..." },
    "unit_test_guide":   { "status": "found|missing|found-empty", "hint": "..." },
    "asset_change_guide":{ "status": "found|missing|found-empty", "hint": "..." },
    "pre_release_guide": { "status": "found|missing|found-empty", "hint": "..." },
    "production_guide":  { "status": "found|missing|found-empty", "hint": "..." }
  },
  "result": "PASS|WARN",
  "missing_guides": []
}
```

- `result` 为 `WARN` 当且仅当：`agents_md_present` 为 false，或任一类指引为 `missing` / `found-empty`
- **不再使用**「仅因指引扫描」而产生的 `BLOCKED` 终态；阶段执行时的缺指引处理见 `SKILL.md` 异常表

**检测关键词（逐一搜索 AGENTS.md，若文件不存在则跳过内容扫描）**：

| 指引 | 检测 emoji/关键词 |
|------|-----------------|
| 🔀 仓库迭代合并指引 | `🔀` 或「迭代合并」 |
| 🧪 仓库本地自测指引 | `🧪` 或「本地自测」 |
| 📐 仓库单测指引 | `📐` 或「单测」 |
| 📦 其它类型研发资产变更指引 | `📦` 或「资产变更」或「研发资产」 |
| 🏗️ 仓库预发部署 & 自测指引 | `🏗️` 或「预发部署」 |
| 🚀 仓库生产发布指引 | `🚀` 或「生产发布」 |

**方法论**：
- 先检查 `AGENTS.md` 是否存在；若不存在，设 `agents_md_present: false`，全部指引记为 `missing`，`result: WARN`
- 若文件存在，用上方关键词逐一扫描，记录匹配到的章节标题和行号
- 若某指引只有标题没有内容（标题后立刻是另一个 `#` 标题），标注为 `found-empty`，计入 `missing_guides`，`result: WARN`
- 变更计划表路径：读取 `{workspaceRoot}/.iteration/recordings-plan/` 目录，若目录不存在或空，**仍按仓库约定阻断本步完成条件**（见下方「变更计划表」说明），与「指引扫描只警告」区分

**变更计划表**：本技能多数阶段依赖变更计划表。若目录不存在或为空，不得将 Step 0 标为完成；输出明确提示并等待补充（不因「指引 WARN」而掩盖此项）。

## 产出格式

落盘两个文件：

1. `{workspaceRoot}/.iteration/verify-state.json`：状态文件（首次创建 or 保留已有内容）
2. `{workspaceRoot}/.iteration/protocol-scan-result.json`：协议扫描报告

若扫描结果为 `WARN`，输出类似：

```
⚠️ i-verify 协议扫描：存在缺失或非空指引

以下指引在 AGENTS.md 中未找到或为空：
- 🏗️ 仓库预发部署 & 自测指引
- 🚀 仓库生产发布指引

扫描**不会**因此单独终止整次 i-verify。后续**进入**依赖上述指引的某一阶段且确认仍缺失时，将按具体规范标题输出 **`缺少{规范标题}指引，需要人工介入操作`** 并**结束当次 verify**；补全指引后重新执行，从 `{workspaceRoot}/.iteration/verify-state.json` 断点继续。

（参见 .cursor/skills/i-verify/references/repo-protocol-spec.md 了解各指引的格式要求）
```

若扫描结果为 `PASS`，简要确认六类指引均已找到且非空即可。
