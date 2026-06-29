---
name: bilibili-crawl
description: WHAT：把"抓 B 站字幕（可选 + AI 整理）"这件事统一收口到 cpu-cli-tool 的 B 站命令族（b-claw / bilibili-transform / b-consume），把任意 B 站输入（视频 URL / 合集 URL / UP 主链接或 ID / 待办收藏夹）映射成正确的命令与入参，按规范在 cpu-cli-tool 项目根后台启动、做早期 sanity check、完成后把整理产物复制到 cpu-matrix 的单独文档合集，并给出预览入口与 git 提交命令。WHEN：用户提到"抓 B 站 / bilibili 字幕"、贴出 bilibili.com / space.bilibili.com 链接或 BV 号、想批量爬某个 UP 主或合集的字幕、想对已下好的 .ass 补跑整理、要消费 AI 待办收藏夹增量条目时使用；是 b-claw / bilibili-transform / b-consume 的统一心智入口。
---

# bilibili-crawl

把"抓 B 站字幕并整理"这件事，从"凭记忆挑命令 + 凭手感拼参数"升级为**输入 → 命令族决策树 → 后台启动 → 整理文章 → 复制到 cpu-matrix 合集 → 汇报预览入口**的标准流程。

## 行为日志执行协议

- **规范引用**：[behavior-log/v1 契约](../behavior-log-audit/references/behavior-log-v1-contract.md)；日志骨架：[behavior-log-skeleton.md](../behavior-log-audit/templates/behavior-log-skeleton.md)；可比对标准：[audit-quality-standards.md](references/audit-quality-standards.md)
- **路径**：`{workspaceRoot}/.skill-logs/bilibili-crawl/yyyy-mm-dd/hhmm-<任务标题slug>.md`
- **初始化**：首次在 `cpu-cli-tool` Shell 启动 `b-claw` / `bilibili-transform` / `b-consume` 之前；写入元数据、执行边界、固定章节骨架，状态 `执行中`。任务标题取用户给出的 B 站来源一行摘要（如「UP 14885306 全部投稿」「合集 BV1x4cveKEag 422 条」）。
- **增量更新触发点**：
  - 行为日志初始化后、命令映射确定并写入最终命令行后
  - 60–90s sanity check 完成（成功或阻断）后
  - 收到 `b-claw` / `bilibili-transform` / `b-consume` 完成通知后
  - `summarys/` 复制到 `cpu-matrix/public/docs/<合集名>/` 且文件数校验通过后
- **子 Skill / Subagent 契约**：本 Skill 无显式子 Skill 委派；Shell 后台命令在父日志「关键行为」记命令、terminal 引用、健康检查与 `exit_code` 摘要即可。「子 Skill 调用」写「无」
- **封口**：按「完成后汇报模板」向用户交付前；更新顶层执行摘要、影响清单（含 `summarys/` 与 `cpu-matrix` 合集路径）、结果与验证、资源索引。若 sanity check 阻断或 `exit_code != 0` 且未完成复制，终态为 `失败` / `阻断` / `部分成功` 并在「偏离、异常与未决事项」记审计缺口
- **与交付物边界**：`cpu-cli-tool/summarys/`、`cpu-matrix/public/docs/<合集名>/` 为交付物；`.skill-logs/` 为本次 Skill **执行过程**审计。通过「资源索引」链接交付物路径，不复制 `.md` 正文或 terminal 全文

## 心智地图：B 站爬取的命令族

| 场景 | 命令 | 心智 |
|---|---|---|
| 抓字幕（可同时整理） | `b-claw [-a]` | **核心**：浏览器侧抓字幕，`-a` 触发"下载完成后自动整理"二合一 |
| 字幕已经下好，仅补跑转换 | `bilibili-transform` | 扫 `cpu-cli-tool/downloads/**/*.ass`，按下方固定提示词将字幕原文整合成完整文章并写到 `summarys/` |
| AI 待办收藏夹增量消费 | `b-consume` | 内部就是 `b-claw -a`，加上"自上次运行起新收藏的视频"增量逻辑 |

**默认偏好**：用户说"抓 B 站 xxx"且没说"只下不整理"时，**默认走 `b-claw -a`**（与本工作区历史用法一致）。仅在用户明确说"先只下，不整理" / "先看看字幕轨道是否存在"时才去掉 `-a`。

