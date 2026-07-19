# 07 — Video Understanding (human-like)

## 1. The core idea: Claude is the understander, OSS tools are extractors

ClipPilot's existing pipeline already "understands" a video the way a stenographer does — it reads the transcript. That is not how a human understands a video. A human watching a clip simultaneously *sees* the framing, faces, cuts, and on-screen text; *hears* the words, tone, and music energy; *reads* burned-in captions and lower-thirds; and *feels* the pacing. The new subsystem closes that gap.

The architectural insight that makes this cheap and tractable: **Claude is already natively multimodal.** We do not need a self-hosted vision model to "understand" the video. We need to give Claude the same four sensory streams a human has, in a form it can reason over inside a single tool result:

- **Eyes** — a small set of sampled keyframes, returned to Claude as actual *image blocks* in the MCP tool result, so Claude's own vision describes scenes, framing, faces, objects, and on-screen text.
- **Ears** — the word-timestamped transcript (already produced in Phase 0) plus cheap *audio descriptors* (loudness/energy curve, silence segments, music-vs-speech).
- **Reading** — OCR of burned-in on-screen text (titles, captions, lower-thirds, watermarks) that the transcript never captures.
- **Structure** — shot/scene segmentation with timecodes, so Claude reasons about a *timeline of segments* rather than a flat blob.

The local OSS tools in our audit are **extractors**, not understanders. FFmpeg, faster-whisper, PySceneDetect, an OCR engine, and an energy analyzer produce *signals*; Claude synthesizes the *holistic understanding*. This is exactly the design philosophy OpenMontage explicitly states ("the agent provides the visual interpretation") and that PalmierPro implements (sample frames → give the LLM a storyboard + transcript + search index). We re-implement that pattern in Python, CPU-first, with Claude as the brain.

A **local VLM via LocalAI is an *optional* fallback** for bulk/cheap captioning when sending frames to Claude's API is too expensive (e.g. batch-processing a 200-video back catalog). It is never the primary path, and on CPU it is slow (see §4).

> **Licensing note that shaped this design.** The two repos with the most complete ready-made "holistic understanding" code — **OpenMontage** (`video_analyzer.py` fuses transcript + scenes + keyframes + audio-energy + faces into one `VideoAnalysisBrief`) and **palmier-pro** (scene-aware sampling → CLIP/SigLIP2 embeddings → footage search + MCP tool surface) — are both copyleft (**AGPLv3** and **GPLv3** respectively) and palmier-pro is macOS/Apple-Silicon-only. We therefore **port the *design*, not the code**: OpenMontage's `VideoAnalysisBrief` schema shape and palmier-pro's "sample → embed → storyboard → MCP tools" architecture are the blueprint, re-implemented from permissively-licensed parts.

## 2. The modality stack → CPU-only OSS tools (from the audit)

Every modality below maps to a tool we already audited as **KEEP** or a CPU-capable, license-clean **OPTIONAL**. The two `KEEP` repos (FFmpeg, MoviePy) plus faster-whisper (already in Phase 0) cover the spine; everything else is additive.

