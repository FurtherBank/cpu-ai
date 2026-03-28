# 阶段一：路径与输入确认

## 输入信息

**必须入参**：

- `VIDEO_ID`：11 位 ID 或包含 `v=` / `youtu.be/` 的 URL（由用户或上游任务给出）。
- `WORK_ROOT`：**用户明确希望出现 `./<VIDEO_ID>/` 的父目录的绝对路径**。若用户只说「跟上次一样」，从对话或已存在的 `…/VIDEO_ID/source.en.srt` 反推父目录。

**软上下文**：

- 默认字幕语言 `LANG=en`（对应 `source.en.srt`）。
- 若视频仅有人工中文字幕且用户要求「以中文稿为主」，可改 `LANG=zh-Hans` 等，但阶段三的「译为中文」策略需相应调整（以不曲解原意为底线）。

## 目标要求

**任务**：在任意命令执行前，固定 `WORK_ROOT` 与 `VIDEO_ID`，并 `cd "$WORK_ROOT"`。

**目标（完成判定）**：

- 能在 shell 中执行 `pwd` 显示 `WORK_ROOT`。
- `VIDEO_ID` 已规范为 11 位 ID（去掉 URL 包装）。

## 工作依据

- `yt-srt` / `yt-shot` 使用 `process.cwd()` 作为输出父目录（见 `cpu-cli-tool` 内 `getJsMeta(import.meta).cwd` 即 **Node 进程启动时的 cwd**，通常等于你在终端里 `cd` 后的目录）。
- **常见错误**：在 `ai-workspace` 根目录运行命令，却期望文件出现在 `cpu-cli-tool/pzep1Rl4XME/` → 必须 **`cd` 到 `cpu-cli-tool`（或目标父目录）再运行**。

## 产出

一段可被后续步骤复制的声明，例如：

```text
WORK_ROOT=/绝对路径/cpu-cli-tool
VIDEO_ID=pzep1Rl4XME
LANG=en
```
