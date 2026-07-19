# ClipPilot — `src/`

Phase 0 core engine. **Standard library only — runs on your Python 3.14, nothing to install.**

## Quick start

```powershell
cd C:\Dikshant\CLAUDE\ClipPilot\src

# 1) Self-contained smoke test of the whole orchestration loop (in-memory DB):
python -m clippilot demo

# 2) Run the unit tests:
python -m unittest discover -s tests

# 3) Use the persistent queue:
python -m clippilot init
python -m clippilot enqueue --source "C:\path\podcast.mp4" --section A --rights owned --channel my_yt
python -m clippilot run                 # drives jobs to the approval gate
python -m clippilot list
python -m clippilot show 1              # job detail + event log
python -m clippilot approve 1
python -m clippilot run                 # publishes (stub) → DONE
python -m clippilot status
```

## What Phase 0 is

The **orchestration skeleton** — the part everything else hangs off:

| File | Responsibility |
|---|---|
| `clippilot/models.py` | Pipeline `Stage`s, `JobStatus`, `Section` (A/B/C), `RightsTag`, the `Job` |
| `clippilot/db.py` | SQLite schema + connection (WAL) |
| `clippilot/config.py` | Paths, `Settings`, and the **guardrail toggles** (approval gate, AI disclosure, strike tracking) |
| `clippilot/queue.py` | The job store **+ the state machine** (claim → advance → gate → publish, retries, strike pause) |
| `clippilot/runners.py` | Stage-runner registry — **Phase 0 stubs**; Phase 1 swaps in FFmpeg/Whisper/Claude |
| `clippilot/engine.py` | The worker loop a Windows service/scheduler will tick |
| `clippilot/cli.py` | Headless control + the `demo` smoke test |
| `tests/test_engine.py` | State machine, approval gate, retries, strike guardrail |

The pipeline state machine:

```
ingest → transcribe → find_highlights → clip → caption → compose → [APPROVAL gate] → publish → done
```

`find_highlights` and the metadata copy are where **Claude (the brain)** plugs in (Phase 1). `APPROVAL` is the **human gate** (default ON). `publish` is the only stage with irreversible side effects, and it enforces the **AI-disclosure** + **cleared-music** + **strike-pause** guardrails.

## What Phase 0 is NOT (yet)

No real media processing, no Claude calls, no GUI, no platform publishing — those are Phase 1+. The stubs exist so the *orchestration* is correct and tested before heavy dependencies land. See [`../docs/05-build-plan.md`](../docs/05-build-plan.md) and [`../docs/06-decisions-and-product.md`](../docs/06-decisions-and-product.md).
