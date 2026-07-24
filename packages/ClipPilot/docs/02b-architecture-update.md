# 02b — Architecture Update (post code-audit)

This revision supersedes only the parts of 02 that the 32-repo + 2-new-repo code audit changed or newly confirmed. The locked decisions (3 sections A/B/C, third-party sourcing with guardrails, CPU-only MVP, human approval gate, Claude-as-brain over an MCP tool surface, SQLite job queue, YT/IG publish) all hold. The audit forces three concrete changes: (1) a new perception layer and `understand_video` MCP tool, (2) a license-safe boundary for the AGPL agentic repos, and (3) a transport decision for how the PySide6 app exposes MCP.

The audit's blunt finding: of 34 repos, **almost none are importable holistic-understanding engines**. The vast majority are video *generators* (diffusers, LTX-Video, Open-Sora, Wan2.2, AnimateAnyone, Duix, Deep-Live-Cam, video-retalking, ViMax, the MoneyPrinter family, ShortGPT, Pixelle, Open-Generative-AI) or GUI/Electron editors (lossless-cut, openshot-qt, palmier-pro) — they generate or wrap ffmpeg, they don't perceive. Real understanding capability lives in exactly four places: **OpenMontage** (Python BaseTool perception stack — AGPL), **LocalAI** (OpenAI-compatible local inference hub — MIT, Docker-only on Windows), **palmier-pro** (reference architecture — GPLv3/macOS), and **ffmpeg + moviepy** (cheap built-in signal extraction — the layer everything else feeds). That shapes everything below.

---

## 1. Revised MCP tool surface

The prior surface mapped 1:1 onto the state machine (`ingest`, `transcribe`, `find_highlights`, `clip`, `caption`, `compose`, `publish`). The audit adds one major capability tool, splits perception out of `transcribe`, and renames/merges several. Each tool below is annotated with its **verified** backing tool + integration method.

### New / changed tools

| MCP tool | Backing implementation (verified) | Integration method |
|---|---|---|
| **`understand_video`** (NEW) | Orchestrates the Video Understanding Engine (§5). Fuses transcript + scenes + keyframes + audio-energy + faces + a Claude-multimodal pass on sampled keyframes into one `VideoAnalysisBrief`. Pattern ported from OpenMontage `tools/analysis/video_analyzer.py` (`VideoAnalysisBrief`, schema at `schemas/artifacts/video_analysis_brief.schema.json`). | **library** (in-proc Python; ported, not vendored — see §2) |
| **`extract_signals`** (NEW, split from old `ingest`) | ffprobe `-of json` + ffmpeg built-in filters: `select='gt(scene,0.4)'` (shot cuts), `silencedetect`, `blackdetect`/`freezedetect`, `thumbnail`, `ebur128`/`astats` (energy curve). All zero-extra-dep, CPU, LGPL-clean. | **subprocess** (bundled `ffmpeg.exe`/`ffprobe.exe`, CPU-only static build) |
| **`transcribe`** (kept; narrowed) | faster-whisper, CPU `int8`. Confirmed identical config across MoneyPrinterTurbo (`app/services/subtitle.py`), VideoCaptioner, OpenMontage `transcriber.py`. Word-level timestamps + VAD. | **library** (faster-whisper / CTranslate2, CPU) |
| **`detect_scenes`** (NEW, was implicit) | PySceneDetect `ContentDetector` (OpenMontage `scene_detect.py`) with the ffmpeg `select` filter as a zero-dep fallback. | **library** + subprocess fallback |
| **`analyze_faces`** (NEW) | MediaPipe Face Mesh with OpenCV-Haar fallback (OpenMontage `face_tracker.py` pattern). Per-frame bbox + landmarks + head-pose. NOTE: no emotion classifier exists in any audited repo — emotion is delegated to the Claude-multimodal keyframe pass. | **library** (CPU) |
| **`embed_frames`** (NEW) | CLIP ViT-B/32, ~150–300 ms/img CPU (OpenMontage `lib/clip_embedder.py`; same recipe as palmier-pro SigLIP2). Powers text→visual highlight ranking and `search_media`. | **library** (open-clip / transformers, CPU) |
| **`find_highlights`** (kept; upgraded) | Now consumes the `VideoAnalysisBrief` (transcript + scene + energy + CLIP scores) instead of transcript-only. | **library** (ClipPilot-native scoring) |
| **`clip`** (kept) | ffmpeg `-ss/-to -c copy` lossless, or moviepy `subclipped` + `ffmpeg_extract_subclip`. | **library** (moviepy) / subprocess |
| **`caption`** (kept; merged) | moviepy `TextClip`/`SubtitlesClip` for in-proc burn-in; **optional** styled ASS/rounded-box render ported from VideoCaptioner's `ass_renderer.py`/`rounded_renderer.py` (GPL — port the filtergraph recipe, not the code; command strings aren't copyrightable). `ffsubsync` available as an optional subprocess re-sync for externally-supplied `.srt`. | **library** (moviepy) + optional subprocess |
| **`compose`** (kept) | moviepy `CompositeVideoClip`/`concatenate_videoclips` + `write_videofile` (libx264 CPU) as the **default** in-proc engine. Optional branded-render via a Node sidecar (HyperFrames / Remotion) — see §4. | **library** (moviepy) |
| **`remove_background`** (NEW, optional) | backgroundremover `bg.remove()` / `utilities.transparentvideo()` (MIT, U2-Net, CPU). Compose-stage subject cutout for faceless funnel. **Must run in a subprocess** — it calls `multiprocessing.set_start_method('spawn', force=True)` at import, which clashes with the Qt event loop. | **subprocess** (isolated) |
| **`publish`** (kept) | YT Data API + IG/FB Graph. Upload-Post API pattern (MoneyPrinterTurbo `upload_post.py`) noted as a cross-post reference. | **http** |
| **`search_media`** (NEW, optional) | CLIP-embedding cosine search over the ingested corpus (palmier-pro `search_media`/`VisualSearch.swift` blueprint, re-implemented in Python). | **library** |

