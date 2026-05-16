---
name: bilibili-crawl
description: WHAT：把"抓 B 站字幕（可选 + AI 分析）"这件事统一收口到 cpu-cli-tool 的 b-claw 命令族（b-claw / b-transform / b-consume），把任意 B 站输入（视频 URL / 合集 URL / UP 主链接或 ID / 待办收藏夹）映射成正确的命令与入参，按规范在 cpu-cli-tool 项目根后台启动、做早期 sanity check、完成后汇报产物并给出 git 提交命令。WHEN：用户提到"抓 B 站 / bilibili 字幕"、贴出 bilibili.com / space.bilibili.com 链接或 BV 号、想批量爬某个 UP 主或合集的字幕、想对已下好的 .ass 补跑分析、要消费 AI 待办收藏夹增量条目时使用；是 b-claw / b-transform / b-consume 的统一心智入口。
---

# bilibili-crawl

把"抓 B 站字幕并分析"这件事，从"凭记忆挑命令 + 凭手感拼参数"升级为**输入 → 命令族决策树 → 后台启动 → 汇报产物**的标准流程。

## 心智地图：B 站爬取的命令族

| 场景 | 命令 | 心智 |
|---|---|---|
| 抓字幕（可同时分析） | `b-claw [-a]` | **核心**：浏览器侧抓字幕，`-a` 触发"下载完成后自动分析"二合一 |
| 字幕已经下好，仅补跑分析 | `b-transform` | 扫 `cpu-cli-tool/downloads/**/*.ass` 跑 `subtitleAnalysis` 写到 `summarys/` |
| AI 待办收藏夹增量消费 | `b-consume` | 内部就是 `b-claw -a`，加上"自上次运行起新收藏的视频"增量逻辑 |

**默认偏好**：用户说"抓 B 站 xxx"且没说"只下不分析"时，**默认走 `b-claw -a`**（与本工作区历史用法一致）。仅在用户明确说"先只下，不分析" / "先看看字幕轨道是否存在"时才去掉 `-a`。

## 输入 → b-claw 入参的映射

`b-claw` 自身的接口（来自 `cpu-cli-tool/src/commands/media/b-claw.ts`）：

```text
b-claw [options] [urls...]
  -c, --collection <url>   合集页 URL
  -u, --up <id>            UP 主 ID（数字）
  -a, --analyze            下载完成后自动分析
  [urls...]                一个或多个具体视频 URL
```

按用户提供的输入形态选择映射：

| 输入形态 | 识别正则 / 判据 | 映射 |
|---|---|---|
| 视频 URL（一个或多个） | `https?://(www\\.)?bilibili\\.com/video/BV[\\w]+` | `b-claw <url1> <url2> ...` |
| 单个 BV 号（无 host） | `^BV[\\w]+$` | 自动补全为 `https://www.bilibili.com/video/<BV>`，再走视频 URL |
| UP 主投稿页 | `https?://space\\.bilibili\\.com/(\\d+)(/upload/video)?/?` | 抽取数字 ID → `b-claw -u <id>` |
| 纯 UP 主 ID（数字字符串） | `^\\d+$` | `b-claw -u <id>` |
| 合集 / 列表页 URL | 形如 `bilibili.com/.../channel/collectiondetail/...` 或合集播放页 | `b-claw -c <url>` |
| "抓我的 AI 待办收藏夹" | 用户口头点名"待办收藏夹" / "增量" | `b-consume`（不传 URL，固定 fav `media_id`） |
| 已经下好 .ass，想补跑分析 | 用户说"已经下了字幕，只跑分析" / "重跑分析" | `b-transform` |

歧义处理：

- 用户给了 `space.bilibili.com/<id>` 但**没**带 `/upload/video`：默认按"抓全部投稿"处理（这与 b-claw 内部最终都拼到 `/upload/video` 一致），但**抓之前先口头确认一句**："是要抓 UP 主 `<id>` 的全部投稿吗？"
- 用户一次给了**视频 URL + UP 主链接**混合：`b-claw` 不支持同时使用 `-u/-c` 与 urls；按"用户最希望覆盖的范围"取最大集合，其余转为追加任务排队跑（不要静默丢弃）。
- 充电专属视频：`b-claw -u` 模式会**自动跳过**充电专属视频（凭 `.bili-cover-card__tag.charge-tag` 识别），日志会打印 `跳过 X 个充电专属视频`，这是设计行为，不是错误。

## 执行规范（必须遵守）

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

### 3. 不要碰那个浏览器窗口

`b-claw` 用的是 **non-headless** Playwright + Bilibili Evolved 扩展。提醒用户：

- 不要关闭 / 切走那个浏览器窗口，不要在里面手动登录别的账号或换页。
- 这是预期行为，不是 bug。

### 4. 中途不轮询，靠完成通知

