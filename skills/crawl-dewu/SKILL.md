---
name: crawl-dewu
description: WHAT：把已下载或可下载的长视频/访谈视频，按高性价比本地开源方案转成高准确中文文字稿：提取音频、分块 ASR、说话人分离、合并原始字幕、再用子任务精修为可读对话稿或完整文章。WHEN：用户给出本地 .mp4/.mov/.mkv/.wav/.mp3 文件、下载目录视频、或视频 URL，要求“语音转文字”“访谈转文字稿”“区分不同人在讲话”“整理成文章/对话稿/分段稿”“从原始字幕还原完整文章”时使用。
---

# crawl-dewu

把长视频转写任务收口成一条可复用流水线：**视频来源确认 → 音频标准化 → 小样本校准 → 全量 ASR → 说话人分离 → 合并原始字幕 → 子任务精修 → 质量验收**。

## 适用边界

- 优先处理中文访谈、播客、圆桌、课程、直播回放等长音视频。
- 默认目标是高准确率、可读、可复查，不追求最快。
- 默认使用本地开源链路：`ffmpeg`、`mlx-whisper`、`sherpa-onnx`、3D-Speaker/pyannote segmentation 模型。
- 若用户只要“原始字幕”，停在合并后的 speaker-labeled Markdown/JSON；若用户要“文章/对话稿”，继续执行精修阶段。
- 若视频涉及 3 人及以上，先用 5-10 分钟样本估计说话人数，再设置 `--num-speakers`；不要盲目固定为 2。

## 工作目录

为每个输入创建独立目录，避免污染下载目录：

```bash
mkdir -p ~/Downloads/<video-stem>-transcript
cd ~/Downloads/<video-stem>-transcript
```

保留这些核心产物名，便于后续排查：

```text
audio_16k_mono.wav
chunks/
diar_chunks_120/
chunk_asr/
diar_out_120/
full_asr.json
full_diar.json
final_transcript_speaker_labeled.json
final_transcript_speaker_labeled.md
polished_dialogue_transcript.md
polished_dialogue_transcript_segmented.md
```

## 环境准备

先确认基础工具：

```bash
ffmpeg -version
python3 --version
```

在工作目录建独立 Python 环境：

```bash
uv venv
source .venv/bin/activate
uv pip install mlx-whisper sherpa-onnx numpy scipy
```

优先复用本机已下载模型；没有时再下载。常用组合：

```text
ASR: mlx-community/whisper-large-v3-turbo
Diarization segmentation: sherpa-onnx-pyannote-segmentation-3-0
Speaker embedding: 3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx
```

Apple Silicon 上优先用 `mlx-whisper`。若机器不是 Apple Silicon 或 MLX 不可用，改用 `faster-whisper`/`whisper.cpp`，但仍保留同样的产物结构与验收口径。

## 来源处理

本地文件：

```bash
ln -s /absolute/path/to/video.mp4 source.mp4
```

URL：

```bash
yt-dlp -o "source.%(ext)s" "<url>"
```

提取标准音频：

```bash
ffmpeg -y -i source.mp4 -vn -ac 1 -ar 16000 audio_16k_mono.wav
```

获取时长：

```bash
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 audio_16k_mono.wav
```

## 小样本校准

先切 5 分钟样本，验证 ASR 与说话人分离是否可用：

```bash
ffmpeg -y -i audio_16k_mono.wav -t 300 sample_5m.wav
```

跑一次 ASR 样本：

```bash
python - <<'PY'
import json, mlx_whisper
r = mlx_whisper.transcribe(
    "sample_5m.wav",
    path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
    language="zh",
    word_timestamps=True,
    temperature=0,
)
open("sample_asr.json", "w", encoding="utf-8").write(json.dumps(r, ensure_ascii=False, indent=2))
PY
```

人工快速检查：

- 中文识别是否稳定。
- 是否存在明显重复、幻觉、长段漏识别。
- 嘉宾/主持人专名是否能从上下文判断。
- 估计说话人数，记录到后续 `--num-speakers`。

样本不合格时先调整模型、音频或参数，不要直接跑全量。

## 全量转写

切 ASR 分块，默认 5 分钟一块：

```bash
mkdir -p chunks chunk_asr
ffmpeg -y -i audio_16k_mono.wav -f segment -segment_time 300 -c copy chunks/chunk_%03d.wav
python /Users/a1111/Desktop/ai-workspace/.cursor/skills/crawl-dewu/scripts/transcribe_chunks.py \
  --chunks-dir chunks \
  --checkpoint-dir chunk_asr \
  --output-json full_asr.json \
  --word-timestamps
```

说明：

- `chunk_asr/*.json` 是断点缓存；中断后可重跑。
- `word_timestamps` 会慢一些，但能显著提升后续说话人合并质量。
- 访谈类中文默认保留 `temperature=0`，减少自由发挥。

## 说话人分离

切 diarization 分块，默认 120 秒一块，便于降低内存和长音频漂移：