| Modality (human sense) | What we extract | OSS tool (audited) | License / CPU | Notes |
|---|---|---|---|---|
| **Structure — shot/scene** | Cut timecodes, shots/min (pacing) | **FFmpeg** `select='gt(scene,0.4)',showinfo` (`f_select.c`/`scene_sad.c`); or **PySceneDetect** `ContentDetector` (via OpenMontage `scene_detect.py` pattern) | LGPL / CPU, zero deps | FFmpeg scene filter needs no extra deps; PySceneDetect is more accurate/adaptive |
| **Eyes — keyframes** | Representative frame per shot/window as JPG | **FFmpeg** `thumbnail` + `-ss` seek; MoviePy `iter_frames()`/`get_frame(t)` | LGPL / MIT, CPU | These JPGs become the image blocks Claude sees |
| **Ears — transcript (ASR)** | Word/segment timestamps | **faster-whisper** (Phase 0); reference wrappers in VideoCaptioner `core/asr/transcribe.py`, MoneyPrinterTurbo `subtitle.py`, OpenMontage `transcriber.py` | MIT wrappers / CPU int8 | Already built; reuse. Pick a *small* model for CPU (see §4) |
| **Ears — audio energy/music** | Loudness curve (R128), silence segments, energy-as-pacing | **FFmpeg** `ebur128`, `astats`, `silencedetect` (`f_ebur128.c`, `af_silencedetect.c`); OpenMontage `audio_energy.py` (ffmpeg ebur128) is the exact pattern | LGPL / CPU | "best window" / music-onset detection is a 1-pass ffmpeg call |
| **Reading — OCR** | Burned-in on-screen text + bounding regions | **EasyOCR** or **pytesseract/Tesseract** (run as a Python lib over sampled frames). FFmpeg `vf_ocr` exists but is **OFF by default** and needs a custom `--enable-libtesseract` build | Apache-2 (EasyOCR) / CPU | **Audit gap:** *no* audited repo ships an OCR extractor. This is net-new code. Run OCR only on sampled frames, not every frame |
| **Eyes — semantic / CLIP** | Zero-shot scene labels, text→frame similarity, embeddings | **CLIP** via **LocalAI** `/v1/embeddings`, or open-clip directly; OpenMontage `lib/clip_embedder.py` (ViT-B/32, ~150–300 ms/img CPU) is the reference | MIT (LocalAI) / CPU-viable | CLIP path is CPU-OK; BLIP-2/LLaVA are **not** (GPU) |
| **Eyes — VLM captioning (optional bulk)** | Per-frame description, VQA, scene classification | **LocalAI** `/v1/chat/completions` against a small CPU VLM | MIT / CPU but **slow** | Optional fallback only; Claude's own vision is the primary path |
| **Faces / people** | Face presence, count, bbox, head pose | **MediaPipe** (OpenMontage `face_tracker.py` pattern, OpenCV-Haar fallback); or **LocalAI** `/v1/detection` + InsightFace backend | MIT / CPU | Used for the **likeness guardrail** (§5), not for swapping |
| **Objects / on-screen entities** | Boxes/labels | **LocalAI** `/v1/detection` (rfdetr/SAM CPU backends) — optional | MIT / CPU sidecar | Claude vision often suffices; detection is a precision add-on |

**OpenMontage's relevant understanding/ingest code (the closest match in the whole audit).** Its `tools/analysis/` directory is effectively a reference implementation of this exact subsystem, all CPU-capable:
- `video_analyzer.py` → produces a `VideoAnalysisBrief` (source meta + content_analysis + structure_analysis with scenes + `pacing_profile`) — **this is the shape of our `Understanding` object.**
- `transcriber.py` (faster-whisper), `scene_detect.py` (PySceneDetect), `audio_energy.py` (ffmpeg ebur128), `face_tracker.py` (MediaPipe), `frame_sampler.py` (intelligent keyframe extraction), `visual_qa.py` (blur/brightness/black-frame/caption-occlusion quality checks), `lib/clip_embedder.py` (CLIP 512-d), `lib/slideshow_risk.py` and `lib/verify_scene_pacing.py` (pacing checks).
- Documented **gaps we must fill ourselves** (per the dossier): no dedicated facial-**emotion** classifier, no **audio-event/music-genre** classifier, and **no OCR**. OpenMontage deliberately offloads emotion/on-screen-text reads to the agent's own vision model — which is precisely our plan: **Claude reads emotion and on-screen text off the sampled keyframes.**

Because OpenMontage is AGPLv3, we treat all of the above as **design reference** and re-implement the handful of modules we need against FFmpeg + faster-whisper + EasyOCR + open-clip/LocalAI.

## 3. MCP tool design: `understand_video(path)`

A single MCP tool that returns **both** a structured `Understanding` object **and** the sampled keyframes as image blocks, so Claude's own vision participates in the same turn.

```
understand_video(
    path: str,                      # local file path (post-ingest)
    depth: "fast" | "standard" | "deep" = "standard",
    frame_budget_per_min: int | None = None,   # override default (§4)
    ocr: bool = True,
    faces: bool = True,
) -> ToolResult
```

