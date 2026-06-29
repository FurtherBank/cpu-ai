---
name: autoresearch
description: Let an AI agent autonomously iterate on a single-GPU LLM training script overnight while you sleep.
---

# karpathy/autoresearch

> Let an AI agent autonomously iterate on a single-GPU LLM training script overnight while you sleep.

## What it is

autoresearch is a minimal autonomous ML research loop: an AI coding agent (Claude, Codex, etc.) is given a real GPT pretraining setup and told to keep modifying it, training for 5 minutes, measuring `val_bpb`, and keeping changes that improve the metric. The human's only interface is `program.md` — a Markdown file of instructions for the agent. You never touch the Python. The repo is a deliberate research substrate, not a library; its value is the tight feedback loop and the opinionated fixed-budget evaluation protocol.

## Mental model

- **`train.py`** — the single file the agent edits. Contains the GPT model, Muon+AdamW optimizer, and training loop. Everything in it is fair game: architecture, hyperparameters, batch size, attention patterns.
- **`prepare.py`** — fixed constants and one-time utilities: downloads FineWeb data, trains a BPE tokenizer, defines `MAX_SEQ_LEN`, `EVAL_TOKENS`, and the dataloader. The agent does not touch this.
- **`program.md`** — your "research org code". This is what you iterate on as a human: it gives the agent its goal, constraints, and strategy. Think of it as a system prompt that grows over time.
- **`val_bpb`** — the single evaluation metric (validation bits per byte). Vocab-size-independent, so architectural changes remain fairly comparable. Lower is better.
- **Fixed 5-minute wall-clock budget** — every experiment runs for exactly 5 minutes (excluding startup/compilation), making all runs directly comparable regardless of what the agent changed. Expect ~12 experiments/hour.
- **Agent loop** — modify `train.py` → run training → read `val_bpb` → keep or discard → repeat. No orchestration framework needed; you just point your agent at the repo.

## Install