## 输入 → b-claw 入参的映射

`b-claw` 自身的接口（来自 `cpu-cli-tool/src/commands/media/b-claw.ts`）：

```text
b-claw [options] [urls...]
  -c, --collection <url>   合集页 URL
  -u, --up <id>            UP 主 ID（数字）
  -a, --analyze            下载完成后自动分析
  --first                  合集模式：从播放列表首个视频开始，而非当前链接对应视频
  [urls...]                一个或多个具体视频 URL
```

按用户提供的输入形态选择映射：

| 输入形态 | 识别正则 / 判据 | 映射 |
|---|---|---|
| 视频 URL（一个或多个） | `https?://(www\\.)?bilibili\\.com/video/BV[\\w]+` | `b-claw <url1> <url2> ...` |
| 单个 BV 号（无 host） | `^BV[\\w]+$` | 自动补全为 `https://www.bilibili.com/video/<BV>`，再走视频 URL |
| UP 主投稿页 | `https?://space\\.bilibili\\.com/(\\d+)(/upload/video)?/?` | 抽取数字 ID → `b-claw -u <id>` |
| 纯 UP 主 ID（数字字符串） | `^\\d+$` | `b-claw -u <id>` |
| 合集 / 列表页 URL | 形如 `bilibili.com/.../channel/collectiondetail/...` 或合集播放页 | `b-claw -c <url> -a --first`（抓**整个合集**时默认从首条开始） |
| 视频 URL +「对应合集」 | 用户给 BV 链接并说明要抓所在合集/播放列表 | **`b-claw -c <同一视频 URL> -a --first`**（`-c` 打开的是带侧边播放列表的页面即可，不必先解析 `collectiondetail` 链接） |
| "抓我的 AI 待办收藏夹" | 用户口头点名"待办收藏夹" / "增量" | `b-consume`（不传 URL，固定 fav `media_id`） |
| 已经下好 .ass，想补跑整理 | 用户说"已经下了字幕，只跑整理" / "重跑整理" | `bilibili-transform` |

### `--first` 何时加、何时不加

`-c` 合集模式**默认从当前链接对应视频**开始顺序往后抓；加 `--first` 会先跳到播放列表**第一条**再开始。

| 场景 | 是否加 `--first` |
|---|---|
| 抓**整个合集** / 「全爬」「全部字幕」 | **加**（与 `cpu-collector` 默认一致） |
| 用户给的链接只是合集的**入口**，未强调「从这条开始」 | **加** |
| 用户明确「从这条开始」「只抓后面的」「断点续抓第 N 条起」 | **不加** |
| 链接已是合集第一条，或用户确认只需当前条及之后 | **不加** |

## 字幕转换提示词

`bilibili-transform` 以及 `b-claw -a` 最终都会调用 `subtitleAnalysis`。对应的转换提示词必须保持为：

```text
请通过字幕原文整合成一篇完整的文章。文章必要位置可以通过结构化表达，增强可读性。

注：
- 完整保留字幕中的信息：论点、条件、转折、数字、人名、否定与限制语均不得因「润色」而消失或扭曲。
- 允许：合并短句、调整语序以符合中文阅读习惯；必要处加连接词使逻辑显式化。
- 禁止：添加 SRT 中不存在的因果/评价/结论；编造未出现的专名或数据。
```

歧义处理：

- 用户给了 `space.bilibili.com/<id>` 但**没**带 `/upload/video`：默认按"抓全部投稿"处理（这与 b-claw 内部最终都拼到 `/upload/video` 一致），但**抓之前先口头确认一句**："是要抓 UP 主 `<id>` 的全部投稿吗？"
- 用户一次给了**视频 URL + UP 主链接**混合：`b-claw` 不支持同时使用 `-u/-c` 与 urls；按"用户最希望覆盖的范围"取最大集合，其余转为追加任务排队跑（不要静默丢弃）。
- 充电专属视频：`b-claw -u` 模式会**自动跳过**充电专属视频（凭 `.bili-cover-card__tag.charge-tag` 识别），日志会打印 `跳过 X 个充电专属视频`，这是设计行为，不是错误。

## 执行规范（必须遵守）

### 0. 唯一入口：Shell 启动 `b-claw`，禁止 Cursor 浏览器