### Merges / drops vs prior surface
- Old monolithic `ingest` is **split** into `extract_signals` (cheap ffmpeg signals) + the perception tools, because the audit showed these are different cost/latency classes (ffmpeg signals are ~free; CLIP/whisper are seconds-per-clip on CPU).
- **No `generate_video` / `generate_broll` tool in the MVP.** Every generation repo audited is GPU-only and/or out of locked scope. If B-roll is ever wanted, it is a hosted-API tool (fal/Replicate/Runway), never a self-hosted local tool.

---

## 2. Incorporating OpenMontage (AGPLv3) without poisoning the closed app

OpenMontage is the single best capability match — its `tools/analysis/` stack (`video_analyzer`, `transcriber`, `scene_detect`, `audio_energy`, `face_tracker`, `frame_sampler`, `clip_embedder`, `visual_qa`, `slideshow_risk`) is exactly ClipPilot's missing holistic-understanding piece, is Python, and is CPU-capable. But it is **AGPLv3** — network copyleft. Importing or vendoring it forces ClipPilot itself to AGPL. That is a dealbreaker for a closed commercial product.

**Safe pattern — port specific ideas under clean-room rules, do NOT vendor the code:**

1. **Re-implement, don't copy.** The valuable assets are *designs and schemas*, not lines of code: the `VideoAnalysisBrief` shape (a documented fusion schema), the scene-aware frame-sampling strategy, the "agent provides the visual interpretation" pattern (offload emotion/OCR to Claude-multimodal rather than a local classifier), and the 7-dimension provider scoring (`lib/scoring.py`). Re-author these in ClipPilot's own `understand` module. Schemas and algorithms aren't the licensed artifact; the AGPL source file is.
2. **The underlying libraries are independently obtainable and permissive.** OpenMontage's perception is just thin wrappers over faster-whisper (MIT), PySceneDetect (BSD), MediaPipe (Apache), open-clip/CLIP (MIT-ish), and ffmpeg ebur128. ClipPilot depends on those directly — no AGPL code path. (Note: OpenMontage does NOT pin these; ClipPilot must assemble and version-lock them itself — its `requirements.txt` lists only 6 core libs and lazy-imports the rest.)
3. **If you ever want the literal OpenMontage code unchanged, run it arms-length as a separate local service/CLI** (its own process, its own AGPL distribution, talking to ClipPilot over local HTTP/stdio) and ship its source per AGPL. This keeps the copyleft boundary at the process edge. For the MVP, **prefer the port** — the modules are small and re-authoring is cheaper than maintaining an AGPL sidecar + compliance.

