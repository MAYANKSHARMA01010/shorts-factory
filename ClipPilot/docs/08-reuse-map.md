# 08 — Reuse Map (leveraging the OSS repos)

**Status:** ✅ authored from the code-level harvest (`research/02-harvest.json`, 11 agents) · **Date:** 2026-06-22

This answers the standing question — *"are we actually using the repos, or reinventing?"* — with a per-stage map of which repo's **actual code** ClipPilot reuses and how. Integration verbs: **import** (pip + call permissive Python), **port** (re-author the logic/recipe — mandatory for GPL, where source files can't be imported but algorithms/command-strings aren't copyrightable), **subprocess** (run its CLI at an arms-length process boundary — the safe way to use GPL/AGPL tools from a closed app), **skill** (a Claude-Code skill), **reference** (design only).

> Honest framing: the core *clip + understand* path (Section A) was built on the **libraries** these repos wrap (FFmpeg, faster-whisper, anthropic) rather than vendoring repo code — defensible, since those wrappers add nothing over calling the library directly. The **metadata, publishing, generation, captions, and b-roll** stages are where the permissive repos add real code, and that's what this map harvests.

---

## Per-stage reuse

| Stage | Source repo → exact file/symbol | Integration | License | Status |
|---|---|---|---|---|
| **metadata** | **MoneyPrinterTurbo** `app/services/llm.py` → `generate_social_metadata` + `SOCIAL_PLATFORMS` + `_normalize_hashtags` + `_parse_social_metadata` | **port** | MIT | ✅ **done** → `clippilot/publish/metadata.py` |
| metadata (prompt wording) | **ShortGPT** `prompt_templates/yt_title_description.yaml`; **Pixelle** `utils/content_generators.py` | port | MIT / Apache | reference |
| **publish** | **MoneyPrinterTurbo** `app/services/upload_post.py` → `UploadPostService` (YT/IG/FB/TikTok via one POST) | **import/port** | MIT | ✅ **done** → `clippilot/publish/upload_post.py` (⚠ paid SaaS gateway) |
| publish (first-party, free) | YouTube Data API v3 + IG Content Publishing — build directly (no repo has a native OAuth uploader) | build | — | next |
| **generate_B** (faceless funnel) | **Pixelle** `pixelle_video/pipelines/standard.py` `StandardPipeline` (theme→narration→TTS→compose; CPU static-template branch skips all GPU gen) | port | Apache-2.0 | next |
| generate_B — **TTS** | TTS engine for Section B narration — see **TTS note** below | mixed | ⚠ license-sensitive | **pick next** |
| generate_B (facts mode) | **ShortGPT** `engine/facts_short_engine.py` `FactsShortEngine` + its YAML prompts | port | MIT | optional |
| **generate_C** (ad-share) | **Pixelle** `services/video.py` `VideoService` (concat/merge/bgm/overlay/pad/trim) | import | Apache-2.0 | next |
| **captions** (kinetic/karaoke timing) | **remotion** `packages/captions/src/create-tiktok-style-captions.ts` (~70 LOC, page+token `fromMs/toMs`) — **MIT leaf package only** | port | MIT (leaf) | **pick next** |
| captions (grouping brain) | **hyperframes** `skills/faceless-explainer/scripts/captions.mjs` `runGroup()` + liquid-glass / kinetic-slam skins | port | Apache-2.0 | optional |
| captions (rounded-box) | **VideoCaptioner** `core/subtitle/{style_manager,ass_renderer,rounded_renderer}.py` → **ASS style strings + filtergraph recipe ONLY** | **port recipe** | **GPL-3.0** (never import .py) | optional |
| captions (in-proc fallback) | **moviepy** `video/VideoClip.py` `TextClip` + `tools/subtitles.py` `SubtitlesClip` | import | MIT | optional (CPU-slower than libass) |
| captions (resync) | **ffsubsync** `aligners.py` `FFTAligner` + `speech_transformers.py` (pure numpy) — **avoid its auditok VAD (GPL)** | import | MIT | optional |
| **broll** (subject cutout) | **backgroundremover** `utilities.py` `transparentvideooverimage()` / `bg.remove()` | **subprocess** | MIT | optional (⚠ import-time `spawn()` clashes with Qt → must isolate) |
| broll (cinematography prompt) | **Open-Generative-AI** `CinemaStudio.jsx` `buildNanoBananaPrompt` + CAMERA/LENS dicts | port | MIT (wrapper) | optional (⚠ its MuAPI backend is **paid** — don't use) |

### TTS note (license-sensitive — caught during synthesis)

The popular **edge-tts** package (used by MoneyPrinterTurbo / Pixelle / ShortGPT) is itself **GPL-3.0** — the *wrapper code* in those repos is MIT/Apache, but the *dependency* is GPL. So for a closed-source app:
- ✅ **Preferred:** a permissively-licensed TTS — **kokoro-onnx** (offline, Apache/MIT-ish, CPU) or **Windows SAPI via pyttsx3** (BSD, zero-network, always available on Windows).
- ✅ **Acceptable:** call **edge-tts as an arms-length subprocess** (GPL boundary at the process edge; needs network — it hits a Microsoft endpoint).
- ❌ **Avoid:** `import edge_tts` / bundling it into the app binary (GPL-vendor).

## Pick this first (ordered, highest-value / lowest-risk)

1. ✅ **MoneyPrinterTurbo metadata generator** — `llm.py` → `clippilot/publish/metadata.py`. *Done.*
2. ✅ **MoneyPrinterTurbo Upload-Post publisher** — `upload_post.py` → `clippilot/publish/upload_post.py`. *Done.* (Paid gateway; first-party YouTube API is the free alternative, still to build.)
3. **Permissive TTS for Section B** — kokoro-onnx (offline) or Windows SAPI (pyttsx3), or edge-tts as a subprocess. Powers script→voiceover with word-timed captions.
4. **remotion `createTikTokStyleCaptions`** — port the ~70-line MIT algorithm → karaoke/kinetic caption timing that upgrades our plain libass burn-in (keep libass as the burn engine; this just supplies the token timing).
5. **Pixelle `StandardPipeline`** — port the theme→narration→TTS→compose orchestration for Sections B & C (CPU static-template branch only).
6. **ffsubsync `FFTAligner`** — import the MIT, pure-numpy SRT↔audio resync (skip its GPL auditok VAD).
7. **backgroundremover** — subprocess `transparentvideooverimage()` for subject-cutout B-roll.

## Deliberately NOT reusing (documented, per repo)

- **AGPL — would force ClipPilot to AGPL:** Deep-Live-Cam, OpenMontage (we port its *design* only — docs/02b §2).
- **GPL — can't import into a closed app (port recipes / subprocess only):** VideoCaptioner (caption recipe ported, not its .py), openshot-qt, lossless-cut, MoneyPrinterPlus, **edge-tts package** (subprocess or swap for a permissive TTS), ffsubsync's auditok VAD.
- **GPU-mandatory (fail the CPU-only MVP):** Open-Sora, Wan2.2, LTX-Video, diffusers, video-retalking, Duix-Avatar, AnimateAnyone *(also empty — no code)*, Pixelle's ComfyUI generation stack.
- **Wrong platform:** palmier-pro (macOS/Swift — reference architecture only, docs/02b §3), GPUImage (iOS/Obj-C).
- **Paid / non-OSI:** Open-Generative-AI's MuAPI path; MoneyPrinterPlus' Chinese-platform publishers; the **Remotion runtime** (solo/paid license — only its MIT `@remotion/captions` leaf is used); all Playwright/Chrome HTML renderers (heavyweight).
- **Not tools:** Hello-Python, open-source-cs (learning material). **Duplicate:** `MoneyPrinterTurbo-main (1)`.

→ Done integrations live in [`../src/clippilot/publish/`](../src/clippilot/publish/). Every "NOT reusing" call is a license / platform / GPU constraint, documented — not an oversight.