B 站字幕抓取**只能**通过 Shell 在 `cpu-cli-tool` 目录执行 `b-claw` / `bilibili-transform` / `b-consume`。`b-claw` 内部会自行拉起 **Playwright + Bilibili Evolved** 专用浏览器，与 Cursor 侧浏览器无关。

**禁止**为爬取、探路、解析合集 URL、确认登录态等目的调用 **Cursor MCP 浏览器**（`cursor-ide-browser`）或 **agent-browser** skill。常见误用：用户给视频链接并说「抓对应合集」时，Agent 打开 Cursor 浏览器点合集标签找 `collectiondetail` 链接——这是多余且错误的；应直接 `b-claw -c <视频 URL> -a --first`，由 `b-claw` 读取该页侧边播放列表并从首条开始。

若确实缺少可用 URL（用户只给 BV 号、或 `-c` 报「播放列表为空」），按优先级处理：

1. 补全为 `https://www.bilibili.com/video/<BV>` 后重试 `-c`；
2. 向用户索要合集页 / 列表页链接；
3. 可用 `curl -sL` 等**命令行**从 HTML 提取链接（不启动 Cursor 浏览器）。

收到 `/bilibili-crawl` 或等价指令后，**第一步必须是映射命令并在 Shell 后台启动 `b-claw`**，而不是先开网页调研。

**Audit Hook（命令映射）**：映射决策与最终命令行写入行为日志「依据与关键输入」「关键行为」；Shell 启动前须已完成日志初始化。

### 1. cwd 必须是 `cpu-cli-tool` 项目根

`b-claw` 的产物（`downloads/MMDD-HHMMSS/`、`summarys/MMDD-HHMMSS/`）落在 `process.cwd()`。错的 cwd 会让产物散落到工作区根目录，污染 git。

```bash
cd /Users/a1111/Desktop/ai-workspace/cpu-cli-tool
```

或在 Shell 工具里设 `working_directory: "/Users/a1111/Desktop/ai-workspace/cpu-cli-tool"`。

### 2. 后台启动 + 早期 sanity check

`b-claw` 是**会自行结束**的长任务（一个 UP 主可能跑 1–2 小时），不属于 pueue 规则覆盖的"不自行结束"场景。直接用 Shell 工具的后台模式：

- `block_until_ms: 0`，让命令立即放后台。
- 启动后 **60–90 秒内回看一次**终端输出，验证以下"启动健康"信号都出现：
  - `✅ 浏览器启动成功`
  - `✅ Bilibili Evolved 已成功启用`
  - `📁 本次字幕保存目录: .../downloads/MMDD-HHMMSS`
  - `✅ 登录状态正常`
  - 至少一条 `🎬 [1/N] 打开视频页面: ...`
- 看到 `验证码` / `登录失败` / `未能找到字幕轨道` 等关键字 → **立即停下**，把现象抛给用户，不要硬跑。

**Audit Hook（后台启动与 sanity check）**：更新行为日志「关键行为」（terminal 引用、5 条健康信号逐项结论）；若阻断则写「偏离、异常与未决事项」并将状态置为 `阻断`，不封口为成功。

### 3. 错误处理：当前视频进度重试一次

`b-claw` 命令层必须具备「当前进度自恢复」能力：

- 单条视频下载、合集切换下一条 / 下一 P、UP 主单条视频处理、固定 URL 单条处理，遇到一次 Playwright / 浏览器 / 页面状态异常时，必须打印 `🔁 从当前视频进度重试`，恢复当前页面并重试同一条。
- 任何单条处理报错时，日志必须打印 `📍 当前任务批次执行进度`，并附带一行 `__B_CLAW_PROGRESS__{...}` 结构化 JSON，至少包含 `mode`、`action`、`current`、`total`、`url`；合集模式还应包含 `bvid`、`title`、`batch`。这是 skill 层后续断点重启的优先依据。
- 当前条目重试仍失败时，允许跳过该条并继续后续条目；只有「无法切换到下一条 / 下一 P」这类会阻断播放列表遍历的错误，才允许终止整轮任务。
- `-a` 模式的字幕整理失败也要重试一次；重试仍失败不得杀死主下载流程，应记录失败并让下载继续。剩余 `.ass` 后续用 `bilibili-transform` 补跑。
- Agent 层看到日志里有 `🔁 从当前视频进度重试` 时，先判断是否恢复成功；不要立刻终止任务。只有进程最终 `exit_code != 0` 或连续卡在同一进度，才进入失败处理。进入失败处理时，先搜索最后一条 `__B_CLAW_PROGRESS__`，用其中的 `url` / `bvid` / `current` / `total` 确认断点。