Requires a single NVIDIA GPU (H100 tested), Python 3.10+, and [uv](https://docs.astral.sh/uv/).

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
git clone https://github.com/karpathy/autoresearch && cd autoresearch
uv sync
uv run prepare.py        # one-time: downloads data, trains tokenizer (~2 min)
uv run train.py          # verify setup: single 5-min training run
```

Then open your AI agent in the repo directory, disable all permissions except file editing, and prompt it:

```
Have a look at program.md and let's kick off a new experiment!
```

## Core API

There is no importable Python API — the project is a script-based research loop. The public surface is the set of **tunable constants** in each file.

**In `prepare.py` (constants — human tunes, not the agent):**
```
MAX_SEQ_LEN      # context length for training sequences
EVAL_TOKENS      # tokens used for validation loss computation
```

**In `train.py` (agent's playground — all defaults are starting points):**
```
DEPTH            # primary model complexity knob; most other dims are functions of this (default: 8)
TOTAL_BATCH_SIZE # gradient accumulation target, keep as power of 2 (default: ~2^17)
DEVICE_BATCH_SIZE# per-step microbatch size
WINDOW_PATTERN   # attention pattern string, e.g. "SSSL" (banded) or "L" (full)
val_bpb          # the metric printed at end of run; this is what the agent optimizes
```

**Evaluation output the agent reads:**
```
val_bpb: <float>   # printed to stdout at end of training; lower = better
```

## Common patterns

**`basic-agent-kickoff` — minimal prompt to start an autonomous session**
```
Have a look at program.md. Read the current train.py and note the baseline val_bpb.
Run one experiment: propose one change, apply it, run train.py, compare val_bpb,
keep the change if it improves, revert if not. Log the result.
```

**`manual-single-run` — run one training experiment directly**
```bash
uv run train.py 2>&1 | tee experiment_$(date +%s).log
grep val_bpb experiment_*.log
```

**`smaller-compute-tuning` — adapt for a laptop/small GPU (modify prepare.py constants)**
```python
# In prepare.py — lower before running prepare.py
MAX_SEQ_LEN = 256        # was 1024 or higher
EVAL_TOKENS = 1_000_000  # was much larger

# In train.py — lower for smaller hardware
DEPTH = 4                # was 8
TOTAL_BATCH_SIZE = 2**14 # was 2**17
WINDOW_PATTERN = "L"     # drop banded attention; "SSSL" is slow on small GPUs
```

**`tinystories-dataset` — swap to lower-entropy data for small models**
```python
# In prepare.py, replace the FineWeb download with:
# dataset: karpathy/tinystories-gpt4-clean from HuggingFace
# Lower vocab_size in train.py to 1024–4096 to match simpler data
```

**`experiment-log-review` — parse overnight results from logs**
```bash
grep "val_bpb" *.log | sort -t: -k3 -n | head -20
# Find the best experiment, inspect its train.py diff via git log
```

**`program-md-iteration` — structure for improving your research org instructions**
```markdown
# program.md additions to consider:
- Add explicit "do not change X" constraints
- Add a running history of what has/hasn't worked
- Add hypotheses for the agent to test next session
- Add evaluation criteria beyond val_bpb (e.g., sample quality checks)
```

**`check-experiment-count` — estimate overnight throughput**
```bash
# ~12 experiments/hour * 8 hours = ~96 experiments
# Each run is exactly 5 min wall clock (excluding torch compile startup)
# Budget accordingly when choosing how many agents to run
```

## Gotchas

- **torch compile adds startup time that does NOT count toward the 5-minute budget** — wall-clock timing starts after compilation. First run will feel slower than subsequent ones. This is by design.
- **Results are not cross-platform comparable.** The 5-minute budget means `val_bpb` is optimal for *your* GPU at *your* clock speed. Don't compare H100 results against RTX 3090 results.
- **`WINDOW_PATTERN = "SSSL"` (default) uses banded/sliding-window attention** which requires CUDA kernels that may be unavailable or extremely slow on non-H100 hardware. If you're on a consumer GPU, switch to `"L"` immediately or you'll burn most of your budget on inefficient attention.
- **`prepare.py` is not meant to be touched** — but its constants (`MAX_SEQ_LEN`, `EVAL_TOKENS`) *do* need to be tuned before the first run when adapting to smaller hardware. This is a human-only, one-time operation.
- **The agent can break `train.py` entirely** — a syntax error or OOM crash means no `val_bpb` is produced. Your `program.md` should instruct the agent to verify the script runs before declaring an experiment complete.
- **No experiment versioning is built in.** Add explicit git commit instructions to `program.md` or you'll lose the trail of what changes were kept.
- **`uv` is required** — the project uses `uv` workspaces and a custom PyTorch index for CUDA 12.8. Trying to install with plain `pip` will likely grab the wrong torch build.

## Version notes

This repo was created in early 2026 (per README datestamp). As of creation, `torch==2.9.1` with CUDA 12.8 (`cu128`) is pinned — this is newer than most training-data cutoffs for LLMs. The `kernels` package (`>=0.11.7`) and `rustbpe` are also recent additions unlikely to appear in LLM training data. The `WINDOW_PATTERN` banded attention feature and Muon optimizer integration are novel design points not present in older nanochat versions.

## Related

- **[karpathy/nanochat](https://github.com/karpathy/nanochat)** — parent repo; full platform support (MPS, CPU, AMD), Flash Attention 3 fallbacks. autoresearch is a stripped-down single-GPU fork.
- **Alternatives:** [DSPy](https://github.com/stanfordnlp/dspy) for prompt optimization loops; [AutoML/NAS frameworks](https://github.com/automl/auto-sklearn) for hyperparameter search — but those don't give an agent free-form code editing.
- **Depends on:** PyTorch 2.9.1 (cu128), `kernels`, `rustbpe`, `tiktoken`, `uv` package manager.
- **Notable forks for other platforms:** `miolini/autoresearch-macos` (MPS), `trevin-creator/autoresearch-mlx` (MLX), `jsegov/autoresearch-win-rtx` (Windows), `andyluo7/autoresearch` (AMD).
