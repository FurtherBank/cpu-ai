#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def fmt_time(seconds):
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:05.2f}"


def overlap(a_start, a_end, b_start, b_end):
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def best_speaker(start, end, diar_segments):
    best = None
    best_score = 0.0
    for seg in diar_segments:
        score = overlap(start, end, seg["start"], seg["end"])
        if score > best_score:
            best = seg["speaker"]
            best_score = score
    if best:
        return best

    midpoint = (start + end) / 2
    nearest = None
    nearest_distance = float("inf")
    for seg in diar_segments:
        if midpoint < seg["start"]:
            distance = seg["start"] - midpoint
        elif midpoint > seg["end"]:
            distance = midpoint - seg["end"]
        else:
            distance = 0.0
        if distance < nearest_distance:
            nearest = seg["speaker"]
            nearest_distance = distance
    return nearest or "SPEAKER_UNKNOWN"


def segment_text_pieces(asr_segment, diar_segments):
    words = asr_segment.get("words") or []
    if not words:
        text = asr_segment.get("text", "").strip()
        start = float(asr_segment["start"])
        end = float(asr_segment["end"])
        overlaps = []
        for seg in diar_segments:
            score = overlap(start, end, seg["start"], seg["end"])
            if score > 0:
                overlaps.append(
                    {
                        "start": max(start, seg["start"]),
                        "end": min(end, seg["end"]),
                        "speaker": seg["speaker"],
                        "duration": score,
                    }
                )
        if not text or not overlaps:
            speaker = best_speaker(start, end, diar_segments)
            return [{"start": start, "end": end, "speaker": speaker, "text": text}]

        total_duration = sum(item["duration"] for item in overlaps)
        pieces = []
        cursor = 0
        text_len = len(text)
        for i, item in enumerate(overlaps):
            if i == len(overlaps) - 1:
                next_cursor = text_len
            else:
                next_cursor = cursor + round(text_len * item["duration"] / total_duration)
                remaining_items = len(overlaps) - i - 1
                next_cursor = min(next_cursor, text_len - remaining_items)
            piece_text = text[cursor:next_cursor].strip()
            cursor = next_cursor
            if piece_text:
                pieces.append(
                    {
                        "start": item["start"],
                        "end": item["end"],
                        "speaker": item["speaker"],
                        "text": piece_text,
                    }
                )
        return pieces

    pieces = []
    current = None
    for word in words:
        text = word.get("word", "")
        start = float(word.get("start", asr_segment["start"]))
        end = float(word.get("end", start))
        speaker = best_speaker(start, end, diar_segments)
        if current and current["speaker"] == speaker and start - current["end"] < 1.2:
            current["end"] = end
            current["text"] += text
        else:
            if current:
                pieces.append(current)
            current = {"start": start, "end": end, "speaker": speaker, "text": text}
    if current:
        pieces.append(current)
    return pieces


def coalesce(pieces):
    merged = []
    for piece in pieces:
        text = piece["text"].strip()
        if not text:
            continue
        if (
            merged
            and merged[-1]["speaker"] == piece["speaker"]
            and piece["start"] - merged[-1]["end"] < 2.0
        ):
            merged[-1]["end"] = piece["end"]
            merged[-1]["text"] += text
        else:
            piece = dict(piece)
            piece["text"] = text
            merged.append(piece)
    return smooth_short_turns(merged)


def meaningful_len(text):
    punctuation = "，,。.!！?？:：;；、'\"“”‘’()（）[]【】{}"
    return len("".join(ch for ch in text.strip() if ch not in punctuation))


def smooth_short_turns(turns):
    smoothed = []
    for i, turn in enumerate(turns):
        duration = float(turn["end"]) - float(turn["start"])
        tiny = duration < 0.55 or meaningful_len(turn["text"]) <= 1
        if tiny and smoothed and turn["start"] - smoothed[-1]["end"] < 0.8:
            smoothed[-1]["end"] = max(smoothed[-1]["end"], turn["end"])
            smoothed[-1]["text"] += turn["text"]
            continue
        smoothed.append(turn)
    return smoothed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asr-json", type=Path, required=True)
    parser.add_argument("--diar-json", type=Path, required=True)
    parser.add_argument("--output-md", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    args = parser.parse_args()

    asr = json.loads(args.asr_json.read_text(encoding="utf-8"))
    diar = json.loads(args.diar_json.read_text(encoding="utf-8"))
    diar_segments = diar["segments"]

    pieces = []
    for segment in asr["segments"]:
        pieces.extend(segment_text_pieces(segment, diar_segments))
    merged = coalesce(pieces)

    args.output_json.write_text(
        json.dumps({"segments": merged}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# 访谈文字稿",
        "",
        f"- ASR: `{args.asr_json.name}`",
        f"- Diarization: `{args.diar_json.name}`",
        "",
    ]
    for seg in merged:
        lines.append(
            f"**[{fmt_time(seg['start'])}-{fmt_time(seg['end'])}] {seg['speaker']}**"
        )
        lines.append("")
        lines.append(seg["text"])
        lines.append("")

    args.output_md.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {args.output_md} and {args.output_json} ({len(merged)} turns)")


if __name__ == "__main__":
    main()