大合集（例如数百条视频）若反复因为 AI 整理链路 `socket hang up`、超时等问题中断，优先改为两段式：

```bash
b-claw -c "<合集或视频 URL>"
bilibili-transform
```

先完整下载 `.ass`，再统一整理，避免下载进度被分析链路拖垮。

### 4. 不要碰那个浏览器窗口

`b-claw` 用的是 **non-headless** Playwright + Bilibili Evolved 扩展。提醒用户：

- 不要关闭 / 切走那个浏览器窗口，不要在里面手动登录别的账号或换页。
- 这是预期行为，不是 bug。

### 5. 中途不轮询，靠完成通知

启动后**不要主动 AwaitShell 轮询**——让任务自己跑完，系统会发完成通知。需要给用户看进度时，告诉他：

```bash
tail -f /Users/a1111/.cursor/projects/Users-a1111-Desktop-ai-workspace/terminals/<shell_id>.txt
```

**Audit Hook（等待完成）**：收到完成通知后更新「关键行为」（`exit_code`、耗时、下载/整理成功失败计数摘要）；若出现 `🔁 从当前视频进度重试` 或 `__B_CLAW_PROGRESS__`，在「偏离、异常与未决事项」记一行断点摘要，不复制 terminal 全文。

## 完成后汇报模板

任务结束（`exit_code: 0`）后，按下面这套指标整理给用户：

```
| 指标 | 数值 |
|---|---|
| 总耗时 | 从终端 footer `elapsed_ms` 换算成分钟 |
| 字幕下载成功 / 总数 | 数 ✅ 下载完成 行数 vs 第 1..N 页累计实际处理数 |
| 字幕整理成功 / 失败 | 直接读末尾 ✅ 字幕分析完成：成功 X 个，失败 Y 个 |
| 原始整理产物 | cpu-cli-tool/summarys/MMDD-HHMMSS |
| cpu-matrix 合集 | cpu-matrix/public/docs/<合集名> |
| 预览入口 | /docs/folder/<URL encoded 合集名> |
```

**Audit Hook（交付封口）**：按上表整理指标后封口行为日志：更新顶层执行摘要、结果与验证、影响闭包；向用户汇报时附带本次行为日志 workspace-relative 路径与终态。

### 必须主动解释的"反直觉现象"

每次都要告诉用户：

> `downloads/MMDD-HHMMSS/` 在 `-a` 模式下整理完成后会**变空**（0 文件 0B），这是设计行为，不是丢失。`subtitleAnalysis` 在写完 `.md` 后会 `unlink` 原 `.ass`，并把字幕原文以 ` ```ass ``` ` 代码块**内嵌**进 `.md` 里。最终产物即 `summarys/MMDD-HHMMSS/*.md` 一份合一文件。

依据：

```cpu-cli-tool/src/commands/media/services/bilibili/prompt.ts L84-L92
const outputContent = `${result.output}\n# 字幕原文\n\n\`\`\`ass\n${subtitleContent}\n\`\`\``;
...
await writeFile(outputPath, outputContent, "utf8");
await unlink(subtitlePath);
```

## 收尾：复制到 cpu-matrix 合集

任务结束且 `summarys/MMDD-HHMMSS/` 校对无误后，必须把整理后的 `.md` 复制到 `cpu-matrix` 的单独文档合集目录，方便直接预览。

### 合集目录命名

`<合集名>` 按来源取稳定、可读的中文名：

- B 站合集：优先取合集标题；拿不到标题时用 `B站合集-<MMDD-HHMMSS>`。
- UP 主投稿：用 `B站-<UP主名或ID>`；如果是专题型 UP 主，可补充主题，如 `B站-倪海厦-健康`。
- 指定视频集合：用 `B站字幕-<主题名>`；主题名不明确时先问用户一句。
- AI 待办收藏夹：用 `B站-AI待办收藏夹-<MMDD-HHMMSS>`。

目录必须落在：

```bash
/Users/a1111/Desktop/ai-workspace/cpu-matrix/public/docs/<合集名>
```

复制命令范式：

```bash
mkdir -p "/Users/a1111/Desktop/ai-workspace/cpu-matrix/public/docs/<合集名>"
cp "/Users/a1111/Desktop/ai-workspace/cpu-cli-tool/summarys/<MMDD-HHMMSS>/"*.md \
  "/Users/a1111/Desktop/ai-workspace/cpu-matrix/public/docs/<合集名>/"