**Specific ideas worth porting:** corpus-from-stock retrieval (`clip_search.py`/`corpus_builder.py` → CLIP-indexed retrieval for Section B B-roll), and the `slideshow_risk`/`verify_scene_pacing` heuristics for the approval gate. **Do NOT** port its compose layer — Remotion/HyperFrames composition is better taken from those upstream repos directly (Apache/permissive), and WhisperX captions are redundant with the faster-whisper path Phase 0 already owns.

---

## 3. Palmier-pro as reference architecture (do not depend on it)

palmier-pro is GPLv3, Swift 6.2, macOS 26 + Apple-Silicon-only, Apple-framework-bound (CoreML/AVFoundation/Speech). It **cannot run, link, or be subprocessed on Windows**, and GPLv3 forbids deriving into a proprietary app. Its value is **purely architectural** and validates ClipPilot's direction.

**Borrow these patterns (clean-room re-implementation in Python):**
- **In-app MCP-server-over-HTTP on 127.0.0.1.** palmier-pro runs `MCPHTTPServer.swift` as an `NWListener` bound to `http://127.0.0.1:19789/mcp`, localhost-only, stateless transport. This is the decisive evidence for §4 — a desktop editor app can host its own MCP server and let an external Claude (or Claude Desktop via an `mcp-remote` shim) drive the live timeline.
- **Agent-on-the-timeline UX.** Its 31 MCP tools (`search_media`, `inspect_media`, `get_transcript`, `inspect_timeline`, `add_clips`, `ripple_delete_ranges`, `add_captions`) show the right granularity: the agent inspects what the user actually sees (rendered composited frames) and an "overview storyboard grid" for the LLM. ClipPilot should expose analogous `inspect_*` tools so Claude reasons over real frames, not just metadata.
- **The perception pipeline shape:** adaptive scene-aware sampling → CLIP/SigLIP2 embeddings → cosine footage search + shot detection + ASR. This is the same pipeline §5 builds, independently confirmed by two repos (palmier-pro and OpenMontage converge on it).

ClipPilot re-implements all of this with open-clip/transformers + PySceneDetect/ffmpeg + faster-whisper. No palmier-pro bits ship.

---

## 4. Decision: app exposes MCP servers over local HTTP (127.0.0.1), not stdio

**Recommendation: HTTP on `127.0.0.1` for the app-hosted MCP surface; reserve stdio only for arms-length CLI tools.**

