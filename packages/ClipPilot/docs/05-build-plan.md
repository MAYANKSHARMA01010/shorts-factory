# 05 — Phased Build Plan

**Status:** ✅ written from research · **Date:** 2026-06-22
The MVP-first roadmap, person-week estimates, costs, and the **decisions that gate the build**.

> **MVP definition:** own/licensed-source clipping + faceless shorts · **CPU-only** · deterministic render · **human-gated** publish to YouTube + IG. **No self-hosted GPU video-gen.**

---

## 5.1 The strategy the build serves (don't lose this)

Build a **clip/repurpose engine you steer**, fed only by **authorized sources**, monetized via **paid clipping campaigns** + **done-for-you service** — *not* a faceless ad-share money printer (see `01-feasibility-and-money-reality.md` for why). The architecture, the guardrails, and the phases below all assume this. **Phase 1 alone is enough to run a real authorized-clipping channel and earn the first dollar** — everything after it is scale and convenience.

## 5.2 Phases

| Phase | Scope | Person-weeks |
|---|---|---|
| **0 — Setup** | Tauri shell: tray, autostart, single-instance, SQLite job queue, job state machine, process supervisor (WinSW/nssm). **Start OAuth / app-review early** (IG Professional + linked FB Page, YouTube API project) — long lead time. | **2.0** |
| **1 — Minimal clip + caption + manual review** | MCP host + tool servers: `ingest_source` **(allow-list)**, `transcribe`, `clip`, `caption`, `compose` — wrapping FFmpeg / faster-whisper / VideoCaptioner. Claude orchestrator: `find_highlights`, `write_metadata`, prompt caching, manual agentic loop + **approval gate**. ✅ *This phase runs a real authorized-clipping channel.* | **4.0** |
| **2 — Deterministic render + cheap compute** | hyperframes templating (byte-identical render → `content_hash` idempotency) + LocalAI for bulk TTS/LLM. | **2.5** |
| **3 — Publish + scheduling** | YouTube Data API v3 + IG Content Publishing clients (OAuth, rate-limit accounting, idempotency, retries). Scheduler/service hardening, `NEEDS_ATTENTION` parking, push-to-phone HITL approval, end-to-end testing. | **4.5** |
| **MVP total** | | **≈ 13 person-weeks (~3 months solo)** |

**Add-ons (each largely independent):**
- FB Reels publish — **+0.5 wk**
- TikTok — **+1.0 wk** code (**+2–4 wks calendar** for the public-posting audit)
- Duix-Avatar talking-head presenter — **+1.5 wk**
- Self-hosted GPU AI b-roll — **+3–4 wks** *(recommend a hosted API instead: **+1 wk**)*

## 5.3 Per-phase acceptance criteria

- **Phase 0 done when:** app launches to tray on boot, survives a crash (supervisor restarts it), and a dummy job moves through the SQLite state machine with retries.
- **Phase 1 done when:** point it at one owned/licensed long-form video → it returns N captioned vertical clips with Claude-written titles, parked at `AWAITING_APPROVAL`. The allow-list **rejects** a non-authorized source.
- **Phase 2 done when:** the same input renders **byte-identically** twice (same `content_hash`), and bulk TTS/captions run on LocalAI with Claude spend < $0.10/video.
- **Phase 3 done when:** an approved clip publishes to YouTube + IG via official APIs with the **AI-disclosure flag set**, rate limits respected, and a failed upload retries/parks instead of double-posting.

## 5.4 Biggest schedule risks (and mitigations)

1. **OAuth / app-review friction** → start in Phase 0, before you need it.
2. **The GPU video-gen rabbit hole** → use hosted APIs; keep models out of the MVP.
3. **Packaging Python sidecars on Windows** → settle the sidecar strategy in Phase 0 (bundle a venv / PyInstaller per tool).
4. **The non-technical reality** → budget time for channel warm-up + a *gated* ramp; the code is the easy part.

## 5.5 Cost model

| Item | Cost |
|---|---|
| Claude orchestration | **~$0.05–$0.10 / video** (text-only; caching + LocalAI offload lowers it). Not the cost driver. |
| Self-hosted compute floor | **< $100 / month** (LocalAI + CPU rendering) |
| GPU video-gen | Only if self-hosting — **avoid for MVP** |
| Stock/music licenses | Variable (Epidemic/Artlist tier) |
| **Net MVP run cost** | **≈ $50–$150 / month**, excluding your time |

> The honest framing: **time + ban-risk are your real costs, not cash.**

## 5.6 ⛔ Decisions that gate the build (owner input required)

These determine whether this is worth months of your life. **The build can scaffold (Phase 0) without them, but cannot be finalized until they're answered.**

1. **Monetize the TOOL/SERVICE or the CONTENT?** *The fork that matters most.* Durable money = paid by someone with a budget (campaigns, DFY) or selling the tool — not ad-share. If you're committed to "my channel prints ad money," honest EV ≈ **$0 + a likely-terminated channel.**
2. **Legal-risk tolerance** — will you enforce the **owned/licensed/CC ingest allow-list** + the **human approval gate** (which break "100% automated")? If not, this becomes a termination generator. *There is no version that is both hands-off and survivable.*
3. **GPU budget** — buy a 24GB+ NVIDIA card + WSL2, or use hosted APIs? **For the MVP: skip GPU entirely.**
4. **Which platforms** — YouTube Shorts + FB are the only meaningful per-view payout targets (both brutal); IG = funnel to brand deals, not a payout source; TikTok needs an audit (defer). Pick **YouTube + one of {FB, IG-as-funnel}** for the MVP.
5. **Niche + geography** — a US/UK high-CPM niche (finance/tech/business) ≈ 10× a global meme channel. Decide before building; it shapes the avatar, voice, and templates.
6. **Stack fluency** — **Tauri/Rust** (leaner, more robust supervisor) vs **Python/PySide6** (in-process access to the toolbelt, faster iteration). Pick the one you'll actually ship.
7. **Will you do sales?** The two best money paths require *outbound human effort*. Compute is the easy 20%; sales + editorial judgment are the load-bearing 80%.

## 5.7 Proposed first concrete step (after decisions 1, 2, 6)

Scaffold **Phase 0** (Tauri or PySide6 shell + SQLite queue + state machine + tray) and a **single end-to-end "hello clip"**: ingest one owned file → `transcribe` → Claude picks one highlight → `clip` → `caption` → park at `AWAITING_APPROVAL`. That validates the whole Claude-as-brain-via-MCP loop on real video before any platform/API/legal surface is touched.

→ Nothing in `src/` gets built until you've reviewed docs `01`–`05` and answered the gating decisions above.
