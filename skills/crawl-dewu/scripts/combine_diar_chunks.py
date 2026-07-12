#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import numpy as np
import scipy.io.wavfile
import sherpa_onnx


def chunk_index(path):
    return int(path.stem.split("_")[-1])


def cosine(a, b):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))


def read_audio(path):
    sr, data = scipy.io.wavfile.read(path)
    if data.ndim > 1:
        data = data[:, 0]
    if np.issubdtype(data.dtype, np.integer):
        data = data.astype(np.float32) / np.iinfo(data.dtype).max
    else:
        data = data.astype(np.float32)
    return sr, np.ascontiguousarray(data)


def segment_embedding(extractor, sr, audio, start, end):
    a = max(0, int(start * sr))
    b = min(len(audio), int(end * sr))
    if b <= a:
        return None
    stream = extractor.create_stream()
    stream.accept_waveform(sr, audio[a:b])
    stream.input_finished()
    if not extractor.is_ready(stream):
        return None
    emb = np.asarray(extractor.compute(stream), dtype=np.float32)
    norm = np.linalg.norm(emb)
    return emb / norm if norm > 0 else emb


def local_centroids(extractor, chunk_wav, segments, max_segments_per_speaker=8):
    sr, audio = read_audio(chunk_wav)
    grouped = {}
    for seg in segments:
        if seg["end"] - seg["start"] >= 0.8:
            grouped.setdefault(seg["speaker"], []).append(seg)
    centroids = {}
    for speaker, speaker_segments in grouped.items():
        speaker_segments = sorted(
            speaker_segments, key=lambda s: s["end"] - s["start"], reverse=True
        )[:max_segments_per_speaker]
        embeddings = [
            segment_embedding(extractor, sr, audio, seg["start"], seg["end"])
            for seg in speaker_segments
        ]
        embeddings = [emb for emb in embeddings if emb is not None]
        if embeddings:
            centroid = np.mean(embeddings, axis=0)
            norm = np.linalg.norm(centroid)
            centroids[speaker] = centroid / norm if norm > 0 else centroid
    return centroids


def choose_mapping(local, global_centroids):
    local_keys = sorted(local)
    if not global_centroids:
        return {speaker: f"SPEAKER_{i:02d}" for i, speaker in enumerate(local_keys)}
    global_keys = sorted(global_centroids)
    if len(local_keys) == 1:
        speaker = local_keys[0]
        best = max(global_keys, key=lambda g: cosine(local[speaker], global_centroids[g]))
        return {speaker: best}
    if len(local_keys) >= 2 and len(global_keys) >= 2:
        a, b = local_keys[:2]
        g0, g1 = global_keys[:2]
        score_same = cosine(local[a], global_centroids[g0]) + cosine(
            local[b], global_centroids[g1]
        )
        score_swap = cosine(local[a], global_centroids[g1]) + cosine(
            local[b], global_centroids[g0]
        )
        if score_swap > score_same:
            return {a: g1, b: g0}
        return {a: g0, b: g1}
    return {speaker: f"SPEAKER_{i:02d}" for i, speaker in enumerate(local_keys)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks-dir", type=Path, required=True)
    parser.add_argument("--diar-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--embedding-model", type=Path, required=True)
    parser.add_argument("--chunk-seconds", type=float, default=300.0)
    args = parser.parse_args()

    extractor = sherpa_onnx.SpeakerEmbeddingExtractor(
        sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=str(args.embedding_model))
    )
    global_centroids = {}
    global_counts = {}
    combined = []

    diar_files = sorted(args.diar_dir.glob("chunk_*.json"), key=chunk_index)
    for diar_file in diar_files:
        idx = chunk_index(diar_file)
        chunk_wav = args.chunks_dir / f"chunk_{idx:03d}.wav"
        data = json.loads(diar_file.read_text(encoding="utf-8"))
        segments = data["segments"]
        centroids = local_centroids(extractor, chunk_wav, segments)
        mapping = choose_mapping(centroids, global_centroids)

        for local_speaker, global_speaker in mapping.items():
            if local_speaker not in centroids:
                continue
            if global_speaker not in global_centroids:
                global_centroids[global_speaker] = centroids[local_speaker]
                global_counts[global_speaker] = 1
            else:
                n = global_counts[global_speaker]
                updated = (global_centroids[global_speaker] * n + centroids[local_speaker]) / (
                    n + 1
                )
                norm = np.linalg.norm(updated)
                global_centroids[global_speaker] = updated / norm if norm > 0 else updated
                global_counts[global_speaker] = n + 1

        offset = idx * args.chunk_seconds
        for seg in segments:
            speaker = mapping.get(seg["speaker"], seg["speaker"])
            combined.append(
                {
                    "start": round(seg["start"] + offset, 3),
                    "end": round(seg["end"] + offset, 3),
                    "speaker": speaker,
                }
            )

    combined.sort(key=lambda seg: (seg["start"], seg["end"]))
    args.output.write_text(
        json.dumps({"segments": combined}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"wrote {args.output} ({len(combined)} segments)")


if __name__ == "__main__":
    main()
