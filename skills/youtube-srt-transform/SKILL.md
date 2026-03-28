---
name: youtube-srt-transform
description: WHAT：从 YouTube `video id` 用 `yt-srt` 下载字幕，按规范转写为忠实中文可读文章；**注意事项/常见错误/禁忌**等口播须按规则做结构化表达（加粗小节、列表、现象/对策等对偶块，不增删语义）。关键配图用 `img-upload <绝对路径>` 上传并写回 CDN 链接。WHEN：要把 YouTube 讲稿整理成带时间锚点、远程配图的 Markdown 笔记；须在已约定的 shell cwd 下调用本仓库提供的 `yt-srt`/`yt-shot`/`img-upload`，并配置 `GITEE_TOKEN`。
---

# YouTube 字幕转中文文章（含远程配图）

把 **单个** YouTube 视频的官方/自动字幕拉取到本地，在 **不删减、不篡改原意** 的前提下译为可读中文正文，对需要画面辅助理解的句段插入图床链接，形成一篇可独立阅读的 Markdown 文章。

## 全局硬约束：`cwd` 与目录契约

`yt-srt`、`yt-shot` 均把产物写在 **`process.cwd()` 下的 `./<VIDEO_ID>/`**（通过 `getJsMeta` 读取的当前工作目录，**不是** CLI 源码目录）。

执行本 Skill 时，主控必须 **在跑任何命令之前** 明确并固定 **`WORK_ROOT`**：

1. 与用户对齐：文章与 `<VIDEO_ID>/` 目录应落在哪一目录下（例如用户笔记库根、`cpu-cli-tool` 仓库根等）。
2. 在终端中 **`cd "$WORK_ROOT"`** 后，再执行 `yt-srt`、`yt-shot`、`img-upload` 以及写入文章路径的计算。

推荐路径（默认约定，可在指导中改写但须自洽）：

| 产物 | 路径 |
|------|------|
| 字幕（英文，默认） | `$WORK_ROOT/$VIDEO_ID/source.en.srt` |
| 截帧（若已生成） | `$WORK_ROOT/$VIDEO_ID/shot_*_*.jpg` |
| 中文文章 | `$WORK_ROOT/$VIDEO_ID/article.zh.md` |

若发现「字幕路径」与「当前 shell 目录」不一致，**优先修正 cwd**，不要移动已生成文件除非用户要求。

## 工作流程（主控 Agent 调度模式）

> **任务阶段规划**：使用 TodoWrite 按以下阶段创建待办项；每个阶段一项，名称与顺序与本文 **「阶段一」至「阶段七」** 一致。

### 阶段一：路径与输入确认

**执行方式**：主控执行

**指导文件**：[workflow/resolve_work_root.md](workflow/resolve_work_root.md)

**输入**：YouTube `VIDEO_ID`（11 位或 URL）；可选 `--lang`（默认 `en`）；可选是否已存在截帧。

**目标**：确定 `WORK_ROOT`、`VIDEO_ID`、`LANG`，并验证后续命令均在 `$WORK_ROOT` 下执行。

**产出**：口头或笔记中写明的三元组 `(WORK_ROOT, VIDEO_ID, LANG)`。

---

### 阶段二：下载字幕

**执行方式**：主控执行（shell）

**指导文件**：[workflow/download_subtitles.md](workflow/download_subtitles.md)

**输入**：`WORK_ROOT`、`VIDEO_ID`、语言代码。

**目标**：生成 `$WORK_ROOT/$VIDEO_ID/source.$LANG.srt`。

**产出**：磁盘上的 SRT 文件；控制台无致命错误。

---

### 阶段三：字幕转中文文章（子工作流）

**执行方式**：主控执行 **或** 委派 Subagent（长文本翻译建议委派 `generalPurpose`）

**指导文件**：[workflow/srt_to_article_zh.md](workflow/srt_to_article_zh.md)

**依据**：[references/srt-transform-rules.md](references/srt-transform-rules.md)

**输入**：`source.$LANG.srt` 全文。

**目标**：得到忠实中文、`[时码-时码]` 段落锚点、必要时 `[🖼️ …]` 占位符的 Markdown 草稿（可先在聊天中定稿再写入文件）；对字幕中的**提醒、限制、常见错误、纠错口令**按 [references/srt-transform-rules.md](references/srt-transform-rules.md) **「注意事项类内容的结构化表达」** 排版，避免混在长段散文中难以执行与回看。

