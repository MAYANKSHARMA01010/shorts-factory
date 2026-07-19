# 02 — Architecture

**Status:** ✅ written from research · **Date:** 2026-06-22
Covers: the Claude-as-brain-via-MCP model, the native Windows shell, the MCP tool surface mapped to the OSS tools, where Claude decides vs where code owns the loop, scheduling/queue, and cost-per-video.

---

## 2.1 Mental model (read this once, everything follows)

> **Claude is the MCP _client_ — the brain that decides and writes.** **Your Windows app is a fleet of MCP _servers_ — typed tools with side effects.** Deterministic code executes everything irreversible. A **human approval gate** sits before every publish.

This inversion is the whole design. Claude does **judgment** (which span is clip-worthy and why; hooks/titles/descriptions; "is this materially varied enough to not look mass-produced?"; "does this need an AI-disclosure label?"). Code does **mechanics** (cut, render, upload). You own the **publish-approval gate**.

Why this split: it's the only configuration that is simultaneously (a) automatable enough to be a throughput edge, (b) high-quality enough to survive platform enforcement, and (c) legally defensible.

## 2.2 Recommended stack

| Layer | Choice | Why |
|---|---|---|
| **App shell / supervisor** | **Tauri 2** (Rust core + webview UI) | Tiny binary, low RAM, first-class system-tray / autostart / single-instance, clean dashboard for queue + previews + approval buttons. |
| *Shell alternative* | **Python + PySide6** | Pick this **only if** you're far more fluent in Python than Rust — gives in-process access to the mostly-Python toolbelt, at the cost of Windows packaging pain. |
| ❌ Avoid | Electron (bloat), WinUI/.NET (wrong language gravity for a Python/Node toolbelt) | |
| **Brain** | **Claude `claude-opus-4-8`** via Anthropic SDK | Manual agentic loop so you can insert the human gate at the publish boundary. Use **prompt caching** on tool defs + system prompt (~0.1× on cache reads) and adaptive thinking. |
| **Cheap bulk compute** | **LocalAI** (OpenAI-compatible) | Offload caption cleanup, draft tags, bulk TTS/LLM → keeps Claude spend tiny. |
| **Trigger / scheduler** | Windows Task Scheduler + **WinSW/nssm** service | Boot resilience for 24/7 unattended runs. |
| **State / queue** | **SQLite** | Job queue with `state`, `attempts`, `idempotency_key`, `content_hash`. |
| **Publishing** | Hand-rolled clients: **YouTube Data API v3**, **Instagram Content Publishing API**, **FB Graph Reels** | The MoneyPrinter tools auto-publish to *Chinese* platforms only — YT/IG must be built fresh. |

## 2.3 The MCP tool surface (servers the app exposes to Claude)

Each tool is a typed, deterministic function. Claude calls them; it never touches files or APIs directly.

| MCP tool | What it does | Backed by (OSS tool) |
|---|---|---|
| `ingest_source` | Pull a source video **(allow-list: owned / licensed / CC only)** | yt-dlp (owned/licensed only) / local file / FFmpeg |
| `transcribe` | Speech → timestamped transcript | faster-whisper / WhisperX |
| `find_highlights` | *(Claude reads transcript, proposes clip spans + reasons)* | **Claude judgment** (not a tool) |
| `clip` | Cut a span, reframe to vertical | FFmpeg / moviepy / LosslessCut |
| `caption` | Burn animated captions | VideoCaptioner + ffsubsync (re-sync) |
| `voiceover` | TTS narration (when needed) | LocalAI / Duix-Avatar TTS |
| `generate_broll` | Optional AI b-roll | hosted API *(or* diffusers/LTX/Wan2.2 if GPU)* |
| `avatar_present` | Synthetic/own talking-head | Duix-Avatar |
| `render` | **Deterministic** final compose (byte-identical → hashable) | **hyperframes** (HTML→MP4, built for agents) / remotion |
| `compose` | Assemble clip + captions + music + intro/outro | moviepy / FFmpeg |
| `write_metadata` | *(Claude writes title/description/hashtags per platform)* | **Claude judgment** |
| `schedule` | Enqueue for a publish slot | SQLite queue |
| `request_approval` | **Push the draft to the human gate** (tray + phone) | App UI |
| `publish_youtube` | Upload Short (+ auto AI-disclosure flag) | YouTube Data API v3 |
| `publish_reels` | Upload Reel (audio embedded pre-upload) | IG Content Publishing / FB Graph |

## 2.4 Where Claude decides vs where code owns the loop

| Claude (brain) owns | Deterministic code owns |
|---|---|
| Which spans to clip & **why** | Cutting, reframing, encoding |
| Hooks, titles, descriptions, hashtags (per platform) | Rendering (byte-identical), idempotency by `content_hash` |
| "Is each video materially varied?" / anti-mass-produced check | Upload, rate-limit accounting, retries |
| "Does this need an AI-disclosure label?" | Applying the disclosure flag mechanically |
| Prioritizing the queue | Scheduling, the state machine, error parking |

