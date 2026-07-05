# 拉取阶段执行流程

本文件是 `chatgpt-subject-purify` 阶段一的完整执行契约。根 `SKILL.md` 只负责调度；拉取 Subagent 必须按本文执行，并把“拉取阶段总结”返回给主控 Agent。

## Input

拉取 Subagent 接收主控 Agent 提供的以下信息：

- 用户原始要求。
- 主题名与目标 subject 目录。
- 数据源范围：ChatGPT、Sider、两者都用上，或用户指定的来源。
- 时间窗口：默认最近 2 天；若用户给出“一天内 / 最近 N 天 / 某日期区间”，按用户范围执行。
- 指定 URL、conversation id、标题关键词或本地对话路径。
- 聊天资产输出目录：`/Users/a1111/Desktop/ai-workspace/cpu-matrix/public/chats`。

## Goal

拉取阶段只完成来源资产准备和结构化交接：

- 获取 ChatGPT / Sider / 本地聊天候选材料。
- 保持 `public/chats/` 下原始聊天文件不被修改。
- 记录实际命令、资产写入、认证状态、覆盖缺口和轻量候选线索。
- 输出可被整合阶段直接消费的“拉取阶段总结”。

拉取阶段不得产出主题正文，不得更新 `public/subjects/<主题>/`，不得替整合阶段做最终纳入判断。候选来源清单只做材料交接，整合阶段可以推翻其中的轻量边界线索。

## Guidance

### 工作区与前置约束

在 `cpu-cli-tool` 项目根执行命令：

```bash
cd /Users/a1111/Desktop/ai-workspace/cpu-cli-tool
```

执行前检查并遵守：

- `/Users/a1111/Desktop/ai-workspace/cpu-cli-tool/AGENTS.md`
- `/Users/a1111/Desktop/ai-workspace/cpu-matrix/AGENTS.md`

优先使用已安装的 `aichat` 命令；若不可用，再使用对应的 `node dist/commands/.../index.js` 入口。项目相关命令不要在工作区根目录直接执行。

### 批量同步

默认使用 `aichat sync` 一次性完成远端扫描与内容拉取。`aichat sync` 按远端对话更新时间筛选时间窗内条目，自动拉取完整内容并增量落盘；仅 stdout 输出有内容变动的对话。

默认同步最近 2 天：

```bash
aichat sync -o /Users/a1111/Desktop/ai-workspace/cpu-matrix/public/chats --days 2
```

整合阶段需要结构化交接时，加 `--json`，并消费 `items` 中每条变更对话的 `title`、`updateTime`、`conversationDir`、`totalRounds` 等字段：

```bash
aichat sync -o /Users/a1111/Desktop/ai-workspace/cpu-matrix/public/chats --days 2 --json
```

时间参数统一传给 `aichat sync`：`--days`、`--hours`、`--since`、`--until`。用户说“一天内 / 最近 N 天 / 某日期区间”时，把相同参数传给 `aichat sync`。

当用户要求“两个数据源都用上”时，仍以 `aichat sync` 为统一入口，由 `aichat` 负责聚合 ChatGPT 与 Sider 的同步结果；不要退回旧的 `chatgpt sync` / `sider sync` 双命令心智。

### 定向拉取

用户已给出具体对话 URL、id 或标题关键词且需精确定位单条时，仍走 `aichat sync`。若 `aichat sync` 支持对应的定向参数，按命令能力传入；不要改用旧的 `chatgpt pull`、`sider pull` 或 `sider chat`。

```bash
aichat sync "<conversation-id-or-url-or-keyword>" -o /Users/a1111/Desktop/ai-workspace/cpu-matrix/public/chats
```

### 查阅对话

`public/chats/` 下原始对话目录很多，直接查看完整目录会引入大量相邻主题干扰。需要查阅最近新对话、按标题关键词定位本地对话或补充候选来源时，必须先执行 `aichat view <可选关键词regex>`，按更新时间倒序查看结果，再根据命令结果中的文件名、标题或路径访问实际对话文件。

```bash
aichat view
aichat view "关键词|regex"
```

