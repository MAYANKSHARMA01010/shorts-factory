# 🎬 Video Generation Guide & Master Rulebook (Shorts-Factory & ClipPilot)

This guide documents the complete pipeline for generating **ultra-high-quality 60 FPS YouTube Shorts (9:16)** and **Long-Form Videos (16:9)** using `shorts-factory` and `ClipPilot`.

---

## 🤖 AI Assistant Master Prompt (Copy & Paste for any AI)

> **Instructions for AI Assistant:**
> When generating or modifying any video (Short or Long-Form) in this codebase, you **MUST** strictly adhere to the following rules:
> 1. **Strict Safety & Family-Friendly Filter**: **NEVER** generate, fetch, or include any nudity, pornographic, naked, NSFW, or suggestive images under any circumstances. Always include explicit safety negative terms in all prompts (`"nudity, naked, nsfw, explicit, sexual, uncensored"`).
> 2. **Highest FPS & Maximum Render Quality**: Render all final videos at **60 FPS** with **CRF 16** (virtually lossless visual quality), **48kHz audio sample rate**, and **320k AAC audio bitrate** (`-r 60 -crf 16 -b:a 320k -ar 48000`).
> 3. **Zero-Crop Rule (9:16 Shorts & 16:9 Long Videos)**: Never use raw hard cropping (`crop=w:h`) that cuts off the left/right or top/bottom of images, diagrams, text, or main subjects. Always use the split blurred-background padding filter (`split[a][b]; [a]scale=...boxblur...[bg]; [b]scale=...force_original_aspect_ratio=decrease[fg]; [bg][fg]overlay...`) so 100% of the original image is preserved cleanly in frame.
> 4. **Mandatory `manifest_explainer_<id>.json` with Image Timeline**: Every video script MUST auto-create a complete `packages/ClipPilot/data/manifest_explainer_<id>.json` file. The manifest MUST include multi-platform upload metadata (YouTube, Instagram, TikTok, Facebook, X, Threads, Snapchat) AND an **`image_timeline`** array containing `clip_index`, `start_s`, `end_s`, `duration_s`, `image_path`, `prompt`, `keyword`, and `caption_text` for the video editor.
> 5. **Highest Quality Image Prompts**: Prompts must explicitly specify framing, lighting, camera detail, and resolution:
>    - 9:16 Shorts: `"Vertical portrait 9:16 composition, subject centered in frame, full subject visible, golden hour light, photorealistic 8k, crisp focal detail"`
>    - 16:9 Long Videos: `"Widescreen 16:9 cinematic shot, rule of thirds, expansive view, warm amber light, 8k wallpaper quality"`
>    - Always exclude: `"nudity, naked, nsfw, pornographic, explicit, watermarks, text, blurry, low quality, cropped head, missing limbs, bad anatomy"`.
> 6. **File Organization**: Video maker scripts (`make_<topic>_explainer.py`) must be placed in `packages/ClipPilot/my_videos/<YYYY-MM-DD>/` organized by creation date. Core engines (`chatterbox_engine.py`, `produce_short_zimage.py`) must stay inside `scripts/generators/`. Asset outputs land in `packages/ClipPilot/data/explainer_<id>/`.

---

## 🚫 1. Strict Content Moderation & Safety Rules

- **Zero-Tolerance for Explicit Content**: No nudity, NSFW, pornographic, or suggestive images are permitted anywhere in the pipeline.
- **Mandatory Safety Negative Prompt**: Every AI image prompt generated or executed MUST include the following negative terms:
  ```text
  nudity, naked, nsfw, pornographic, explicit content, sexual content, uncensored, revealing clothing, watermark, text, blurry, low quality, cropped head, missing limbs, bad anatomy
  ```
- **B-Roll Search Filtering**: All web b-roll queries (Openverse/Bing/Pexels) must use safe-search parameters and strictly filter out inappropriate results.

---

## 📐 2. Aspect Ratio & Zero-Crop Rules

### A. YouTube Shorts (9:16 — 1080 × 1920 or 2160 × 3840 @ 60 FPS)
When assembling images into a vertical 9:16 short:
- **Problem**: Standard `crop=1080:1920` cuts off 40% of the left and right sides (chopping off animal tails, text, and diagram labels).
- **Solution**: Use the **Split Blurred-Background Filter Graph**:
```python
# FFmpeg zero-crop 9:16 60 FPS filter graph
vf = (
    "split[a][b];"
    "[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
    "boxblur=30:15,eq=brightness=-0.15:contrast=1.05[bg];"
    "[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,"
    f"{scale_expr},crop=1080:1920,"
    "eq=contrast=1.06:saturation=1.10:brightness=-0.015,"
    "unsharp=5:5:0.55,"
    f"fade=t=in:st=0:d=0.18,"
    f"fade=t=out:st={max(0.0, seconds - 0.20):.3f}:d=0.20,"
    "format=yuv420p"
)
```

### B. YouTube Long Videos (16:9 — 3840 × 2160 4K @ 60 FPS)
When assembling vertical or square images into a 16:9 widescreen video:
```python
# FFmpeg zero-crop 16:9 60 FPS filter graph (3840x2160 4K Widescreen)
vf = (
    "split[a][b];"
    "[a]scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,"
    "boxblur=40:20,eq=brightness=-0.2:contrast=1.05[bg];"
    "[b]scale=3840:2160:force_original_aspect_ratio=decrease[fg];"
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,"
    f"{scale_expr},crop=3840:2160,"
    "format=yuv420p"
)
```

