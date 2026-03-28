# 阶段四：关键配图与 CDN 写回

## 输入信息

**硬依赖**：

- `article.zh.md` 中含 `[🖼️ … MM:SS …]` 占位符（或用户标出的其它一致格式）。
- `WORK_ROOT`、`VIDEO_ID`。

**工具**：

- `img-upload`：`cpu-cli-tool` 提供的命令，**第一个参数为本地文件的绝对路径**；需 `GITEE_TOKEN`。成功时 **仅 stdout 打印一行 URL**。

## 目标要求

**任务**：为每个需配图的时间点准备本地图 → 上传 → 在 Markdown 中用 CDN URL 替换占位符。

### 4.1 确保本地有图

在 **`cd "$WORK_ROOT"`** 前提下：

- 若 `$WORK_ROOT/$VIDEO_ID/` 已有 `shot_*.jpg` 且时刻匹配，直接使用。
- 否则对占位符中的时刻运行（示例）：

```bash
cd "$WORK_ROOT"
yt-shot "$VIDEO_ID" 0:33 1:05 1:21
```

`yt-shot` 输出路径形如：`$WORK_ROOT/$VIDEO_ID/shot_01_00-00-33.jpg`（以实际为准）。

### 4.2 绝对路径与上传

对每张要嵌入的图片，解析为 **绝对路径** `ABS_PATH`（可用 `realpath` 或工具 API），然后：

```bash
img-upload "$ABS_PATH"
```

从命令 **标准输出** 读取唯一一行 URL（勿包含 stderr 或日志）。

### 4.3 写回 Markdown

将占位符替换为语义等价的 Markdown 图片，例如：

```markdown
![仰卧准备：台面边缘与毛巾 — 约 0:33](https://gitee.com/.../raw/.../xxx.jpg)
```

- `alt` 文本应来自原 `[🖼️ …]` 中的描述。
- 若同一张图被多处引用，可复用同一 URL。
- 替换后删除原 `[🖼️ …]` 行，避免重复。

## 完成判定

- `article.zh.md` 内无未处理的 `[🖼️`（除非用户确认某段不需要图并删占位）。
- 所有 `![](` 或 `![` 中的 URL 来自 `img-upload` 真实输出，且路径当时基于 **绝对路径** 调用。

## 排雷

- **`img-upload` 报「本地路径必须为绝对路径」**：在 shell 中 `realpath` 再传参。
- **token 未配置**：阶段阻塞，须用户设置 `GITEE_TOKEN` 后重试。
- **cwd 导致找不到图**：确认 `yt-shot` 与文章所用 `WORK_ROOT` 为同一父目录。