禁止直接 `ls public/chats`、遍历完整 chats 目录、用旧的 `chatgpt list` / `sider list` 或用本地 `filter` 替代 `aichat view` 来查阅候选对话。只有 `aichat view` 已给出候选标题或路径后，才访问对应 `public/chats/<对话标题>/` 下的实际 Markdown 文件。

### 资产写入约束

两个数据源的拉取结果都会按对话标题写入：

```text
cpu-matrix/public/chats/<对话标题>/001.md
cpu-matrix/public/chats/<对话标题>/002.md
...
```

必须遵守：

- 不修改拉取出的原始聊天文件；它们是来源资产。
- 没有明确指定历史范围时，默认执行 `aichat sync --days 2`；不要默认全量扫描 `public/chats`，不要使用 `list --all`，不要逐个 `pull`。
- `aichat sync` 会拉取时间窗内全部命中对话，但只有内容有变动的才输出；整合阶段候选范围以 `aichat sync --json` 的 `items` 或拉取阶段总结的候选来源清单为准。
- 查阅本地最近对话或按关键词补充候选时，必须使用 `aichat view <可选关键词regex>` 的输出作为候选入口；不得直接遍历完整 chats 目录标题列表。

### 认证与覆盖缺口

遇到认证或来源覆盖问题时，不要静默跳过：

- ChatGPT 认证失败时，说明需要用户登录 ChatGPT、切换 Chrome profile，或提供 `CHATGPT_ACCESS_TOKEN` / `--token`。
- Sider 认证失败或遇到 Cloudflare challenge 时，说明需要用户在 Chrome 中保持 Sider 登录；必要时切换 `--profile` 或提供 `--token`。
- Sider 当前单对话消息接口默认最多拉取 200 条，超长对话要在覆盖缺口中记录。
- 未能访问的数据源、未能定位的关键词、用户需要补充的信息，都进入“覆盖缺口”。

## Execution Mode

拉取阶段默认由独立 Subagent 执行。若当前运行环境无法启动 Subagent，主控 Agent 先停止并说明拉取阶段未按标准隔离完成；只有用户明确允许主控代跑时，才用主控执行拉取，并在交付中标记该偏离。

Subagent 执行顺序：

1. 读取主控给定的主题名、目标目录、数据源范围、时间窗口、URL / id / 关键词。
2. 检查 `cpu-cli-tool/AGENTS.md` 与 `cpu-matrix/AGENTS.md`。
3. 在 `cpu-cli-tool` 项目根选择 `aichat sync` 或 `aichat view` 命令。
4. 执行同步或查阅，记录命令、状态、stdout 关键结果和失败原因。
5. 只访问 `aichat sync --json` 或 `aichat view` 已给出的候选路径。
6. 形成候选来源清单、资产写入记录、覆盖缺口和进入整合阶段的建议。
7. 按返回格式把“拉取阶段总结”交给主控 Agent。

## 返回格式

Subagent 返回给主控的总结是整合阶段的唯一交接入口，必须包含：

| 字段 | 说明 |
| --- | --- |
| 拉取任务 | 用户原始要求、主题名、目标 subject 目录、时间范围、指定 URL / id / 标题关键词。 |
| 执行环境 | 实际工作目录、读取到的 `AGENTS.md` 约束、使用的 CLI 入口。 |
| 命令记录 | 关键 `aichat sync` / `aichat view` 命令、成功或失败状态、失败原因。 |
| 候选来源清单 | 数据源、标题、路径、远端 id 或 URL、拉取状态、时间信息、轻量边界线索。 |
| 资产写入 | 新增或确认存在的 `public/chats/...` 目录。 |
| 覆盖缺口 | 认证失败、Sider 200 条限制、未能访问的数据源、用户需要补充的信息。 |
| 进入整合阶段的建议 | 哪些文件应被主控读取，哪些材料明显暂缓或需要谨慎处理。 |
| behaviorLogPath（可选） | 若拉取 Subagent 创建了独立行为日志，返回 workspace-relative 路径；否则省略，由父日志摘要覆盖。 |
| 材料性影响摘要 | 一行说明本阶段新增或确认的 `public/chats/` 资产，供父日志影响清单使用。 |

返回中可以包含轻量边界线索，但不得把线索写成主题结论。
