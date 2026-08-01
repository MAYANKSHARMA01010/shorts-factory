"""Make a ~50s ClipPilot animated explainer: 'Why Dogs Sniff Each Other's Butts (The Science)'

Uses the native ClipPilot pipeline (clippilot.generate, clippilot.media, broll sourcing, karaoke subtitles).

Run:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-01/make_dog_sniff_explainer.py
"""
from __future__ import annotations

import math
import shutil
import sys
from pathlib import Path

# Ensure src/ is on sys.path
HERE = Path(__file__).resolve().parent
CLIP_PILOT_ROOT = HERE.parents[1]
SRC_DIR = CLIP_PILOT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from clippilot.generate import assemble as A
from clippilot.generate import broll as B
from clippilot.media import captions as C
from clippilot.media import edit as E
from clippilot.media import signals, tts

TITLE = "Why Dogs Sniff Each Other's Butts (The Secret Science)"

SCRIPT = (
    "Your dog just sniffed a stranger's butt for five seconds straight. "
    "You were mortified. Your dog? Completely unbothered — "
    "because they just learned more about that dog than you know about most people. "
    "Inside a dog's tail are two tiny glands called anal sacs. "
    "Every dog's sacs produce a unique chemical cocktail — like a fingerprint for your nose. "
    "One sniff reveals the other dog's age, sex, diet, stress levels, and health status. "
    "Oh, and yes — they can smell cancer. Dogs are basically walking MRI machines. "
    "Their noses pack three hundred million scent receptors. Humans have six million. We cannot compete. "
    "They also have a second nose called the Jacobson's organ on the roof of their mouth. "
    "It fires scent signals straight to the emotion centre — no thinking required. "
    "Confident dog? It starts the sniff. Nervous dog? Tucks its tail to hide its own profile. "
    "Dogs that already know each other skip the whole ritual. "
    "They already have each other's number. "
    "So next time your dog embarrasses you at the park — "
    "just know they got a full biography in under three seconds."
)

KEYWORDS = [
    "dog greeting nose sniffing park",
    "dog nose macro extreme close up",
    "canine anatomy science diagram",
    "two dogs playing sunny field",
    "funny dog detective sniffing",
    "happy golden retriever running park",
]

OUT_DIR = CLIP_PILOT_ROOT / "data" / "explainer_dogsniff"
FINAL = OUT_DIR / "why_dogs_sniff_butts_explainer.mp4"

COMBINE_MS = 820