**产出**：`article.zh.md` 草稿内容（尚未替换图床 URL 或已部分替换）。

---

### 阶段四：关键配图与 CDN 嵌入

**执行方式**：主控执行（shell + 编辑）

**指导文件**：[workflow/embed_images_cdn.md](workflow/embed_images_cdn.md)

**输入**：`article.zh.md` 中的 `[🖼️ …]` 标记；`$WORK_ROOT/$VIDEO_ID/` 内与时刻对应的 **绝对路径** 图片。

**目标**：对每个需配图点：若本地尚无截帧，按需 `yt-shot`；对每个文件 `img-upload`（**绝对路径**）；将返回的 URL 写入 Markdown（`![描述](url)`）。

**产出**：`article.zh.md` 终稿，无悬空 `[🖼️]`（或保留用户明确不要求配图的可选说明）。

---

### 阶段五：校验

**执行方式**：主控执行

校验清单：

- [ ] 当前终端 `pwd` 等于约定的 `WORK_ROOT` 时，`yt-srt`/`yt-shot` 的路径与文中引用一致。
- [ ] `source.$LANG.srt` 存在且文章段落时码与字幕时间线可对齐抽查，无大面积遗漏或捏造。
- [ ] 文中插图均为可访问 HTTPS URL；`img-upload` 使用的路径均为 **绝对路径**。
- [ ] 含**常见错误 / 禁忌 / 纠错**的段落已按 `srt-transform-rules.md` 做结构化，且抽查时 SRT 中仍有对应限制语与否定句支撑。
- [ ] `article.zh.md` 已保存于 `$WORK_ROOT/$VIDEO_ID/`（或与用户约定路径一致）。

任一失败则回退对应阶段修复。

---

### 阶段六：测试

**执行方式**：Subagent 委派（必须）

**subagent 配置**：类型 `generalPurpose`；`readonly`：`false`（须执行 `curl -sI`、读取本地文件路径；禁止无理由修改业务源码，仅产出测试报告）。

**派发 Prompt**：

```markdown
你是本 Skill 交付前的行为验证者。工作区应存在由「youtube-srt-transform」流程产出的文件。

## 必须执行的检查（带证据）

1. **cwd 契约**：根据用户提供的 `WORK_ROOT` 与 `VIDEO_ID`，列出绝对路径下的 `source.*.srt` 与 `article.zh.md` 是否同时存在；若用户说明了运行命令时所在目录，说明 `yt-srt` 输出目录是否与之一致。
2. **链接可用**：从 `article.zh.md` 中提取所有 `https?://` 图片 URL，对每一个使用一次 `curl -sI` 或等价方式，记录 HTTP 状态码；若 403/404 须标为失败。
3. **内容忠实度（抽样）**：任选 2 段带 `[mm:ss-mm:ss]` 的段落，回到 `source.*.srt` 对应时间段的英文原文，判断中文是否明显删减论点或添加原文没有的判断；若无法对照则写明「材料不足」。

## 执行要求

- 每个检查项必须实际执行命令或读文件，禁止仅凭推断写「通过」。
- 若所有用例通过，再额外检查：是否仍有未替换的 `[🖼️` 占位符。

## 报告格式

- 环境假设（WORK_ROOT、VIDEO_ID）
- 逐项结果 + 命令/输出摘要
- 结论：通过 / 不通过（不通过须给最小复现路径）
```

测试未通过则回退修复后重新委派。

---

### 阶段七：Skill 维护说明

本 Skill 已落盘于 `cpu-cli-tool/src/commands/youtube/.cursor/skills/youtube-srt-transform/`。业务规则变更时：

- 先改 [references/srt-transform-rules.md](references/srt-transform-rules.md) 与对应 `workflow/*.md`，再同步本文件阶段描述；勿在多处重复粘贴长规则。

## 注意事项

1. **严格遵守阶段顺序**，禁止跳过校验与测试闸门（除非用户书面放弃阶段六并记录风险）。
2. **`img-upload`** 依赖环境变量 **`GITEE_TOKEN`**；未配置则本阶段失败，须在排雷中说明。
3. 若工作区同时存在 `ai-workspace/.cursor/commands/srt-transform.md`，转换规则以本 Skill 的 `references/srt-transform-rules.md` 为准（其与该命令语义对齐）。