启动后**不要主动 AwaitShell 轮询**——让任务自己跑完，系统会发完成通知。需要给用户看进度时，告诉他：

```bash
tail -f /Users/a1111/.cursor/projects/Users-a1111-Desktop-ai-workspace/terminals/<shell_id>.txt
```

## 完成后汇报模板

任务结束（`exit_code: 0`）后，按下面这套指标整理给用户：

```
| 指标 | 数值 |
|---|---|
| 总耗时 | 从终端 footer `elapsed_ms` 换算成分钟 |
| 字幕下载成功 / 总数 | 数 ✅ 下载完成 行数 vs 第 1..N 页累计实际处理数 |
| 字幕分析成功 / 失败 | 直接读末尾 ✅ 字幕分析完成：成功 X 个，失败 Y 个 |
| 产物路径 | downloads/MMDD-HHMMSS（注意见下方"反直觉"）/ summarys/MMDD-HHMMSS |
```

### 必须主动解释的"反直觉现象"

每次都要告诉用户：

> `downloads/MMDD-HHMMSS/` 在 `-a` 模式下分析完成后会**变空**（0 文件 0B），这是设计行为，不是丢失。`subtitleAnalysis` 在写完 `.md` 后会 `unlink` 原 `.ass`，并把字幕原文以 ` ```ass ``` ` 代码块**内嵌**进 `.md` 里。最终产物即 `summarys/MMDD-HHMMSS/*.md` 一份合一文件。

依据：

```cpu-cli-tool/src/commands/media/services/bilibili/prompt.ts L84-L92
const outputContent = `${result.output}\n# 字幕原文\n\n\`\`\`ass\n${subtitleContent}\n\`\`\``;
...
await writeFile(outputPath, outputContent, "utf8");
await unlink(subtitlePath);
```

## 收尾：建议 git 提交但不擅自提交

`b-claw` 跑完会自己打一行：

> ‼️ 请立刻将下载的字幕文件提交到 git，避免后续误操作遗失！

按这个提示给用户**待运行**的命令，但**不要**在用户没说"帮我提交"时直接 `git add` + `git commit`：

```bash
cd /Users/a1111/Desktop/ai-workspace/cpu-cli-tool
git add summarys/<MMDD-HHMMSS>
git status
git commit -m "chore(summarys): 抓取并分析 <来源描述> <N> 条视频字幕（<MMDD-HHMMSS> 会话）"
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
| 末尾 `字幕分析失败 X 个` | 读 `summarys/MMDD-HHMMSS/` 看缺漏文件名，建议用 `b-transform` 对剩余 `.ass`（如果还在 `downloads/`）补跑分析 |
| `b-claw` 整体 `exit_code != 0` | 抓 terminal 文件最后 ~50 行原文呈现给用户，不要自行猜原因 |
| UP 主投稿页拿到 `0 个视频` | 大概率仍是登录态/风控问题；不要进入下一页循环 |

## 反例（不要这样做）

- ❌ 在 `ai-workspace` 根目录或 `cpu-matrix` 等其他项目里跑 `b-claw`：产物会落到错的 cwd，污染 git。
- ❌ 用 pueue 托管 `b-claw`：它是会自行结束的批处理任务，不符合 pueue"不自行结束 / 单一长驻"语义。
- ❌ 启动后立刻反复 AwaitShell 轮询：让任务自己跑，靠完成通知接续。
- ❌ 看到 `downloads/MMDD-HHMMSS/` 为空就报"字幕全丢了"：这是 `-a` 模式的设计行为，必须先去 `summarys/` 看再下结论。
- ❌ 用户没说"提交"就替他 `git add` + `git commit` 上千个新文件：保留用户的最终决策权。
- ❌ 把 b-consume 当成"批量爬任意收藏夹"：它**只**消费写死的 AI 待办收藏夹（`media_id` 在源码里硬编码），不是通用收藏夹爬虫。

## 一次完整调用范式（参考）

用户："帮我把 https://space.bilibili.com/14885306/upload/video 这个 UP 主的视频字幕全爬下来并分析。"

1. 识别为 UP 主投稿页 → 抽 ID `14885306` → 选 `b-claw -u 14885306 -a`。
2. 用 Shell 工具，`working_directory: "/Users/a1111/Desktop/ai-workspace/cpu-cli-tool"`，`block_until_ms: 0`，跑 `b-claw -u 14885306 -a`。
3. 60–90s 后回看 terminal 文件，确认"启动健康"5 条信号。
4. 静默等待完成通知；中间不打扰用户。
5. 收到完成通知 → 读 terminal 末尾 ~100 行 + `ls summarys/MMDD-HHMMSS | wc -l` 校对数量 → 按汇报模板交付。
6. 给出 `git add summarys/MMDD-HHMMSS && git commit ...` 的待运行命令，等用户决定是否执行。