```bash
mkdir -p diar_chunks_120 diar_out_120
ffmpeg -y -i audio_16k_mono.wav -f segment -segment_time 120 -c copy diar_chunks_120/chunk_%03d.wav
```

找到 `sherpa-onnx` 自带的 diarization 运行脚本，常见路径类似：

```bash
python - <<'PY'
import pathlib, sherpa_onnx
root = pathlib.Path(sherpa_onnx.__file__).resolve().parent
for p in root.rglob("run_speaker_diarization.py"):
    print(p)
PY
```

运行分块 diarization：

```bash
python /Users/a1111/Desktop/ai-workspace/.cursor/skills/crawl-dewu/scripts/diarize_chunks.py \
  --chunks-dir diar_chunks_120 \
  --output-dir diar_out_120 \
  --run-script <run_speaker_diarization.py> \
  --segmentation-model models/sherpa-onnx-pyannote-segmentation-3-0/model.onnx \
  --embedding-model models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx \
  --num-speakers 2 \
  --parallel 2
```

合并分块 speaker 标签：

```bash
python /Users/a1111/Desktop/ai-workspace/.cursor/skills/crawl-dewu/scripts/combine_diar_chunks.py \
  --chunks-dir diar_chunks_120 \
  --diar-dir diar_out_120 \
  --output full_diar.json \
  --embedding-model models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx \
  --chunk-seconds 120
```

## 合并原始字幕

把 ASR segment 与 diarization segment 按时间重叠合并：

```bash
python /Users/a1111/Desktop/ai-workspace/.cursor/skills/crawl-dewu/scripts/merge_transcript.py \
  --asr-json full_asr.json \
  --diar-json full_diar.json \
  --output-json final_transcript_speaker_labeled.json \
  --output-md final_transcript_speaker_labeled.md
```

检查原始稿：

```bash
rg -n 'SPEAKER_UNKNOWN|^[[:space:]]*$' final_transcript_speaker_labeled.md | head
rg -n '\[[0-9]{2}:[0-9]{2}:' final_transcript_speaker_labeled.md | head
```

如果说话人频繁错位，回到小样本阶段重新确认 `--num-speakers`，或缩短 diarization 分块再跑。

## 精修为对话稿或文章

长稿不要一次性塞给一个模型。按自然时间顺序切成 8-12 个块，使用 subagent 并行精修，每个块只改本块，最后由主 agent 合并和全局校对。

每个 subagent 的任务必须包含：

```text
目标：把自动转写块整理成准确、易读的中文对话文字稿。

输出格式：
说话人A：……

说话人B：……

规则：
- 使用简体中文。
- 不保留时间戳，不保留 SPEAKER_00/01。
- 自动 speaker 标签可能错误，必须按上下文判断说话人。
- 恢复正常标点、断句、分段；语气词可保留，但不要让段落过碎。
- 可合并同一说话人的连续短句。
- 对明显 ASR 错字做保守修正，但不要改写观点，不要新增事实。
- 对无法确定的词，不要编造；保留最接近原文的表达。
- 片头摘录或非正式开场如存在，可写成 `片头摘录：……`。
```

若已知真实人名、节目名、品牌名、作品名，必须在 prompt 中列出“常见专名修正”。例如：

```text
托布花/脫不花 -> 脱不花
嘉伟/甲伟 -> 贾伟
常谈/長談 -> 《长谈》
```

合并后做全局校对：

```bash
rg -n 'SPEAKER|\[[0-9]{2}:|托布花|脫不花|嘉偉|甲伟' polished_dialogue_transcript.md
awk 'NF && $0 !~ /^#/ && $0 !~ /^片头摘录：/ && $0 !~ /^[^：]{1,16}：/ {print NR ":" $0}' polished_dialogue_transcript.md | head -20
```

## 按话题分段

用户要求“完整文章”或“易读格式”时，在精修稿基础上插入话题小标题：

- 标题只描述话题，不使用编号。
- 按一段时间内集中讨论的主题分段，不按固定分钟数机械切。
- 保留原对话顺序和说话人前缀。
- 不为每个小问题都加标题，优先 10-20 个中等粒度主题。

输出到新文件，不覆盖原稿：

```text
polished_dialogue_transcript_segmented.md
```

## 验收口径

交付前必须确认：

- 有原始可追溯产物：`final_transcript_speaker_labeled.json` 与 `.md`。
- 有可读交付稿：`polished_dialogue_transcript.md`，必要时还有分段版。
- 正文没有残留时间戳、`SPEAKER_00/01`、`SPEAKER_UNKNOWN`。
- 每个正文段落都有说话人前缀或明确的 `片头摘录：`。
- 专名和高频错字做过全局搜索。
- 未把不确定内容改写成确定事实。
- 原始稿和精修稿都保留，便于用户追溯。

## 汇报模板

交付时简洁说明：

```text
已完成：
- 原始带时间/说话人稿：<path>
- 精修对话稿：<path>
- 分段可读版：<path>

质量检查：
- 无 SPEAKER/timestamp 残留
- 无未标注说话人的正文段落
- 专名已按全局规则检查
```