Rationale, grounded in the audit:
- **A long-lived PySide6 GUI is the wrong shape for stdio.** stdio MCP assumes the client spawns and owns the server process lifecycle over stdin/stdout. ClipPilot is a persistent desktop app with a Qt event loop that already owns the process; bolting stdio onto it means fighting the event loop and stdin ownership. palmier-pro — the one audited app in exactly ClipPilot's category (GUI editor + agent on timeline) — chose **local HTTP** (`127.0.0.1:19789`) precisely for this reason.
- **HTTP cleanly separates the agent transport from worker threads.** The audit repeatedly flags that perception/compose work (faster-whisper, moviepy, backgroundremover's `spawn`) must run off the GUI thread. An HTTP MCP server handler can dispatch to ClipPilot's existing SQLite-queue workers and return without blocking Qt. stdio's single byte-stream makes concurrent long jobs awkward.
- **It interops with Claude Desktop and external orchestrators via a trivial shim** — palmier-pro ships a ~Node `mcp-remote` proxy (`mcpb/server/index.js`) to bridge Claude Desktop's stdio expectation to the app's HTTP port. ClipPilot can do the same, getting both transports for free.

**Guardrails from the audit (these are real footguns seen in the corpus):** bind to `127.0.0.1` only, never `0.0.0.0` (backgroundremover's Flask server binds `0.0.0.0:5000` with an SSRF `?url=` fetch — explicitly do not copy that), use a stateless localhost transport, and keep any `run_shell`-style tool gated behind an explicit env flag (ViMax gates its shell tool behind `VIMAX_ENABLE_RUN_SHELL`).

stdio is still appropriate for **tool processes ClipPilot itself spawns** (e.g. if you ever run LocalAI's bundled `local-ai mcp-server` to let Claude drive a LocalAI sidecar's admin surface — that one is stdio by design).

---

## 5. Compute / packaging consequences from the real deps

The audit surfaces hard packaging constraints that 02 didn't account for:

**Python version: pin a 3.12 venv, not 3.14.** The understanding stack has tight upper bounds. faster-whisper/CTranslate2, MediaPipe (Windows wheels are Python-version-sensitive), and several CLIP/transformers paths are not reliably available on 3.14. VideoCaptioner pins `>=3.10,<3.13`; the MoneyPrinterTurbo family pins `>=3.11,<3.13`. **Ship ClipPilot on a pinned CPython 3.12 venv.** This is the version that satisfies every CPU perception dep simultaneously.

**ffmpeg: bundle via imageio-ffmpeg, plus a CPU-only static ffprobe.** moviepy (KEEP) pulls `imageio-ffmpeg`, which bundles an ffmpeg binary — so the moviepy in-proc path needs no system install. But `extract_signals`/`detect_scenes` need **ffprobe** and some filters (`silencedetect`, `ebur128`, `select scene`) that the bundled binary may not expose cleanly. **Bundle a prebuilt CPU-only static `ffmpeg.exe` + `ffprobe.exe`** (gyan.dev / BtbN), and stay on the **default LGPL build** — do NOT use a `--enable-gpl` build (that pulls cropdetect/x264 and flips the binary to GPL, creating a disclosure obligation for the commercial app). Do not compile the 1.8 GB FFmpeg-master C tree. OCR (`vf_ocr`) and DNN filters are OFF in standard builds — if on-screen-text OCR is needed, do it via a Python lib (pytesseract/easyocr), not a custom ffmpeg build.

**GPU tools are pushed entirely to hosted APIs.** Every generation repo (diffusers, LTX-Video, Open-Sora 52–60 GB VRAM, Wan2.2 24–80 GB, Duix, AnimateAnyone, video-retalking, Deep-Live-Cam) is dropped from the local footprint. The CPU-only MVP carries **zero torch-CUDA / flash-attn / xformers / colossalai**. The only torch in the build is the CPU wheel that faster-whisper(optional)/CLIP/MediaPipe may pull — keep it CPU-only and version-locked. Any future B-roll generation is an HTTP call to a hosted endpoint, never a local GPU dependency.

**Optional Docker/WSL2 sidecar for LocalAI.** LocalAI is the one MIT, OpenAI-compatible, CPU-capable hub covering ASR + diarization + object detection + face + VLM video understanding behind one endpoint — but its release builds **exclude Windows** (`.goreleaser.yaml` comments out `windows`; ships only macOS .dmg + Docker). So it is an **optional Docker Desktop/WSL2 sidecar**, not a core dependency. The win: same OpenAI-API client code that calls cloud Claude/Whisper can target LocalAI's `127.0.0.1:8080` for local diarization/detection/VLM. Scope it to vision/detection/face/diarization only — its ASR overlaps Phase 0. Treat it as the "scale-up perception backend" toggle, with the in-proc faster-whisper + MediaPipe + CLIP stack as the default zero-Docker path.

**Node sidecar is optional, and a license trap.** HyperFrames (Apache-2.0) and Remotion are CPU-friendly branded-render engines for the compose stage, but both are Node/Bun (no Python API → subprocess `npx` or a sidecar) and add a Node toolchain + headless-Chromium download to a Python app. **Remotion's license is the catch:** custom non-OSI, requires a paid Company License for a for-profit org >3 employees — verify before shipping Sections A/C. **Default compose stays in-proc moviepy** (MIT, CPU, no Node). Add a Node sidecar only if branded motion-graphics demand exceeds moviepy.

---

## 6. Updated component diagram (with Video Understanding Engine)

```
                          ┌──────────────────────────────────────────────┐
                          │              CLAUDE (orchestrating brain)      │
                          │   reasons over VideoAnalysisBrief + frames     │
                          └───────────────▲──────────────┬────────────────┘
                                          │ MCP (HTTP)    │ tool calls
                                          │ 127.0.0.1     ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │  ClipPilot  —  PySide6 Windows app  (CPython 3.12 venv)                        │
   │                                                                                │
   │   ┌────────────────────────┐        ┌──────────────────────────────────────┐  │
   │   │  In-app MCP HTTP server │◄──────►│  Tool surface (§1)                   │  │
   │   │  127.0.0.1, stateless   │        │  understand_video · extract_signals  │  │
   │   │  (palmier-pro pattern)  │        │  transcribe · detect_scenes ·        │  │
   │   └────────────┬───────────┘        │  analyze_faces · embed_frames ·      │  │
   │                │ dispatch            │  find_highlights · clip · caption ·  │  │
   │                ▼                     │  compose · search_media · publish    │  │
   │   ┌────────────────────────┐        └─────────────────┬────────────────────┘  │
   │   │  SQLite job queue +     │                          │                       │
   │   │  state machine          │   ingest → extract_signals → transcribe →        │
   │   │  (Phase 0, built)       │   UNDERSTAND → find_highlights → clip →           │
   │   │  worker threads         │   caption → compose → [APPROVAL GATE] → publish   │
   │   └────────────┬───────────┘                          │                       │
   │                │                                       ▼                       │
   │   ┌────────────────────────────────────────────────────────────────────────┐  │
   │   │     VIDEO UNDERSTANDING ENGINE  (NEW, in-proc, CPU)                     │  │
   │   │     ── ported from OpenMontage design, clean-room (AGPL-safe §2) ──     │  │
   │   │                                                                        │  │
   │   │   ffmpeg/ffprobe signals ─┐                                            │  │
   │   │   (scene/silence/black/   │                                            │  │
   │   │    thumbnail/ebur128)     │     ┌───────────────────────────────┐      │  │
   │   │   faster-whisper (ASR) ───┼────►│  FUSION → VideoAnalysisBrief   │      │  │
   │   │   PySceneDetect (shots) ──┤     │  scenes·pacing·transcript·     │      │  │
   │   │   MediaPipe (faces/pose) ─┤     │  faces·energy·keyframes·CLIP   │      │  │
   │   │   CLIP ViT-B/32 (embeds) ─┘     └───────────────┬───────────────┘      │  │
   │   │   keyframes ──────────────────────────────────► │ (emotion / OCR /     │  │
   │   │                                                 │  on-screen-text via  │  │
   │   │                                                 ▼  Claude-multimodal)  │  │
   │   └─────────────────────────────────────────────────────────────────────────┘ │
   │                                                                                │
   │   media engine: moviepy (KEEP, in-proc) + bundled CPU ffmpeg/ffprobe (LGPL)    │
   │   optional subprocess: backgroundremover (spawn-isolated), ffsubsync,          │
   │                        Node sidecar (HyperFrames/Remotion compose)             │
   └───────────────────────────────┬───────────────────────────────┬───────────────┘
                                    │ optional Docker/WSL2          │ HTTP (hosted)
                                    ▼                               ▼
                     ┌──────────────────────────┐     ┌──────────────────────────────┐
                     │ LocalAI sidecar (MIT)    │     │ Hosted APIs                   │
                     │ OpenAI-compatible :8080  │     │ Claude (cloud) · YT Data API ·│
                     │ diarization·detection·   │     │ IG/FB Graph · (optional)      │
                     │ face·VLM  (CPU, opt-in)  │     │ hosted GPU video-gen          │
                     └──────────────────────────┘     └──────────────────────────────┘
```

**Net changes captured:** the understanding stage is a first-class node between ingest and highlight-finding, built in-proc on CPU from permissive libs (clean-room of OpenMontage); the app hosts MCP over local HTTP (palmier-pro pattern); generation is entirely off-box (hosted APIs only); moviepy + a bundled LGPL CPU ffmpeg remain the media backbone; LocalAI is an optional Docker sidecar for scale-up perception; and the Python runtime is pinned to 3.12.