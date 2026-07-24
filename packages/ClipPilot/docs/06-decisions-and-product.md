# 06 — Decisions, Product Spec & Setup Notes

**Status:** ✅ owner decisions recorded · **Date:** 2026-06-22
Supersedes the "open decisions" in `05-build-plan.md` §5.6 where they conflict.

---

## 6.1 Owner decisions (locked)

| # | Decision | Choice | Build impact |
|---|---|---|---|
| 1 | Money model | **All three, as dedicated sections** | App has 3 sections (A/B/C below) over one shared engine |
| 2 | Content sourcing | **Third-party freely** | Ingest allow-list is **NOT** hard-enforced; replaced by guardrails + warnings (see §6.3) |
| 3 | Tech stack | **Python + PySide6** (Claude's call) | Stdlib-only core now; PySide6 GUI + ML deps in a pinned venv later |
| 4 | Compute scope | **CPU-only MVP** | Heavy GPU video-gen models (Open-Sora/Wan2.2/LTX) stay OUT of MVP |

## 6.2 Product structure — three sections, one engine

All three monetization paths share the **same core engine** (ingest → transcribe → highlight (Claude) → clip → caption → compose → approval → publish). They differ in *configuration, templates, and publish targets*:

### Section A — Paid Clipping + DFY Service *(highest expected ROI)*
- **Input:** long-form source (stream/podcast/talk/client footage).
- **Flow:** transcribe → Claude finds best 20–45s spans → vertical reframe + animated captions → human approves → export or publish.
- **Monetize:** authorized paid-clipping campaigns (Whop Content Rewards) + done-for-you clients (recurring).
- **Key feature:** batch throughput + a review queue; per-campaign export presets.

### Section B — Original Faceless Funnel Channel
- **Input:** a topic/niche + your own/synthetic avatar (Duix-Avatar) and scripts.
- **Flow:** Claude writes original script → TTS/voiceover (LocalAI) → avatar/b-roll → captions → compose → approve → publish.
- **Monetize:** affiliate links / brand deals / traffic to your service — **not** ad-share.
- **Key feature:** materially-varied substance per video (anti-"mass-produced" check by Claude); auto AI-disclosure.

### Section C — Faceless Ad-Share Automation *(lowest ROI — built, with eyes open)*
- **Input:** topic/template (MoneyPrinterTurbo-style theme → short).
- **Flow:** Claude script → TTS → stock/AI visuals → captions → compose → approve → schedule/publish.
- **Monetize:** platform ad-share (honest EV ≈ low; see `01`).
- **Key feature:** highest automation, but the same approval gate + disclosure; the section UI surfaces the realistic-earnings + ban-risk warning so expectations stay honest.

> Shared services used by all three: the **job queue + state machine**, the **Claude orchestrator**, the **MCP tool layer**, the **approval gate**, the **publish clients** (YouTube/IG/FB), and the **media toolbelt** (FFmpeg/Whisper/captions/render).

## 6.3 Legal posture change — "third-party freely" (owner override)

The research recommended an **owned/licensed/CC-only ingest allow-list** as the single biggest risk-killer. The owner chose **third-party freely**. We respect that, with these **retained, default-ON guardrails** (each is a configurable toggle, defaulting to the safer state):

| Guardrail | Default | Why kept |
|---|---|---|
| **Human approval gate** before publish | ON | Protects *you* from auto-posting a strike magnet; the single best protection that isn't the allow-list |
| **Auto AI-disclosure label** | ON | Platform requirement; cheap; reduces takedown/penalty risk |
| **Copyright-strike tracker** | ON | Counts strikes per channel; **auto-pauses** publishing on a channel at 2/3 strikes (termination is 3/90-days) |
| **Transformative-edit nudge** | ON | Claude is instructed to add commentary/reframe/value, not raw re-upload — the difference between a fair-use posture and a pure rip |
| **Rights tag on each source** | ON (informational) | Every ingested source is tagged `owned`/`licensed`/`cc`/`third-party`; third-party is allowed but logged + shown in the review UI |

**Hard line (not a toggle):** **no non-consensual real-person face-swap / voice-clone.** Deep-Live-Cam stays dropped; `avatar_present` requires a synthetic/own face or a stored signed release. This is criminal-exposure territory (TAKE IT DOWN Act, state deepfake laws), not ordinary business risk.

**Honest reminder, recorded once:** monetizing third-party copyrighted clips via ad-share is the **#1 termination/DMCA path** in the whole research. The guardrails reduce but do **not** eliminate that risk — it remains the owner's accepted business/legal risk.

## 6.4 Toolchain findings (from environment probe, 2026-06-22)

| Tool | Status | Action |
|---|---|---|
| **Python** | 3.14.4 (`C:\Users\diksh\AppData\Local\Programs\Python\Python314`) | ⚠️ Bleeding-edge — PySide6/faster-whisper wheels may be missing for 3.14 |
| **pip** | 26.0.1 | OK |
| **Node** | v24.15.0 | OK (available for hyperframes/remotion later) |
| **git** | 2.53.0 | OK |
| **FFmpeg** | ❌ NOT installed | Bundle via `imageio-ffmpeg` (static binary) in Phase 1 — no manual install for owner |

**Consequences for the build:**
1. **Phase 0 core engine = standard library only** (`sqlite3`, `dataclasses`, `enum`, `pathlib`, `logging`, `json`) → runs + tests on Python 3.14 today, zero install.
2. **ML/GUI deps deferred** to a **pinned venv** (target **Python 3.12** for wheel availability) introduced when Phase 1/3 need them. A setup script will provision it.
3. **FFmpeg** resolved through `imageio-ffmpeg` (or a downloaded static build) so the pipeline is self-contained.

## 6.5 Updated build order (reflecting decisions)

1. **Phase 0 (now):** stdlib-only core — config, SQLite DB, job models, queue + state machine, CLI, tests. *(In progress.)*
2. **Phase 1:** media toolbelt (imageio-ffmpeg + faster-whisper) + MCP tool layer + Claude orchestrator (Section A clip pipeline first) + approval gate.
3. **Phase 1.5:** PySide6 shell with the 3 sections wrapping the engine.
4. **Phase 2:** deterministic render (hyperframes) + LocalAI bulk compute; Sections B & C generators.
5. **Phase 3:** publish clients (YouTube/IG/FB) + scheduler/service + strike tracker enforcement.

→ Code lives in [`../src/`](../src/). This doc is the source of truth for *why* the build looks the way it does.