---

## 🎨 3. How to Craft High-Quality Image Prompts

When requesting image generation or using AI image models (Z-Image-Turbo, Flux, Midjourney):

### Best Practices for Prompts
1. **Define Subject & Framing**:
   - *Shorts (9:16)*: `"Vertical portrait composition, subject centered in frame, full subject visible"`
   - *Long Videos (16:9)*: `"Widescreen 16:9 cinematic shot, expansive horizon, rule of thirds composition"`
2. **Specify Lighting & Mood**:
   - `"Golden hour lighting, soft volumetric rays, warm amber tones, 8k resolution, photorealistic"`
3. **Specify Camera & Lens**:
   - `"Macro 85mm f/1.4 lens, shallow depth of field, soft creamy bokeh background"`
4. **Safety & Negative Prompts**:
   - Always exclude: `"nudity, naked, nsfw, pornographic, explicit, watermark, text, blurry, low quality, cropped head, missing limbs, bad anatomy"`

---

## 📋 4. Mandatory `manifest.json` Structure (with Image Timeline)

Every video build **MUST** output a JSON manifest at `packages/ClipPilot/data/manifest_explainer_<id>.json`.

### Complete Required Manifest Schema
```json
{
  "project_info": {
    "id": "explainer_dogsniff",
    "created_at": "2026-08-01T21:00:00Z",
    "status": "ready_to_upload",
    "generation_params": {
      "title": "Why Do Dogs Sniff Each Other's Butts?",
      "script": "Full narration script text...",
      "keywords": ["dog nose", "canine scent"]
    }
  },
  "assets": {
    "video_path": "/absolute/path/to/why_dogs_sniff_butts_explainer.mp4",
    "default_cover_path": "/absolute/path/to/covers/cover_explainer_dogsniff.jpg",
    "cover_timestamp": "2.0",
    "aspect_ratio": "9:16",
    "resolution": "1080x1920 @ 60FPS",
    "fps": 60,
    "quality_crf": 16,
    "image_timeline": [
      {
        "clip_index": 0,
        "start_s": 0.0,
        "end_s": 4.87,
        "duration_s": 4.87,
        "image_path": "/absolute/path/to/explainer_dogsniff/slide_00.mp4",
        "prompt": "Vertical portrait 9:16 photo of two golden retrievers greeting nose to nose in a sunny park, golden hour light, photorealistic 8k",
        "keyword": "dog greeting nose sniffing park",
        "caption_text": "YOUR DOG JUST SNIFFED A STRANGER'S BUTT 🐶"
      }
    ]
  },
  "master_metadata": {
    "title": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑 (The Secret Science)",
    "description": "Discover the wild science behind why dogs sniff each other's butts!",
    "hashtags": ["#shorts", "#dogs", "#dogfacts", "#science", "#pets"],
    "video_tags": ["why dogs sniff butts", "dog behavior", "dog facts"],
    "language": "en"
  },
  "platforms": {
    "youtube": {
      "enabled": true,
      "title": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑 (The Secret Science)",
      "description": "Discover the wild science...\n\n#shorts #dogs #science",
      "hashtags": ["shorts", "dogs", "science"],
      "video_tags": ["why dogs sniff butts", "dog behavior"],
      "scheduled_at": "2026-08-02T18:00:00Z",
      "privacy": "private",
      "category_id": "15"
    },
    "instagram": {
      "enabled": true,
      "caption": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑\n\n#shorts #dogs #reels",
      "scheduled_at": "2026-08-02T19:30:00Z"
    },
    "tiktok": {
      "enabled": true,
      "caption": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑 #fyp #shorts #dogs",
      "scheduled_at": "2026-08-02T17:00:00Z"
    }
  }
}
```

---

## 📁 5. Project Directory Conventions

```
shorts-factory/
├── packages/
│   └── ClipPilot/
│       ├── data/
│       │   ├── explainer_<id>/                  <-- Audio, broll, slides & final MP4
│       │   └── manifest_explainer_<id>.json    <-- Mandatory upload manifest with timeline
│       └── my_videos/
│           ├── <YYYY-MM-DD>/                   <-- Video maker scripts organized by date
│           │   └── make_<topic>_explainer.py
│           └── ...
└── scripts/
    └── generators/                              <-- Core TTS engines & batch tools ONLY
        ├── chatterbox_engine.py
        └── produce_short_zimage.py
```

- **DO NOT** place video creator scripts directly in `generators/` — keep them inside `my_videos/<YYYY-MM-DD>/`.
- **DO NOT** move engine files (`chatterbox_engine.py`, `produce_short_zimage.py`) out of `scripts/generators/`.

---

## 🛠 6. How to Run Video Builders

### Running a ClipPilot Explainer Short (9:16 @ 60 FPS)
```bash
cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
PYTHONPATH="$PWD/src" python3 my_videos/2026-08-01/make_dog_sniff_explainer.py
```

### Free High-Quality Stack
- **FPS**: 60 FPS (`-r 60` / `fps=60`)
- **Render Quality**: CRF 16 (H.264 high profile)
- **Audio Quality**: 48kHz sample rate, 320k AAC bitrate
- **Safety**: Safe-search b-roll + strict negative prompt content filtering
- **TTS**: `edge-tts` (Microsoft Neural voices) or `Chatterbox` (Local GPU)
- **Assembly**: FFmpeg hardware-accelerated rendering with zero-crop blurred background padding
