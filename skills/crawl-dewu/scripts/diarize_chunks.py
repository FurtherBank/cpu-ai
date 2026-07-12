#!/usr/bin/env python3
import argparse
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def chunk_index(path):
    return int(path.stem.split("_")[-1])


def run_one(args, chunk_path):
    out = args.output_dir / f"{chunk_path.stem}.json"
    if out.exists():
        return f"reuse {chunk_path.name}"
    cmd = [
        sys.executable,
        str(args.run_script),
        str(chunk_path),
        "--output",
        str(out),
        "--segmentation-model",
        str(args.segmentation_model),
        "--embedding-model",
        str(args.embedding_model),
        "--num-speakers",
        str(args.num_speakers),
        "--num-threads",
        str(args.num_threads),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    return f"done {chunk_path.name}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--run-script", type=Path, required=True)
    parser.add_argument("--segmentation-model", type=Path, required=True)
    parser.add_argument("--embedding-model", type=Path, required=True)
    parser.add_argument("--num-speakers", type=int, default=2)
    parser.add_argument("--num-threads", type=int, default=4)
    parser.add_argument("--parallel", type=int, default=2)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    chunks = sorted(args.chunks_dir.glob("chunk_*.wav"), key=chunk_index)
    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = [pool.submit(run_one, args, chunk) for chunk in chunks]
        for future in as_completed(futures):
            print(future.result(), flush=True)


if __name__ == "__main__":
    main()
