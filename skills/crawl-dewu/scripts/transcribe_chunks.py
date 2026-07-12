#!/usr/bin/env python3
import argparse
import json
import re
import time
from pathlib import Path

import mlx_whisper


CHUNK_RE = re.compile(r"chunk_(\d+)\.wav$")


def offset_segment(segment, offset):
    segment = dict(segment)
    segment["start"] = float(segment["start"]) + offset
    segment["end"] = float(segment["end"]) + offset
    if "words" in segment and segment["words"]:
        segment["words"] = [
            {
                **word,
                "start": float(word["start"]) + offset,
                "end": float(word["end"]) + offset,
            }
            for word in segment["words"]
        ]
    return segment


def chunk_index(path):
    match = CHUNK_RE.search(path.name)
    if not match:
        raise ValueError(f"Unexpected chunk name: {path.name}")
    return int(match.group(1))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks-dir", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--checkpoint-dir", type=Path, required=True)
    parser.add_argument("--model", default="mlx-community/whisper-large-v3-turbo")
    parser.add_argument("--chunk-seconds", type=float, default=300.0)
    parser.add_argument("--language", default="zh")
    parser.add_argument("--word-timestamps", action="store_true")
    args = parser.parse_args()

    args.checkpoint_dir.mkdir(parents=True, exist_ok=True)
    chunk_paths = sorted(args.chunks_dir.glob("chunk_*.wav"), key=chunk_index)
    combined = {"text": "", "segments": [], "language": args.language}

    for chunk_path in chunk_paths:
        idx = chunk_index(chunk_path)
        checkpoint = args.checkpoint_dir / f"{chunk_path.stem}.json"
        if checkpoint.exists():
            result = json.loads(checkpoint.read_text(encoding="utf-8"))
            print(f"reuse {chunk_path.name}", flush=True)
        else:
            started = time.time()
            print(f"transcribe {chunk_path.name}", flush=True)
            result = mlx_whisper.transcribe(
                str(chunk_path),
                path_or_hf_repo=args.model,
                language=args.language,
                word_timestamps=args.word_timestamps,
                verbose=False,
                condition_on_previous_text=True,
                temperature=0,
            )
            checkpoint.write_text(
                json.dumps(result, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(
                f"done {chunk_path.name} in {time.time() - started:.1f}s",
                flush=True,
            )

        offset = idx * args.chunk_seconds
        combined["text"] += result.get("text", "")
        combined["segments"].extend(
            offset_segment(segment, offset) for segment in result.get("segments", [])
        )

    args.output_json.write_text(
        json.dumps(combined, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"wrote {args.output_json} ({len(combined['segments'])} segments)",
        flush=True,
    )


if __name__ == "__main__":
    main()
