# 03 — Tool Due-Diligence (code-verified)

This document is the code-verified, conservative integration call on all 32 audited repos in `C:\Dikshant\Money making\`. Every verdict reconciles audit disagreements toward the **verified / conservative** position: if a license is copyleft, it blocks closed-source distribution unless run arms-length; if compute is GPU-mandatory, it fails the locked CPU-only MVP; if a repo only *generates* video, it cannot satisfy the new holistic-understanding requirement.

**Locked constraints applied as filters:** native Windows + Python/PySide6; CPU-only MVP, no self-hosted GPU video-gen; Claude-as-MCP-brain; human approval gate; commercial closed-source for-profit distribution (Sections A/B/C).

---

## KEEP

These are non-negotiable or de-facto-standard building blocks. All three are CPU-only, Windows-native, permissive, and directly drive the locked `clip → caption → compose` pipeline.

| Tool | License (commercial?) | Windows? | Compute | Integration method | Concrete ClipPilot role |
|---|---|---|---|---|---|
| **FFmpeg-master** (FFmpeg 8.0) | LGPL v2.1 default — **yes**, if you bundle a default (non-`--enable-gpl`) build and avoid x264/x265/GPL filters | Yes (ship prebuilt CPU static .exe; do NOT compile the 1.8GB C tree) | CPU-only | subprocess-cli (`ffmpeg.exe`/`ffprobe.exe`) | Core media backbone: drives clip/reframe/caption/compose/loudnorm + `ffprobe -of json` ingest metadata. For holistic-understanding it is the **cheap-signal + frame-extraction layer**: built-in scene-cut (`select='gt(scene,0.4)')`, `silencedetect`, `blackdetect`, `freezedetect`, `thumbnail`, `ebur128` give Claude pacing/shot-boundaries/energy/keyframes at zero extra cost. Not itself semantic (no ASR/face/emotion). |
| **moviepy-master** (v2.2.0) | MIT — **yes** | Yes (bundles ffmpeg via `imageio-ffmpeg`) | CPU-only (default libx264; nvenc is opt-in passthrough only) | import-as-library (in-process Python) | Primary in-process clip/caption/compose engine: `VideoFileClip.subclipped()` to cut highlights, `vfx.Crop/Resize` to reframe 9:16, `TextClip`/`SubtitlesClip`+`CompositeVideoClip` to burn captions, `write_videofile()` for the approval-gate preview. `iter_frames()` is the hand-off point feeding numpy RGB frames to perception models; `detect_scenes()` is a crude built-in shot signal. |

> Note: only **two** repos are unconditional KEEPs. FFmpeg and MoviePy together cover the deterministic media spine. Everything that adds *understanding* is OPTIONAL (below) because each carries a license, platform, or porting caveat — none is a clean drop-in.

---

## OPTIONAL

Worth keeping under specific conditions. Sorted by value to the **new holistic-understanding** requirement first, then compose/caption utilities.

| Tool | License (commercial?) | Windows? | Compute | Integration method | Concrete ClipPilot role |
|---|---|---|---|---|---|
| **OpenMontage** | **AGPLv3 — conditional** (copyleft blocks closed-source; port modules w/ legal review, do NOT vendor whole repo) | Yes | CPU-only for the high-value perception tools (video_analyzer, transcriber, scene_detect, audio_energy CPU; CLIP ~150-300ms/img CPU). BLIP-2/LLaVA want GPU. | import-as-library / **port selected modules** | **The single best donor for the holistic-understanding stage.** `video_analyzer.py` fuses transcript + scenes + keyframes + audio-energy + faces into one `VideoAnalysisBrief` (ready-made schema). Plus faster-whisper ASR, PySceneDetect, MediaPipe faces, ffmpeg ebur128 energy, CLIP embeddings, slideshow-risk. Port these into ClipPilot's tool layer; supply Claude-multimodal for the emotion/OCR/music-genre gaps it lacks. |
| **LocalAI** | MIT — **yes** (model weights carry own licenses) | **No native** (Docker/WSL2 sidecar only) | CPU paths per-backend; large VLMs slow on CPU | http-service (OpenAI-compatible) + bundled stdio MCP | Self-hosted perception hub: POST frames+audio to `/v1/audio/transcriptions`, `/v1/audio/diarization`, `/v1/detection` (objects/faces), and a CPU VLM via `/v1/chat/completions` for scene/emotion/on-screen-text per keyframe. OpenAI-API-compatible so the cloud-Claude client code retargets cleanly. Heavy multi-service dep — scope to vision/detect/face/diarization, not re-doing ASR. |
| **hyperframes-main** | Apache-2.0 — **yes** | Rough (headless Chrome + ffmpeg + whisper.cpp build) | CPU-friendly | subprocess-cli (Node/Bun) | Agent-native branded HTML→MP4 composer for caption/compose stage: kinetic captions, overlays, beat-synced music to deterministic MP4. `transcribe` (whisper word timestamps) + `remove-background` (u2net) usable as standalone CPU helpers. No Python API; contributes nothing to understanding. |
| **remotion-main** (v4.0.481) | **Custom "Remotion License" — conditional** (free ≤3 employees; for-profit >3 MUST buy Company License; leaf `@remotion/captions`+`@remotion/mcp` are MIT) | Yes | CPU-friendly | subprocess-cli (Node/React) | Optional compose engine: `npx remotion render` to burn animated captions and assemble templated 9:16 shorts. whisper.cpp wrapper could power transcribe. Zero understanding. Verify Company License before shipping Sections A/C. |
| **VideoCaptioner-master** | **GPL-3.0 — conditional** (subprocess boundary only; never import; distributing the GPL binary still has obligations) | Yes | CPU-friendly | subprocess-cli | Captioning/subtitle stage: faster-whisper/whisper-cpp local ASR (avoid its reverse-engineered Chinese cloud ASRs), LLM optimize/translate, polished FFmpeg ASS + rounded-box subtitle renderer (its most reusable asset). No visual understanding. Prefer porting just the renderer. |
| **MoneyPrinterTurbo-main (1)** (harry0703) | MIT — **yes** | Yes | CPU-only (faster-whisper int8) | import-as-library (two pluckable modules) | Competing generator that overlaps Phase 0. The one drop-in for understanding is the faster-whisper ASR wrapper (`subtitle.create`/`correct`) — clean MIT, word-timestamped. Also reference-grade: LLM caption/hashtag gen (`generate_social_metadata`) + Upload-Post cross-poster for Section B publish. See duplicate handling below. |
| **manim-master** (manimgl) | MIT — **yes** | Yes (needs OpenGL 3.3 context) | CPU-renderable (GL context required; ffmpeg + optional LaTeX) | subprocess-cli | Section B faceless-funnel motion-graphics generator: explainer/intro/outro/lower-third/data-viz overlays via templated Scene `.py` → `manimgl scene.py -w`. Not a clip/understanding tool. Isolate via subprocess (import has heavy argv/config side effects). |
| **Pixelle-Video** (Alibaba) | Apache-2.0 — **yes** | Yes | CPU local (compose/TTS); all gen + understanding offloaded to **cloud GPU/paid APIs** | reference-only (port patterns) | Reference architecture for Section B `upload→understand→compose` flow (`asset_based.py`). Its OpenAI-SDK LLM wrapper already supports Claude/Ollama. Its perception is cloud-only coarse captioning (no structured scenes/faces/pacing) — copy patterns, don't depend on it for understanding. |
| **backgroundremover-main** (v0.4.4) | MIT — **yes** | Yes | CPU-only (u2net ~176MB; slow per-frame) | import-as-library | Compose-stage cosmetic: `bg.remove()` / `transparentvideooverimage()` to place a clipped subject on a branded background or extract cutouts for B-roll. Only a binary alpha mask — zero understanding. Watch the import-time `spawn` multiprocessing clash with Qt; call in a subprocess. |
| **ffsubsync-master** | MIT — **conditional** (avoid `--vad auditok` which is GPLv3; webrtc default is clean) | Yes | CPU-only | subprocess-cli (importable `run()` w/ progress callback) | Niche QA/polish: re-sync a drifted/imported `.srt` to a clip's audio (Section A client-supplied subs, third-party sourced footage). Not a transcriber; redundant if Whisper already gives word timings. VAD only — no holistic understanding. |

---

## DROP

One-line reasons. Reconciled to the conservative call.

- **AnimateAnyone-main** — Empty placeholder: 3 files (README, LICENSE, teaser PNG), zero source code, nothing to integrate.
- **Deep-Live-Cam** — AGPL-3.0 deepfake face-swapper; no understanding, no clip-gen, plus consent/platform-policy risk. License + ethics dealbreaker.
- **diffusers-main** — Generation-only, GPU-bound diffusion library; zero perception; violates CPU-only MVP.
- **Duix-Avatar-main** — GPU-mandatory talking-head avatar (closed Docker images, Electron/Node, restrictive ≤1k-MAU license); no understanding.
- **GPUImage-master** — Apple-only Objective-C/OpenGL ES; cannot run on Windows or from Python; shader CV primitives only.
- **Hello-Python-main** — Spanish Python-101 course repo; toy FastAPI CRUD; no video/audio/perception capability at all.
- **lossless-cut** — GPL-2.0 Electron GUI editor; not a library; its ffmpeg scene/black/silence filters are ~20 lines ClipPilot calls directly. Architecturally wrong + license hazard.
- **LTX-Video** — GPU-bound DiT video *generator* (13B default, H100-class); weights are use-restricted OpenRAIL-M; zero understanding; violates no-GPU-gen.
- **MoneyPrinter-main** — Text-to-Shorts generator; inverted I/O (no ingest/perception); `taskkill /f /im ffmpeg.exe` would kill ClipPilot's own ffmpeg. Reference-only at best.
- **MoneyPrinterPlus** — **Non-commercial license** (per-file header overrides GPL) blocks monetization; Streamlit-coupled (nothing importable); Chinese-platform publishers; no understanding.
- **MoneyPrinterTurbo-main** (the non-`(1)` copy) — MIT text-to-short generator that duplicates Phase 0; ASR-only perception; keep as reference pattern, not a dependency. (See duplicate handling.)
- **Open-Generative-AI** — JS/Electron thin client; clipping + all gen behind the paid closed muapi.ai API; no local intelligence; not importable into Python.
- **openshot-qt** — GPL-3.0 monolithic Qt GUI that won't even run without the external `libopenshot` C++ binary; all AI is GPU-bound ComfyUI HTTP calls. Copy the comfy-client pattern only.
- **Open-Sora-main** — GPU-only (52-60GB VRAM, H100) text-to-video generator; hard CUDA-kernel imports; no Windows/CPU path; no perception.
- **open-source-cs-master** — A markdown list of free CS courses (2 files); not software; name-confusion mis-sourcing.
- **palmier-pro-main** — GPLv3 Swift app locked to macOS 26 + Apple Silicon + Apple frameworks; zero runnable path on Windows Python. Architecture reference only.
- **ShortGPT-stable** — Generation-first faceless maker; only perception is Whisper; "highlight finding" picks a *random* clip; LLM hardwired to OpenAI/Gemini (no Claude). Phase 0 already replicates it.
- **video-retalking-main** — GPU-only lip-sync generator; Apache top-level but vendors research/non-commercial weights (BFM 3DMM, GPEN); Windows-hostile deps; no understanding.
- **ViMax-main** — MIT LLM-agent text→video *creator* using paid cloud GPU gen APIs; zero input-video understanding; violates CPU-only/no-GPU-gen. Agent-loop is a useful pattern only.
- **Wan2.2-main** — Apache code but GPU-mandatory (24-80GB VRAM, CUDA hard-asserted) video generator; bundled Qwen-VL/DWPose/SAM2 are internal conditioning, not a usable understanding API.

---

## License red-flags

The repos below **block closed-source for-profit distribution** of ClipPilot (Sections A/B/C). Conservative handling per repo:

**AGPLv3 (network copyleft — the most dangerous; obligations trigger even for SaaS/network use):**
- **OpenMontage** — *We want its perception code.* Do **NOT** import or vendor the repo. **Port specific modules** (`video_analyzer`, `transcriber`, `scene_detect`, `audio_energy`, `face_tracker`, `clip_embedder`, `slideshow_risk`) into ClipPilot's own tool layer as clean re-implementations, with legal review, OR run it as an arms-length separate-process service you don't distribute. Treat the `VideoAnalysisBrief` schema as design inspiration, not copied code.
- **Deep-Live-Cam** — **Drop.** Importing/shipping any code forces ClipPilot to AGPL. The only salvageable perception (InsightFace, opennsfw2) is available directly from upstream permissive-ish packages — never pull it from this repo.

**GPL-3.0 (strong copyleft — viral on import/link):**
- **VideoCaptioner** — Keep **only** at a subprocess boundary (separate process, no linking). Even then, redistributing the GPL binary inside a commercial installer carries distribution obligations — safest is to require the user to install it, or **port just the ASS/rounded subtitle renderer** clean-room. Exclude its PyQt5 (also GPL).
- **openshot-qt** — **Drop / reference-only.** GPL-3.0 monolithic GUI; copy the `comfy_client` *pattern* (re-implement), never the code.
- **palmier-pro** — **Drop.** GPLv3 + macOS-only; only clean-room re-implementation of its perception/MCP architecture is safe.

**GPL-2.0:**
- **lossless-cut** — **Drop.** GPL-2.0 app + GPL ffmpeg bundle. Command/filtergraph *patterns* are not copyrightable; copy those into ClipPilot's own ffmpeg calls. Do not bundle the app or its ffmpeg.

**Non-commercial / source-available (NOT OSI; block monetization outright):**
- **MoneyPrinterPlus** — **Drop.** Per-file "personal and educational use only; commercial use strictly prohibited" header overrides the GPL LICENSE file. Unusable for any paid section without written permission.
- **Duix-Avatar** — Duix.com Community License: paid commercial license required >1,000 MAU + mandatory branding. Moot (dropped on GPU grounds).
- **Remotion** — Custom license: for-profit orgs **>3 employees must buy a Company License** (remotion.pro); reselling a derivative is forbidden. If used for Sections A/C, **budget the paid license** before shipping. The MIT leaf packages (`@remotion/captions`, `@remotion/mcp`) are safe standalone.

**FFmpeg GPL-flip trap (handle by build selection):**
- **FFmpeg** default is LGPL-2.1 (commercial-safe). Building/bundling with `--enable-gpl` pulls GPL filters (`cropdetect`, `delogo`, `mpdecimate`, `signature`) and libx264/x265, flipping the whole binary to GPL v2+. **Bundle a verified default LGPL CPU build** (gyan.dev/BtbN — confirm which build you ship). If you need `cropdetect` or x264, that is the trigger to re-evaluate.

**Model-weight licenses (code ≠ weights):**
- **LTX-Video** (OpenRAIL-M weights), **Open-Sora / Wan2.2** (Apache code, separate weight licenses), **video-retalking** (Basel Face Model / GPEN research-only weights), **Open-Generative-AI** (downloaded SDXL CreativeML OpenRAIL weights). All dropped for other reasons, but the rule stands: if any future GPU-cloud path reuses these, the **weight** license — not the code badge — governs commercial use of outputs.

---

## Video-understanding contributors

Per the **code** (not paper claims), here is exactly what provides perception. This is the menu for assembling the new holistic-understanding stage.

| Capability | Repos that actually provide it (code-verified) | CPU-viable? |
|---|---|---|
| **ASR / speech-to-text + word timestamps** | OpenMontage (faster-whisper/WhisperX), LocalAI (Whisper/faster-whisper/whisperx + SSE), MoneyPrinterTurbo `(1)`, hyperframes (whisper.cpp), VideoCaptioner (faster-whisper/whisper-cpp), ShortGPT (whisper-timestamped), remotion (whisper.cpp), palmier-pro (Apple Speech, mac-only) | Yes |
| **Scene / shot-boundary detection** | OpenMontage (PySceneDetect), FFmpeg (`select scene`, blackdetect/freezedetect), moviepy (`detect_scenes`, luminosity), lossless-cut (ffmpeg filters), palmier-pro (LumaGrid, mac-only) | Yes |
| **Object detection / segmentation** | LocalAI (`/v1/detection`: rfdetr/SAM3), openshot-qt (SAM2 via GPU ComfyUI), backgroundremover/hyperframes (u2net person matting only) | LocalAI yes; SAM2 GPU |
| **Face detection / recognition / landmarks** | OpenMontage (MediaPipe + Haar fallback), LocalAI (insightface + antispoofing), Deep-Live-Cam (InsightFace buffalo_l — AGPL, drop) | Yes |
| **CLIP / multimodal embeddings (text→visual search)** | OpenMontage (`lib/clip_embedder` ViT-B/32, 512-d), LocalAI (`/v1/embeddings`), palmier-pro (SigLIP2 CoreML, mac-only) | Yes |
| **VLM holistic frame understanding (scene/emotion/on-screen-text via captioning/VQA)** | LocalAI (CPU VLM chat over image/audio/**video** markers), OpenMontage (CLIP zero-shot + BLIP-2/LLaVA — GPU for BLIP2/LLaVA), Pixelle-Video (Qwen-VL, **cloud-only**) | LocalAI CPU VLM; rest GPU/cloud |
| **Audio energy / loudness / music-pacing** | FFmpeg (`ebur128`/`astats`/`silencedetect`), OpenMontage (ffmpeg ebur128 best-window), moviepy (`find_audio_period` RMS), hyperframes (beat/BPM — browser-context only) | Yes |
| **Speaker diarization ("who spoke when")** | LocalAI (`/v1/audio/diarization`, pyannote/sherpa-onnx) | Yes |
| **VAD (speech vs silence)** | ffsubsync (webrtc/silero), faster-whisper VAD (everywhere it appears), FFmpeg silencedetect | Yes |
| **OCR (burned-in on-screen text)** | FFmpeg `vf_ocr` (requires custom `--enable-libtesseract` build, OFF by default) — **no repo ships it ready.** Gap. | (needs custom build / pytesseract) |
| **Facial emotion / audio-event / music-genre classifier** | **None ship a dedicated classifier.** OpenMontage and palmier-pro deliberately offload "visual interpretation" to the agent's VLM. | Gap → Claude-multimodal |

**Net recommendation for the understanding stage:** FFmpeg (frames + cheap signals) → faster-whisper ASR (port from OpenMontage/MPT-`(1)`) + PySceneDetect + MediaPipe faces + CLIP embeddings (port from OpenMontage) → **Claude multimodal** over sampled keyframes for emotion, on-screen-text/OCR, scene semantics, and energy reads. LocalAI is the optional Docker sidecar if you want a single OpenAI-compatible local endpoint covering detection/diarization/face/VLM. **No repo gives turnkey emotion/OCR/music-genre on CPU — Claude fills those gaps.**

---

## Explicit handling of the 3 flagged items

**1. OpenMontage (AGPLv3 agentic video system).** Highest-value perception donor in the entire set — `video_analyzer.py`'s fused `VideoAnalysisBrief` is precisely the "understand the upload like a human" output ClipPilot needs, and its CPU-viable tools (faster-whisper, PySceneDetect, ebur128, MediaPipe, CLIP, slideshow-risk) map cleanly onto the ingest→transcribe→find_highlights state machine. **But AGPLv3 forbids vendoring into a closed-source for-profit app.** Verdict: **OPTIONAL via module porting/re-implementation with legal review**, never a whole-repo dependency. Treat the brief schema as design reference. Note its real gaps (no emotion/OCR/audio-event classifier; deps unpinned beyond 6 core libs; BLIP-2/LLaVA are GPU) — fill perception gaps with Claude-multimodal and pin the dependency stack yourself.

**2. palmier-pro (macOS/Swift MCP editor).** **DROP as code** — GPLv3 + macOS 26 + Apple-Silicon + Apple-only frameworks (CoreML/AVFoundation/Speech) = zero runnable path on native-Windows Python. **Value is architectural reference only:** its perception design (adaptive scene-aware frame sampling → SigLIP2/CLIP embeddings → cosine footage search + shot detect + ASR + an "overview storyboard" grid for the LLM) and its MCP tool surface (`search_media`/`inspect_media`/`get_transcript`/`inspect_timeline`) are an excellent blueprint to re-implement in Python (open-clip/transformers + PySceneDetect/ffmpeg + faster-whisper). Clean-room only.

**3. Duplicate "MoneyPrinterTurbo-main (1)".** Two copies of harry0703/MoneyPrinterTurbo exist: `MoneyPrinterTurbo-main/` and `MoneyPrinterTurbo-main (1)/`. They are the **same MIT project** (faceless text-to-short generator overlapping Phase 0; ASR-only perception). **Resolution: keep ONE copy, delete the other to avoid dependency/version drift.** Both are net-DROP as a pipeline, but the `(1)` dossier identifies two genuinely pluckable MIT modules — the **faster-whisper ASR wrapper** (`subtitle.create`/`correct`, CPU int8, word-timestamped) for the transcribe stage, and the **LLM caption/hashtag + Upload-Post cross-post pattern** for Section B publish. So the consolidated call: **DROP the app, retain one copy, port those two modules** (this is why `(1)` is listed under OPTIONAL and the bare copy under DROP — they are the same repo, scored on which artifacts survive).

---

## Bottom line

- **Build the spine on:** FFmpeg (subprocess) + MoviePy (in-process) — KEEP, both MIT/LGPL, CPU, Windows.
- **Build holistic understanding by porting** faster-whisper ASR + PySceneDetect + MediaPipe + CLIP (from OpenMontage under AGPL legal review / from MPT-`(1)` under MIT for ASR), with **Claude-multimodal** covering emotion, OCR/on-screen-text, scene semantics, and energy — the gaps no repo fills on CPU.
- **Optionally add LocalAI** as a Docker/WSL2 perception sidecar (one OpenAI-compatible endpoint for detection/diarization/face/VLM).
- **Compose/caption extras** (hyperframes/remotion/VideoCaptioner/manim/Pixelle/backgroundremover/ffsubsync) are situational, each gated by its license note above.
- **Drop all 11 GPU-bound generators and all 3 deepfake/lip-sync tools** — they violate the CPU-only/no-GPU-gen decision and provide no understanding.
- **Hard licensing actions before commercial ship:** confirm the LGPL (non-GPL) FFmpeg build; legal review on any OpenMontage port; Remotion Company License if >3 employees; never link VideoCaptioner/openshot/lossless-cut/palmier GPL code; MoneyPrinterPlus and the AGPL deepfake repo stay out entirely.