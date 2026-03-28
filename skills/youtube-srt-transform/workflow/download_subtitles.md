# 阶段二：下载字幕（yt-srt）

## 输入信息

**硬依赖**：

- 已在 `WORK_ROOT` 目录的 shell 中（`pwd` 校验）。
- `VIDEO_ID`、`LANG`（默认 `en`）。

## 目标要求

**任务**：调用本仓库注册的 `yt-srt` 命令，下载并转换出 SRT。

**核心动作**（在 `$WORK_ROOT` 下执行）：

```bash
cd "$WORK_ROOT"
yt-srt "$VIDEO_ID" --lang "$LANG"
```

若仅需人工字幕、不要自动字幕，根据 `yt-srt` 实现使用其 CLI 关闭 auto-subs 的选项（以当前 `yt-srt --help` 为准）。

**完成判定**：

- 存在文件：`$WORK_ROOT/$VIDEO_ID/source.$LANG.srt`
- 文件非空，内含时间轴与文本行。

## 异常与侧翼

- **无对应语言字幕**：尝试 `--lang en` 与其它可用语言；用 `yt-dlp --list-subs "URL"` 辅助排查（主控可手跑）。
- ** cwd 错误**：产物出现在错误父目录 → 回到阶段一移动 `VIDEO_ID` 目录或重跑并统一 cwd，并在文章中引用真实路径。