def _karaoke_pages_from_words(words, duration):
    """Whisper words -> karaoke pages. Falls back to TTS proportional timing."""
    if words:
        pages = C.pages_for_clip(words, 0.0, duration, combine_within_ms=COMBINE_MS)
        if pages:
            return pages, "whisper"
    toks = tts.word_timings(SCRIPT, duration)
    raw = C.create_tiktok_style_captions(toks, combine_within_ms=COMBINE_MS)["pages"]
    pages = []
    for p in raw:
        start = p["start_ms"] / 1000.0
        dur = p["duration_ms"]
        end = start + (dur / 1000.0 if math.isfinite(dur) and dur > 0 else 2.0)
        pages.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "tokens": p.get("tokens", []),
        })
    return pages, "tts-estimate"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    broll_dir = OUT_DIR / "broll"

    # 1. Check generated images first or fetch b-roll
    gen_img_dir = CLIP_PILOT_ROOT.parent.parent / "output" / "generated_images"
    existing_imgs = sorted(list(gen_img_dir.glob("dog_scene_*.png"))) if gen_img_dir.exists() else []

    wav = str(OUT_DIR / "narration.wav")
    print("1/5  Synthesizing narration with ClipPilot TTS...")
    res = tts.synthesize(SCRIPT, wav)
    if not res.get("available"):
        print(f"   ! TTS failed: {res.get('reason')}")
        return 1
    duration = signals.probe(wav).duration_s or 0.0
    words = len(SCRIPT.split())
    print(f"   narration: {duration:.1f}s ({words} words, ~{words / duration * 60:.0f} wpm)")

    print("2/5  Sourcing content-matched b-roll images...")
    fetched_images = B.fetch_broll_images(KEYWORDS, str(broll_dir), per_keyword=2, max_images=12)
    images = [str(p) for p in existing_imgs] + fetched_images
    print(f"   total {len(images)} image(s) available (custom + fetched)")

    base = str(OUT_DIR / "base.mp4")
    if images:
        print("3/5  Building 60 FPS Ken-Burns slideshow timed to narration...")
        video = A.assemble_slideshow(images, wav, base, fps=60)
        visual = "content-matched slideshow (60 FPS)"
    else:
        video = None

    if not video:
        print("3/5  Falling back to animated gradient + title card...")
        video = A.assemble_short(wav, base, title=TITLE, fps=60)
        visual = "animated gradient + title (60 FPS)"

    if not video:
        print("   ! assemble failed")
        return 1
    print(f"   base video: {visual}")

    print("4/5  Transcribing for word-synced karaoke captions...")
    from clippilot.media import transcribe as TR
    words_list = []
    if TR.whisper_available():
        try:
            tr = TR.transcribe(video, model_size="base")
            words_list = tr.get("words") or []
        except Exception as exc:  # noqa: BLE001
            print(f"   (whisper unavailable: {exc})")

    pages, src = _karaoke_pages_from_words(words_list, duration)
    print(f"   {len(pages)} caption pages (timing: {src})")

    ass = str(OUT_DIR / "captions.ass")
    style = E.skin_style("karaoke_yellow")
    E.write_ass_karaoke(pages, ass, width=1080, height=1920, **style)

    # Clean wrap style
    _p = Path(ass)
    _p.write_text(
        _p.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"),
        encoding="utf-8"
    )

    print("5/5  Burning karaoke captions into final video...")
    final = E.burn_subtitles(video, ass, str(FINAL))
    if not final:
        print("   ! caption burn-in failed; base video at:", base)
        return 1

    final_alias = OUT_DIR / f"Final_{OUT_DIR.name.replace('explainer_', '').title()}.mp4"
    shutil.copy2(final, final_alias)

    # Build image_timeline array for the clip editor UI
    per_dur = duration / max(1, len(images))
    timeline = []
    for idx, img_path in enumerate(images):
        st = idx * per_dur
        et = min(duration, (idx + 1) * per_dur)
        kw = KEYWORDS[idx % len(KEYWORDS)]
        slide_file = OUT_DIR / f"slide_{idx:02d}.mp4"
        timeline.append({
            "clip_index": idx,
            "start_s": round(st, 2),
            "end_s": round(et, 2),
            "duration_s": round(et - st, 2),
            "image_path": str(Path(img_path).resolve()),
            "slide_video_path": str(slide_file.resolve()) if slide_file.exists() else None,
            "keyword": kw,
            "prompt": f"Vertical 9:16 portrait composition for {kw}, photorealistic 8k, golden hour light, centered focal subject",
            "caption_text": pages[idx]["tokens"][0]["text"] if idx < len(pages) and pages[idx].get("tokens") else TITLE,
        })

    # Auto-generate manifest.json in data/
    manifest_path = CLIP_PILOT_ROOT / "data" / "manifest_explainer_dogsniff.json"
    manifest_data = {
        "project_info": {
            "id": "explainer_dogsniff",
            "created_at": "2026-08-01T21:00:00Z",
            "status": "ready_to_upload",
            "generation_params": {
                "starting_prompt": "Make a ~50s 60 FPS animated explainer: 'Why Dogs Sniff Each Other's Butts (The Science)'",
                "title": TITLE,
                "script": SCRIPT,
                "keywords": KEYWORDS,
                "target_fps": 60,
                "target_crf": 16,
            }
        },
        "assets": {
            "video_path": str(Path(final).resolve()),
            "default_cover_path": str((CLIP_PILOT_ROOT / "data" / "covers" / "cover_explainer_dogsniff.jpg").resolve()),
            "cover_timestamp": "2.0",
            "aspect_ratio": "9:16",
            "resolution": "1080x1920 @ 60FPS",
            "fps": 60,
            "quality_crf": 16,
            "audio_sample_rate": 48000,
            "audio_bitrate": "320k",
            "image_timeline": timeline,
        },
        "master_metadata": {
            "title": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑 (The Secret Science)",
            "description": "Discover the wild science behind why dogs sniff each other's butts!",
            "hashtags": ["#shorts", "#dogs", "#dogfacts", "#science", "#pets", "#animals"],
            "video_tags": ["why dogs sniff butts", "dog behavior", "dog facts", "canine science"],
            "language": "en",
        },
        "platforms": {
            "youtube": {
                "enabled": True,
                "title": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑 (The Secret Science)",
                "description": "Discover the wild science behind why dogs sniff each other's butts!\n\n#shorts #dogs #dogfacts #science #pets #animals",
                "hashtags": ["shorts", "dogs", "dogfacts", "science", "pets", "animals"],
                "video_tags": ["why dogs sniff butts", "dog behavior", "dog facts", "canine science"],
                "scheduled_at": "2026-08-02T18:00:00Z",
                "privacy": "private",
                "category_id": "15",
            },
            "instagram": {
                "enabled": True,
                "caption": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑\n\nYour dog isn't being rude — they're reading a full biography in under 3 seconds! 🤯\n\n#shorts #dogs #dogfacts #science #pets #reels #viral",
                "scheduled_at": "2026-08-02T19:30:00Z",
            },
            "tiktok": {
                "enabled": True,
                "caption": "Why Do Dogs Sniff Each Other's Butts? 🐶🍑 🤯 #fyp #foryou #viral #shorts #dogs #dogfacts #pets",
                "scheduled_at": "2026-08-02T17:00:00Z",
            }
        }
    }
    manifest_path.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")

    dur = signals.probe(final).duration_s or 0.0
    print("\n[OK] ClipPilot 60 FPS Explainer ready!")
    print(f"   Final video : {Path(final).resolve()}")
    print(f"   Manifest    : {manifest_path.resolve()}")
    print(f"   Data folder : {OUT_DIR.resolve()}")
    print(f"   Stats       : {dur:.1f}s · 1080x1920 60FPS (CRF 16) · {visual} · karaoke captions ({src})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