**Returns — content blocks in this order:**
1. A `text`/JSON block: the `Understanding` object (schema below).
2. N `image` blocks: the sampled keyframes (downscaled JPEGs), each immediately preceded by a tiny text caption `"[frame @ 00:03:12 — shot 7]"` so Claude can bind what it sees to a timecode and scene.

**The `Understanding` object** (modeled on OpenMontage's `VideoAnalysisBrief`, extended for our pipeline):

```jsonc
{
  "source": { "duration_s", "fps", "resolution", "codec", "has_audio" },
  "summary": "1-paragraph holistic gist (Claude fills/expands this from frames+transcript)",
  "topics": ["..."], "entities": ["names, brands, products"],
  "scenes": [
    { "idx": 0, "start": 0.0, "end": 8.4,
      "keyframe_path": "...", "shot_change_score": 0.62,
      "transcript_excerpt": "...", "on_screen_text": ["TITLE CARD: ..."],
      "visual_desc": "<Claude fills from the frame>",
      "energy": 0.71, "speech_ratio": 0.9 }
  ],
  "on_screen_text": [ { "t": 3.1, "text": "SUBSCRIBE", "bbox": [...] } ],   // OCR
  "mood_energy_timeline": [ { "t": 0, "loudness_lufs": -18, "energy": 0.4, "label": "calm" }, ... ],
  "faces": { "present": true, "max_count": 1, "identifiable_person_likely": true },  // → guardrail
  "highlight_candidates": [
    { "start": 41.2, "end": 58.0, "score": 0.88,
      "reasons": ["punchline + laughter spike", "energy peak", "quotable line", "face close-up"] }
  ],
  "flags": { "sensitivity": ["..."], "likeness": ["identifiable_person"], "third_party_source": [...] }
}
```

Key design points:
- **Two-stage fill.** The extractor populates everything cheap and deterministic (timecodes, scores, OCR, energy, transcript excerpts, face presence). The `visual_desc`, `summary`, `mood label`, and the *reasons* on highlight candidates are intended to be **completed/upgraded by Claude in the same turn** using the attached frames. This is the "tools extract, Claude understands" split made literal.
- **Highlight candidates always carry reasons.** Never a bare timestamp — `find_highlights` (§5) consumes the reasons, and the human approval gate displays them.
- **Stateless + cached.** The Understanding object is written to the SQLite job row (new `understanding_json` column) so re-runs and the approval UI don't re-extract.

## 4. Frame-sampling strategy + honest cost model

This is where most "give the LLM video" designs quietly blow the budget. Be disciplined.

### Sampling strategy
1. **Scene-aware, not fixed-interval.** Run scene detection first; take **one representative keyframe per shot** (FFmpeg `thumbnail` within each shot window). Long static shots get a forced floor (≥1 frame per ~10 s) so a 3-minute talking-head isn't reduced to one frame. This is palmier-pro's `FrameSampler` + LumaGrid approach.
2. **Cap per minute.** Apply a hard `frame_budget_per_min`. If shots exceed the budget, keep the highest-information frames (largest visual delta / energy peaks); if fewer, that's fine.
3. **Downscale aggressively.** Resize the long edge to **~768 px** before encoding to JPEG. Claude's vision does not need 1080p to read a scene or a caption, and resolution drives token cost.

### Claude vision token cost — honest numbers
Anthropic bills images at roughly `tokens ≈ (width × height) / 750`. A 768×432 (16:9) frame ≈ **~440 tokens**; a 9:16 768×1365 frame ≈ **~1,400 tokens**. Budget conservatively at **~500–1,500 input tokens per frame** depending on aspect ratio, plus the text of the transcript/object.

**Cost per 10-minute video at different frame budgets** (input tokens only; assume ~600 tok/frame landscape; transcript/object overhead ~8–15k tokens; use Opus-class input pricing ~$5/Mtok and Sonnet-class ~$3/Mtok as bookends — *verify current pricing with the `claude-api` skill before quoting a customer*):

| Frame budget | Frames (10 min) | Frame tokens | ~Input cost @ $3/Mtok | ~Input cost @ $5/Mtok |
|---|---|---|---|---|
| 2 / min | 20 | ~12k | ~$0.04–0.06 | ~$0.06–0.09 |
| **6 / min (default)** | **~60** | **~36k** | **~$0.13–0.15** | **~$0.22–0.25** |
| 12 / min | ~120 | ~72k | ~$0.24–0.27 | ~$0.40–0.45 |
| 30 / min (overkill) | ~300 | ~180k | ~$0.55+ | ~$0.90+ |

Add output tokens (the Understanding write-up, ~2–6k) — small. So a standard 10-min understand pass lands around **$0.15–0.30** of Claude spend at the recommended budget. That is cheap relative to the value, but it scales linearly — a 60-min podcast at 6/min is ~360 frames (~$1–1.5). **Recommend the default budget of 6 frames/min, clamped to a hard ceiling of ~120 frames per video** regardless of length (beyond that, frames are redundant for understanding; lean on transcript + energy timeline for the long tail).

### Latency
- **Extraction (CPU, local):** scene detect + keyframe export + ebur128 on a 10-min video is dominated by a few FFmpeg decode passes — roughly **real-time-fraction to a couple minutes** on a typical CPU (a full decode pass is the floor). OCR on ~60 frames with EasyOCR is **another 30–90 s** on CPU. faster-whisper (small, int8) ASR is roughly **0.3–1× real time** on CPU.
- **Claude turn:** sending 60 image blocks adds meaningful latency — expect **tens of seconds** for the model to ingest and respond. Run on a PySide6 worker thread; never block the GUI.
- Total: a 10-min video realistically takes **a few minutes** end-to-end on CPU-only. Acceptable behind an async job + approval gate; surface progress.

### Local VLM feasibility — be skeptical
A local VLM via **LocalAI** is the optional bulk path. Honest caveats from the audit:
- LocalAI is **not Windows-native** (its release builds exclude Windows; ships Docker/macOS only). On our native-Windows target it is a **Docker Desktop / WSL2 sidecar**, not a library — operational weight.
- CPU VLM inference (LLaVA/BLIP-2-class) is **slow** — the audit flags large VLMs on CPU as "functional but slow," and OpenMontage's `video_understand` declares `LOCAL_GPU, vram_mb=2048` for exactly these models. **CLIP on CPU is fine (~150–300 ms/frame); generative VLM captioning on CPU is not interactive.**
- **Verdict:** use LocalAI/CLIP for *embeddings and zero-shot labels* (cheap, CPU-OK) and reserve generative VLM captioning for **offline batch** jobs where a frame costs ~seconds and that's tolerable. For the interactive `understand_video` path, **Claude's own vision is both better and, at the default budget, competitively cheap.** Do not put a CPU VLM on the hot path.

## 5. How this upgrades `find_highlights` and feeds the rest of the system

**`find_highlights` becomes multimodal.** Today it ranks transcript segments. With the Understanding object it now scores on fused signals:
- transcript (quotable lines, questions, payoffs) **+**
- **energy/loudness peaks** (laughter, applause, music swell) from the ebur128 timeline **+**
- **scene/shot density** (a flurry of cuts often marks a hook or montage) **+**
- **visual events** Claude flags from keyframes (a reveal, a reaction shot, a face close-up, an on-screen text callout) **+**
- **on-screen text** (OCR) that signals a titled segment ("Step 3", "The mistake everyone makes").

Every highlight candidate carries `reasons`, so the human approval gate shows *why* a clip was chosen, and the operator can trust/override it.

**Feeds all three sections:**
- **Section A (paid clipping / DFY):** richer, defensible highlight selection on client-uploaded long-form; on-screen-text and scene awareness avoid cutting mid-title or mid-reveal.
- **Section B (faceless funnel):** scene + energy structure drives where B-roll, captions, and beat-synced cuts land in the compose stage.
- **Section C (ad-share):** same highlight intelligence, plus sensitivity flags to keep clips monetization-safe.

**Feeds publish metadata.** `summary`, `topics`, and `entities` seed the title/description/hashtag generation (the `generate_social_metadata` pattern seen in MoneyPrinterTurbo) with real grounding in what the video *is about* — not just the transcript.

**Feeds the guardrails — concretely:**
- **Likeness guardrail.** When face detection (MediaPipe / LocalAI InsightFace) reports a present, identifiable person — corroborated by Claude reading the keyframe — the Understanding object sets `flags.likeness = ["identifiable_person"]`. That flag **routes the job through the consent/likeness check before any publish**, and is surfaced prominently at the approval gate. (This is also why we explicitly **rejected the deepfake/face-swap repos** — Deep-Live-Cam, video-retalking, Wan2.2 S2V/Animate, Duix.Avatar — for this subsystem: detecting a real person is a guardrail trigger, not an invitation to synthesize them.)
- **Sensitivity flags.** Claude's holistic read flags content categories (graphic, sensitive, brand-unsafe on-screen text) that the transcript alone would miss.
- **Third-party-source provenance.** Pairs with the existing "third-party sourcing, guardrails on" posture — the Understanding object records OCR'd watermarks/handles as provenance signals.

## 6. Phased build note

**Phase 1 (lands now — CPU-only, license-clean, no GPU, no sidecar):**
- New MCP tool `understand_video(path)` returning the `Understanding` object **+** keyframe image blocks.
- Extractors, all from `KEEP`/clean sources: **FFmpeg** scene detect + keyframe export + ebur128 energy + silencedetect (subprocess, the spine); **faster-whisper** transcript (reuse Phase 0); **EasyOCR** on sampled frames (net-new, ~Apache-2); **MediaPipe** face presence for the likeness flag.
- **Scene-aware sampling** with the **default 6 frames/min, ≤120-frame ceiling**, 768 px downscale.
- Claude does the synthesis (summary, per-scene visual_desc, mood labels, highlight reasons, on-screen-text reading) **in the same tool turn** off the attached frames.
- Wire `flags.likeness` → likeness guardrail; wire highlight candidates+reasons → `find_highlights`; wire summary/topics/entities → publish metadata.
- Persist `understanding_json` in SQLite; expose reasons at the approval gate.

**Phase 2 / later (optional, additive):**
- **CLIP embeddings** (open-clip or LocalAI `/v1/embeddings`, CPU-OK) for text→frame search and cross-video dedup/retrieval (palmier-pro pattern).
- **LocalAI sidecar** (Docker/WSL2) as the **bulk/offline** VLM + object-detection + diarization backend for back-catalog processing — explicitly **off the interactive hot path** given CPU slowness and the non-Windows-native caveat.
- **Diarization** ("who spoke when", LocalAI `/v1/audio/diarization`) for multi-speaker long-form.
- **ffsubsync** (MIT, CPU) only if we ingest externally-supplied drifted `.srt` files that need realignment.
- Tighter facial-emotion and audio-event/music-genre classifiers *if* Claude-vision reads prove insufficient in practice (measure first — the audit shows even OpenMontage punts these to the agent's vision).

**Explicitly NOT in scope (audit-confirmed drops for this subsystem):** all GPU-only generators (Open-Sora, LTX-Video, Wan2.2, diffusers, AnimateAnyone, MoneyPrinter\*/ShortGPT/ViMax/Pixelle as understanders), all deepfake/talking-head tools (Deep-Live-Cam, video-retalking, Duix.Avatar), Apple-only/GPL GUIs (GPUImage, openshot-qt, lossless-cut, palmier-pro, VideoCaptioner-as-library), and the non-software repos. They contribute **zero holistic understanding** and/or violate the CPU-only / license / Windows-native constraints.

---

**Net:** Phase 1 ships human-like understanding using only CPU-friendly, permissively-licensed extractors plus Claude's native multimodality, at ~$0.15–0.30 of model spend per 10-minute video and a few minutes of local CPU time — with the likeness guardrail wired in from day one.