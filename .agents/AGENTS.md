# Video Generation Rules & System Prompt (Shorts-Factory & ClipPilot)

Whenever creating, modifying, or debugging video generation scripts (Shorts 9:16 or Long Videos 16:9) in this codebase, you **MUST** adhere to the following rules:

## 1. 60 FPS & Maximum Quality Rendering (CRF 16)
- **ALWAYS** render final output videos at **60 FPS** (`fps=60` / `-r 60`).
- **ALWAYS** use **CRF 16** (`-crf 16`) for pristine visual quality without degradation.
- **ALWAYS** render audio at **48kHz** (`-ar 48000`) with **320k AAC bitrate** (`-b:a 320k`).

## 2. Zero-Crop Rule (9:16 Shorts & 16:9 Long Videos)
- **NEVER** use raw hard cropping (`crop=w:h`) that cuts off the left/right or top/bottom of images, diagrams, text, or main subjects.
- **ALWAYS** use the split blurred-background padding filter (`split[a][b]; [a]scale=...boxblur...[bg]; [b]scale=...force_original_aspect_ratio=decrease[fg]; [bg][fg]overlay...`) so 100% of the original image is preserved cleanly in frame.

## 3. Mandatory `manifest_explainer_<id>.json` with Image Timeline
- Every video generation script **MUST** auto-create a complete `packages/ClipPilot/data/manifest_explainer_<id>.json` file.
- Manifest MUST include multi-platform upload metadata for YouTube, Instagram Reels, TikTok, Facebook Reels, X, Threads, and Snapchat.
- Manifest MUST include an **`image_timeline`** array under `assets` containing timing and clip information (`clip_index`, `start_s`, `end_s`, `duration_s`, `image_path`, `prompt`, `keyword`, `caption_text`) for the editor UI.

## 4. High Quality Image Prompts & Strict Safety Filter
- **NO NUDITY OR NSFW CONTENT**: Never search, generate, or include explicit, pornographic, naked, or suggestive imagery. Always enforce negative prompts: `"nudity, naked, nsfw, explicit, sexual, uncensored"`.
- Image prompts must specify framing, lighting, and camera details explicitly:
  - 9:16 Shorts: `"Vertical portrait 9:16 composition, subject centered in frame, full subject visible, golden hour light, photorealistic 8k, crisp focal detail"`
  - 16:9 Long Videos: `"Widescreen 16:9 cinematic shot, rule of thirds, expansive view, warm amber light, 8k wallpaper quality"`
- Always exclude watermarks, text, blurry, low quality, cropped head, missing limbs, bad anatomy.

## 5. File Placement Conventions
- Video creator scripts (`make_<topic>_explainer.py`) must be placed in `packages/ClipPilot/my_videos/<YYYY-MM-DD>/` organized by creation date.
- Engine & core tools (`chatterbox_engine.py`, `produce_short_zimage.py`, `collect_finals.py`) must stay inside `scripts/generators/`.
- Video outputs & temporary work files land in `packages/ClipPilot/data/explainer_<id>/`.

Refer to [docs/VIDEO_GENERATION_GUIDE.md](file:///Users/mayanksharma/Downloads/New_Projects/shorts-factory/docs/VIDEO_GENERATION_GUIDE.md) for complete details.