**The human (you)** owns the irreversible step: **approve → publish.** Auto-publish is unlocked only per-template, only for low-risk owned-source content, only after a template has earned trust.

## 2.5 Verified API facts to build around

- **YouTube `videos.insert`:** **1 quota unit/call** since Dec 4 2025 (older docs say 100 — wrong), with a **hard cap of 100 `videos.insert`/day**. So ~100 uploads/day is *possible* — **treat this as a trap, not a feature:** high velocity of near-identical content is the "replicable at scale" fingerprint that gets you terminated faster.
- **Instagram Content Publishing:** **100 posts / rolling 24h** (the "50" figure is stale). **Business accounts only.** You **cannot** attach in-app/trending catalog music via API — **audio must be embedded into the file pre-upload** (this also keeps you on the cleared-music-only guardrail).
- **TikTok:** public posting requires an app audit (2–4 weeks). Defer past MVP.

## 2.6 Component diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                    NATIVE WINDOWS APP ("Studio")                       │
│        Tauri (Rust core + webview UI) · system tray · SQLite           │
│  ┌──────────┐    ┌────────────┐    ┌──────────────────────────────┐    │
│  │ Task     │──▶│ Job Queue   │──▶│ Orchestrator (state machine)  │    │
│  │ Scheduler│    │ (SQLite +  │    │  "what should happen next?"  │    │
│  │ /service │    │  retries,  │    └───────────────┬──────────────┘    │
│  └──────────┘    │ idempotency)│                   │ asks for decisions │
│                  └────────────┘                    ▼                    │
│   app exposes MCP SERVERS ◀──tool calls────┌────────────────────────┐  │
│        (typed tools)                       │  CLAUDE = MCP CLIENT    │  │
│   ┌──────────────────────────────────┐     │  (claude-opus-4-8)     │  │
│   │ ingest │ transcribe │ find_       │     │  THE BRAIN: picks      │  │
│   │ highlights │ clip │ caption │     │────▶│  clips, writes copy,   │  │
│   │ voiceover │ broll │ render │      │     │  ensures variation     │  │
│   │ compose │ schedule │ publish      │     └────────────────────────┘  │
│   └────┬──────────────────┬──────────┘                                  │
│        │ shell out        │ HTTP             ⛔ HUMAN APPROVAL GATE       │
│        ▼                  ▼                  (tray UI + push to phone)   │
│  ┌──────────────────┐  ┌───────────────────────────────────────────┐   │
│  │ LOCAL OSS TOOLBELT│  │ PLATFORM PUBLISH (build yourself)         │   │
│  │ FFmpeg · moviepy ·│  │ YouTube Data API v3                       │   │
│  │ faster-whisper ·  │  │ Instagram Content Publishing API (Reels)  │   │
│  │ VideoCaptioner ·  │  │ FB Graph (Reels)                          │   │
│  │ hyperframes ·     │  │ ⚠ NOT MoneyPrinter auto-publish (→ China) │   │
│  │ LocalAI · Duix    │  │ ⚠ ingest accepts OWNED/LICENSED/CC only   │   │
│  └──────────────────┘  └───────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

## 2.7 Cost per video / per month

- **Claude orchestration: ~$0.05–$0.10 per video.** Claude only sees *text* (transcript chunk ~1–4K input + tool schemas + ~2K output reasoning) at `claude-opus-4-8` pricing ($5/1M in, $25/1M out). Prompt caching + LocalAI offload drives it lower. At 50 videos/day that's a few dollars/day. **Claude is not the cost driver.**
- **Compute floor: <$100/month** self-hosted (LocalAI TTS/LLM + CPU rendering). Marginal cost per video ≈ near-zero.
- **GPU is the only real cash cost** — and *only if* you self-host video-gen models. **Skip it for the MVP** (use stock/screen-record + captions, or a hosted API).
- **Net MVP run cost: ≈$50–$150/month** (Claude tokens + minimal compute + stock/music licenses), excluding your time.

## 2.8 Leverage notes

- **hyperframes** is explicitly *"built for agents"* (HTML→deterministic MP4) — use it as the render boundary so output is byte-identical and **content-hashable** for idempotency.
- **SamurAIGPT's "Generative-Media-Skills"** (bundled in the Open-Generative-AI repo) are Claude-Code skills for driving media models — the one genuinely reusable part of that otherwise-funnel repo.
- **ViMax** is an "agentic video generation" framework — a reference for agent-driven composition, though our design keeps Claude as the orchestrator rather than adopting its loop.

→ Tool-by-tool license/GPU/commercial flags: [`03-tool-inventory.md`](03-tool-inventory.md). Guardrails the publish path must enforce: [`04-legal-guardrails.md`](04-legal-guardrails.md).
