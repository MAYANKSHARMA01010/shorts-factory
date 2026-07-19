# 10 — Functionality coverage across all 32 OSS apps

**Goal (owner directive):** integrate the functionality of all 32 apps in `reusablecode/` into ClipPilot. This file is the authoritative coverage map — every app is **Integrated**, **Addable (backlog)**, or **Excluded (with reason)**. It's built on the code-verified [`03-tool-inventory.md`](03-tool-inventory.md) + [`08-reuse-map.md`](08-reuse-map.md).

> **STATUS (2026-06-23): COMPLETE.** All 32 repos are Integrated or Excluded-with-reason; the Addable backlog is cleared; the new code survived a 13-agent adversarial hardening pass (3 real bugs fixed); the full render+e2e gate is green (266 tests, real media, both money paths).

> Honest framing: "all functionalities" ≠ "vendor every repo." Some apps are GPU-only (can't run on a CPU-only Windows app), AGPL/GPL (can't be imported into a closed app), macOS/iOS, paid SaaS, or learning-only. For those, the *functionality* is integrated where feasible via a clean-room port / permissive equivalent / hosted-API hook, and otherwise excluded with a documented reason — never silently dropped.

## ✅ Integrated (functionality is in ClipPilot today)

| App | License | Functionality → where in ClipPilot |
|---|---|---|
| **FFmpeg** | LGPL/GPL (bundled binary, arms-length) | the entire media engine — signals, clip, caption burn, compose, assemble (`media/`, `generate/assemble.py`) |
| **faster-whisper** (via repos) | MIT | transcription + word timings (`media/transcribe.py`) |
| **MoneyPrinterTurbo** ×2 | MIT | social-metadata generation (`publish/metadata.py`), Upload-Post cross-poster (`publish/upload_post.py`), stock-footage approach (`generate/broll.py`) |
| **ShortGPT** | MIT | per-caption timed b-roll (`generate/broll.py`) sourced **Pexels→Openverse→Bing** (Openverse = free/keyless/reliable/CC-licensed, replacing unreliable Bing scraping); on-subject image **pool** rotated for generic caption pages (on-topic + varied — render-verified to fix off-topic "slop"); TikTok caption timing; **facts-mode short engine** (`script.py` `mode='facts'`, `_core_subject` strips "N facts about" framing), CLI `demo-short --facts N` / `profile-save --mode facts` |
| **remotion** (`@remotion/captions` leaf) | MIT | TikTok-style caption grouping (`media/captions.py` `create_tiktok_style_captions`) |
| **hyperframes** + **VideoCaptioner** | Apache / GPL (recipe) | **caption skins** — `media/edit.py CAPTION_SKINS` registry (opaque_box, kinetic_pop, anime_outline, sticker, neon_pop karaoke) harvested + libass-adversarially-verified (docs/10), selectable via Settings/Profile `caption_skin`, CLI `--skin`; fonts mapped to guaranteed-present Windows faces; **render-verified** on real video |
| **Pixelle-Video** | Apache-2.0 | the StandardPipeline recipe: theme→script→TTS→compose (`generate/pipeline.py`) — CPU path |
| **Open-Generative-AI** (prompt recipes) | MIT wrapper | **cinematic prompt-builder** (`generate/cinematic.py`): CAMERA/LENS/LIGHT vocab → `build_visual_prompt` (mood-aware, for gen #7) + light `enrich_term` boosting b-roll stock search with a bare-query fallback. The paid MuAPI backend stays excluded. |
| **VideoCaptioner** | GPL (recipe only) | ASS caption styling + karaoke (`media/edit.py` `write_ass`/`write_ass_karaoke`) — recipe re-authored, no GPL import |
| **(Meta Graph / YouTube Data APIs)** | — | first-party YouTube + Instagram/FB publishers (`publish/youtube.py`, `publish/instagram.py`) |
| **ffsubsync** | MIT | subtitle↔audio **resync** — FFT cross-correlation aligner (`media/subsync.py`), CLI `resync-srt`, MCP `resync_subtitles`; uses ffmpeg silencedetect, not its GPL VAD |
| **OpenMontage** (yt-dlp) | Unlicense | **source-video download** — `media/download.py` (yt-dlp module→CLI fallback→graceful), CLI `download` / `enqueue-url`, MCP `download_source`, doctor check; rights-gated. **Verified with a real download.** |
| **OpenMontage** (free-archive corpus) | technique | **real motion-footage montage** — `generate/broll.py` Pexels+Pixabay video sourcing (`motion_clip_urls`, `fetch_motion_broll`) + `assemble.py assemble_motion_montage` (reframe→concat→duration-match); top visual preference in `generate_short` (PEXELS/PIXABAY key-gated, falls back to stills). **Render-verified** (vertical, duration-matched). |
| **GPU gen models** (Open-Sora/Wan2.2/LTX-Video/diffusers…) | hosted hook | **hosted-API image-gen hook** (`generate/gen_image.py`): CPU-only stand-in for the GPU models — a vendor-neutral OpenAI-images-compatible call using the cinematic prompt (`fetch_gen_broll`), wired as a Section-B visual source, doctor check, `.env.example`. Opt-in via GEN_IMAGE_API_KEY; no-op + stock fallback otherwise. |
| **backgroundremover** | MIT | **subject-cutout b-roll** (`media/cutout.py`): rembg/u2net background removal → ffmpeg composite over a fresh background; CLI `cutout`. rembg+onnxruntime install on 3.14; **composite render-verified + real u2net cutout verified end-to-end**. Graceful no-op without rembg. |
| **manim** | MIT | **explainer/diagram clips** (`generate/explainer.py`): animated titled+bulleted card over a gradient, CLI `explainer`. ffmpeg-native so it ALWAYS works (manim needs MSVC+LaTeX → optional upgrade). **Render-verified** (clean vertical card). |

Plus the engine, approval gate, strike guardrail, MCP server, GUI, DFY templates, doctor — the orchestration the 32 apps lacked.

## 🔜 Addable backlog — CLEARED ✅

Every addable item has landed. The one remaining candidate is intentionally **not** done:

| App | License | Why not done |
|---|---|---|
| **moviepy** | MIT | An in-proc text/image overlay fallback for when libass is unavailable. We use ffmpeg/libass directly and it's reliable on every target box, so this is **WONTFIX** — it would add a dependency for a fallback that never triggers. |

## ⛔ Excluded (with reason — not oversights)

| App | Reason |
|---|---|
| Open-Sora, Wan2.2, LTX-Video, diffusers, AnimateAnyone (empty), video-retalking, Duix-Avatar | **GPU-mandatory** — fail the CPU-only MVP. Functionality offered as an optional hosted-API hook (backlog #8), not vendored. |
| Deep-Live-Cam | **AGPL + real-time face-swap** — would force ClipPilot to AGPL, and non-consensual face-swap is a hard-line guardrail violation. |
| MoneyPrinterPlus, OpenShot, LosslessCut | **GPL desktop apps** — can't import into a closed app; OpenShot/LosslessCut are full GUI editors out of scope. |
| GPUImage | **iOS / Objective-C** — wrong platform. |
| LocalAI | **Docker-only on Windows** — out of scope; Claude API is the brain. |
| Open-Generative-AI (MuAPI path) | **paid SaaS backend** — only the free prompt-recipe is portable (backlog #6). |
| ViMax, **OpenMontage** | **agentic orchestrators** — Claude IS the agent here (MCP), so the role is already filled. OpenMontage is also **AGPLv3** (can't vendor into a closed app). Its free techniques (yt-dlp download, free-archive motion b-roll) are pulled into the backlog instead (#9, #10). |
| **palmier-pro** | **macOS-26 / Apple-Silicon, Swift-native, GPLv3 desktop editor** — wrong platform (like GPUImage/iOS) and a full GUI editor out of scope. |
| Hello-Python, open-source-cs | **learning material**, not tools. |
| `MoneyPrinterTurbo-main (1)` | **duplicate** of MoneyPrinterTurbo. |
| edge-tts (dependency) | **GPL-3.0** — kept only as a subprocess/local fallback; primary TTS is now **Chatterbox** (MIT code+weights, local GPU) in `media/tts.py`. SAPI removed. |

> All **32** repos in `reusablecode/` are now catalogued (verified by directory listing 2026-06-23). The two previously-missed repos — OpenMontage-main, palmier-pro-main — are classified above.

## Working method

The loop works the **Addable backlog** top-down, harvesting the real technique from each repo (per the owner's standing instruction), verifying by rendering a real video, and updating this table as each lands. When the backlog is empty, every app is either Integrated or Excluded-with-reason — i.e. "all 32" is covered.