```

复制后做两个校验：

- 文件数一致：`cpu-cli-tool/summarys/<MMDD-HHMMSS>/*.md` 数量等于 `cpu-matrix/public/docs/<合集名>/*.md` 数量。
- 预览路径可解释：cpu-matrix 会自动扫描 `public/docs` 下的一级目录，合集入口是 `/docs/folder/<URL encoded 合集名>`，单篇入口是 `/docs/<合集名>/<文件名>`。

如果 cpu-matrix dev server 已在运行，提醒用户可打开对应 `/docs/folder/<合集名>` 预览；如果没运行，只给入口，不要为了预览擅自启动 dev server。

**Audit Hook（复制 cpu-matrix）**：文件数校验通过后更新「影响清单」「资源索引」（`summarys/MMDD-HHMMSS/` 与 `public/docs/<合集名>/` 路径）。

## 收尾：建议 git 提交但不擅自提交

`b-claw` 跑完会自己打一行：

> ‼️ 请立刻将下载的字幕文件提交到 git，避免后续误操作遗失！

按这个提示给用户**待运行**的命令，但**不要**在用户没说"帮我提交"时直接 `git add` + `git commit`。需要分别提示 `cpu-cli-tool` 原始整理产物和 `cpu-matrix` 预览合集：

```bash
cd /Users/a1111/Desktop/ai-workspace/cpu-cli-tool
git add summarys/<MMDD-HHMMSS>
git status
git commit -m "chore(summarys): 抓取并整理 <来源描述> <N> 条视频字幕（<MMDD-HHMMSS> 会话）"

cd /Users/a1111/Desktop/ai-workspace/cpu-matrix
git add "public/docs/<合集名>"
git status
git commit -m "docs: 导入 <来源描述> 字幕整理合集"
```

`<来源描述>` 取自实际入参，例如：
- `UP 14885306 全部投稿`
- `合集 <合集名/URL 末段>`
- `指定 <N> 条视频`

只有用户明确说"帮我提交"/"commit 一下"时才执行 `git add && git commit`。

## 失败 / 异常 → 行动

| 现象 | 行动 |
|---|---|
| 启动 90s 内仍无 `登录状态正常` 且页面 title 含"验证码" | 停下；要求用户在弹出的浏览器里**手动**完成登录/验证码，再重跑 |
| 单个视频报 `未找到字幕轨道` / `字幕下载超时` | **不是工具问题**，是该视频本身没有字幕；继续推进，最后在汇报里列出失败 BV |
| 末尾 `字幕分析失败 X 个` | 读 `summarys/MMDD-HHMMSS/` 看缺漏文件名，建议用 `bilibili-transform` 对剩余 `.ass`（如果还在 `downloads/`）补跑整理 |
| 日志出现 `🔁 从当前视频进度重试` | 这是命令层自恢复机制；先观察后续是否继续处理下一条，不要立即判失败 |
| 日志出现 `__B_CLAW_PROGRESS__` | 这是断点重启进度标记；优先解析最后一条，确认当前批次执行到哪个 URL / BV / 序号 |
| `socket hang up` / AI 整理超时 | 若主下载仍在继续，等待完成后用 `bilibili-transform` 补跑失败 `.ass`；若导致整体失败，大合集改用「先 `b-claw` 不加 `-a`，再 `bilibili-transform`」 |
| 浏览器 / 页面崩溃后停在某个进度 | 命令层应自动恢复当前页并重试一次；若最终仍 `exit_code != 0`，从最后一条 `__B_CLAW_PROGRESS__` 判断恢复点，重新跑同一命令 |
| `b-claw` 整体 `exit_code != 0` | 抓 terminal 文件最后 ~50 行原文呈现给用户，不要自行猜原因 |
| UP 主投稿页拿到 `0 个视频` | 大概率仍是登录态/风控问题；不要进入下一页循环 |

## 反例（不要这样做）

- ❌ 用 **Cursor MCP 浏览器 / agent-browser** 打开 bilibili 做爬取或「先探路再跑命令」：抓取链路唯一入口是 Shell 里的 `b-claw`；Cursor 浏览器与 `b-claw` 的 Playwright 会话分离，无法替代且易误导向（例如花时间去点合集标签，却迟迟不启动 `b-claw`）。
- ❌ 用户给「视频 URL + 对应合集」时，先去解析 `collectiondetail` 再 `-c`：多数情况下 **`b-claw -c <视频 URL>` 即可**，侧边栏播放列表就是合集枚举来源。
- ❌ 在 `ai-workspace` 根目录或 `cpu-matrix` 等其他项目里跑 `b-claw`：产物会落到错的 cwd，污染 git。
- ❌ 用 pueue 托管 `b-claw`：它是会自行结束的批处理任务，不符合 pueue"不自行结束 / 单一长驻"语义。
- ❌ 启动后立刻反复 AwaitShell 轮询：让任务自己跑，靠完成通知接续。
- ❌ 看到 `downloads/MMDD-HHMMSS/` 为空就报"字幕全丢了"：这是 `-a` 模式的设计行为，必须先去 `summarys/` 看再下结论。
- ❌ 只汇报 `cpu-cli-tool/summarys` 而不复制到 `cpu-matrix/public/docs/<合集名>`：这会导致后续无法在 cpu-matrix 里直接预览。
- ❌ 用户没说"提交"就替他 `git add` + `git commit` 上千个新文件：保留用户的最终决策权。
- ❌ 把 b-consume 当成"批量爬任意收藏夹"：它**只**消费写死的 AI 待办收藏夹（`media_id` 在源码里硬编码），不是通用收藏夹爬虫。

## 一次完整调用范式（参考）

用户："帮我把 https://www.bilibili.com/video/BV1x4cveKEag 对应合集的字幕全爬下来并整理，约 422 个视频。"

1. 识别为「视频 URL + 对应合集」→ 选 **`b-claw -c "https://www.bilibili.com/video/BV1x4cveKEag" -a --first`**（**不要**开 Cursor 浏览器探合集链接）。
2. 用 Shell 工具，`working_directory: ".../cpu-cli-tool"`，`block_until_ms: 0`，立即后台启动上述命令。
3. 60–90s 后回看 terminal，确认「启动健康」5 条信号；日志里播放列表总数应接近用户说的规模（如 422）。
4. 静默等待完成通知；收尾复制到 cpu-matrix、按汇报模板交付。

---

用户："帮我把 https://space.bilibili.com/14885306/upload/video 这个 UP 主的视频字幕全爬下来并整理。"

1. 识别为 UP 主投稿页 → 抽 ID `14885306` → 选 `b-claw -u 14885306 -a`。
2. 用 Shell 工具，`working_directory: "/Users/a1111/Desktop/ai-workspace/cpu-cli-tool"`，`block_until_ms: 0`，跑 `b-claw -u 14885306 -a`。
3. 60–90s 后回看 terminal 文件，确认"启动健康"5 条信号。
4. 静默等待完成通知；中间不打扰用户。
5. 收到完成通知 → 读 terminal 末尾 ~100 行 + `ls summarys/MMDD-HHMMSS | wc -l` 校对数量。
6. 将 `summarys/MMDD-HHMMSS/*.md` 复制到 `cpu-matrix/public/docs/<合集名>/`，并校对文件数。
7. 按汇报模板交付 `cpu-cli-tool` 原始产物、`cpu-matrix` 合集路径和预览入口。
8. 给出两个仓库各自的 `git add && git commit ...` 待运行命令，等用户决定是否执行。

## 行为日志校验

交付前对照 [references/audit-quality-standards.md](references/audit-quality-standards.md) 与 `$behavior-log-audit` 的 [validate-log.md](../behavior-log-audit/workflow/validate-log.md) 自检：

- [ ] 行为日志协议章节存在且触发点无空占位
- [ ] `references/audit-quality-standards.md` 存在且阶段行齐全
- [ ] 日志已封口或已声明审计缺口（sanity check 阻断、`exit_code != 0` 未复制等）
- [ ] 「资源索引」已链接 `summarys/` 与 `cpu-matrix/public/docs/<合集名>/`，未复制正文
