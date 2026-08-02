"""Make a ~55s ClipPilot 60 FPS animated short: 'What If Mosquitoes Drank Cola Instead of Blood?'

Format : 9:16 vertical (YouTube Shorts / TikTok / Instagram Reels)
Output  : packages/ClipPilot/data/explainer_mosquitocola/
Manifest: packages/ClipPilot/data/manifest_explainer_mosquitocola.json

Run:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-01/make_mosquito_cola_short.py
"""
from __future__ import annotations

import json
import math
import shutil
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup — works regardless of where the script is called from
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
CLIP_PILOT_ROOT = HERE.parents[1]          # …/packages/ClipPilot
SRC_DIR = CLIP_PILOT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from clippilot.generate import assemble as A
from clippilot.generate import broll as B
from clippilot.media import captions as C
from clippilot.media import edit as E
from clippilot.media import signals, tts

# ---------------------------------------------------------------------------
# Video identity
# ---------------------------------------------------------------------------
VIDEO_ID  = "mosquitocola"
TITLE     = "What If Mosquitoes Drank Cola Instead of Blood?"

# ---------------------------------------------------------------------------
# Narration script  (~145 words → ~55s at 155 wpm)
# Hook-driven hypothetical science — optimised for watch-time and shares.
# ---------------------------------------------------------------------------
SCRIPT = (
    "What if mosquitoes drank cola instead of blood? "
    "At first, that sounds like a dream. No more itchy bites at the barbecue. "
    "But here is the problem — mosquitoes actually need blood for one specific reason: "
    "the proteins and iron inside it help females produce eggs. "
    "Cola has zero of that. "
    "A mosquito that drank only cola would be the happiest insect alive — "
    "and completely infertile. "
    "Within two weeks, the entire mosquito population collapses. "
    "Sounds perfect. "
    "Except — mosquitoes pollinate over 300 plant species. "
    "Bats, birds, and frogs that eat them would start dying off. "
    "Fish larvae that feed on mosquito larvae would vanish. "
    "The whole food web unravels. "
    "We would trade two weeks of itch-free summers "
    "for a slow ecological collapse. "
    "So next time a mosquito lands on you — "
    "remember: it is basically the most hated keystone species on the planet."
)

# ---------------------------------------------------------------------------
# Pre-generated 9:16 scene images (blurred-pad protected, never cropped)
# ---------------------------------------------------------------------------
_IMG_DIR = CLIP_PILOT_ROOT.parent.parent / "output" / "generated_images"
SCENE_IMAGES = [
    _IMG_DIR / "mosquito_scene_01.png",   # macro mosquito face — hook
    _IMG_DIR / "mosquito_scene_02.png",   # mosquito drinking cola can
    _IMG_DIR / "mosquito_scene_03.png",   # sugar anatomy diagram
    _IMG_DIR / "mosquito_scene_04.png",   # swollen cola mosquito
    _IMG_DIR / "mosquito_scene_05.png",   # thriving jungle ecosystem
    _IMG_DIR / "mosquito_scene_06.png",   # barren dead ecosystem
    _IMG_DIR / "mosquito_scene_07.png",   # mosquito cola factory cartoon
    _IMG_DIR / "mosquito_scene_08.png",   # happy human in park — outro
]

# B-roll fallback keywords (used if pre-generated images are missing)
KEYWORDS = [
    "mosquito extreme macro close up face",
    "mosquito drinking soda cola funny",
    "insect anatomy sugar science diagram",
    "mosquito swollen abdomen droplets",
    "tropical forest ecosystem wildlife",
    "barren dead winter tundra landscape",
    "funny cartoon insect factory",
    "happy person relaxing sunny park bench",
]

# ---------------------------------------------------------------------------
# Output paths
# ---------------------------------------------------------------------------
OUT_DIR = CLIP_PILOT_ROOT / "data" / f"explainer_{VIDEO_ID}"
FINAL   = OUT_DIR / f"mosquito_cola_short.mp4"

COMBINE_MS = 820


# ---------------------------------------------------------------------------
# Caption helpers
# ---------------------------------------------------------------------------
def _karaoke_pages(words, duration):
    """Whisper words → karaoke pages. Falls back to TTS proportional timing."""
    if words:
        pages = C.pages_for_clip(words, 0.0, duration, combine_within_ms=COMBINE_MS)
        if pages:
            return pages, "whisper"
    toks = tts.word_timings(SCRIPT, duration)
    raw  = C.create_tiktok_style_captions(toks, combine_within_ms=COMBINE_MS)["pages"]
    pages = []
    for p in raw:
        start = p["start_ms"] / 1000.0
        dur   = p["duration_ms"]
        end   = start + (dur / 1000.0 if math.isfinite(dur) and dur > 0 else 2.0)
        pages.append({
            "start":  round(start, 3),
            "end":    round(end, 3),
            "tokens": p.get("tokens", []),
        })
    return pages, "tts-estimate"


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    broll_dir = OUT_DIR / "broll"

    # ── 1. Collect images ──────────────────────────────────────────────────
    existing = [p for p in SCENE_IMAGES if p.exists()]
    print(f"1/5  Found {len(existing)}/{len(SCENE_IMAGES)} pre-generated scene images")
    if len(existing) < len(SCENE_IMAGES):
        missing = [p.name for p in SCENE_IMAGES if not p.exists()]
        print(f"   Missing: {missing}")

    # ── 2. TTS narration ───────────────────────────────────────────────────
    wav = str(OUT_DIR / "narration.wav")
    print("2/5  Synthesizing narration (edge-tts 48kHz)...")
    res = tts.synthesize(SCRIPT, wav)
    if not res.get("available"):
        print(f"   ! TTS failed: {res.get('reason')}")
        return 1
    duration = signals.probe(wav).duration_s or 0.0
    words    = len(SCRIPT.split())
    print(f"   narration: {duration:.1f}s  ({words} words, ~{words / duration * 60:.0f} wpm)")

    # ── 3. B-roll fetch if needed ──────────────────────────────────────────
    fetched = []
    if len(existing) < 4:
        print("3/5  Fetching content-matched b-roll (fallback)...")
        fetched = B.fetch_broll_images(KEYWORDS, str(broll_dir), per_keyword=2, max_images=12)
    images = [str(p) for p in existing] + fetched
    print(f"   total {len(images)} image(s) for slideshow")

    # ── 4. Build 60 FPS Ken-Burns slideshow ───────────────────────────────
    base = str(OUT_DIR / "base.mp4")
    if images:
        print("4/5  Building 60 FPS Ken-Burns slideshow timed to narration...")
        video  = A.assemble_slideshow(images, wav, base, fps=60)
        visual = "content-matched slideshow (60 FPS)"
    else:
        video = None

    if not video:
        print("4/5  Falling back to animated gradient + title card...")
        video  = A.assemble_short(wav, base, title=TITLE, fps=60)
        visual = "animated gradient + title (60 FPS)"

    if not video:
        print("   ! assemble failed")
        return 1
    print(f"   base video: {visual}")

    # ── 5. Word-synced karaoke captions ───────────────────────────────────
    print("5/5  Transcribing for karaoke captions...")
    from clippilot.media import transcribe as TR
    words_list = []
    if TR.whisper_available():
        try:
            tr = TR.transcribe(video, model_size="base")
            words_list = tr.get("words") or []
        except Exception as exc:  # noqa: BLE001
            print(f"   (whisper unavailable: {exc})")

    pages, src = _karaoke_pages(words_list, duration)
    print(f"   {len(pages)} caption pages  (timing: {src})")

    ass   = str(OUT_DIR / "captions.ass")
    style = E.skin_style("karaoke_yellow")
    E.write_ass_karaoke(pages, ass, width=1080, height=1920, **style)

    # Clean wrap style
    _p = Path(ass)
    _p.write_text(
        _p.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"),
        encoding="utf-8",
    )

    # ── 6. Burn captions → final ───────────────────────────────────────────
    print("5/5  Burning karaoke captions into final video...")
    final = E.burn_subtitles(video, ass, str(FINAL))
    if not final:
        print("   ! caption burn-in failed; base video at:", base)
        return 1

    # Friendly alias: Final_Mosquitocola.mp4
    alias = OUT_DIR / f"Final_{OUT_DIR.name.replace('explainer_', '').title()}.mp4"
    shutil.copy2(final, alias)

    # ── 7. Build image_timeline for editor UI ─────────────────────────────
    per_dur  = duration / max(1, len(images))
    timeline = []
    for idx, img_path in enumerate(images):
        st        = idx * per_dur
        et        = min(duration, (idx + 1) * per_dur)
        kw        = KEYWORDS[idx % len(KEYWORDS)]
        slide_f   = OUT_DIR / f"slide_{idx:02d}.mp4"
        cap_text  = (
            pages[idx]["tokens"][0]["text"]
            if idx < len(pages) and pages[idx].get("tokens")
            else TITLE
        )
        timeline.append({
            "clip_index":       idx,
            "start_s":          round(st, 2),
            "end_s":            round(et, 2),
            "duration_s":       round(et - st, 2),
            "image_path":       str(Path(img_path).resolve()),
            "slide_video_path": str(slide_f.resolve()) if slide_f.exists() else None,
            "keyword":          kw,
            "prompt": (
                f"Vertical portrait 9:16 composition, subject centered in frame, "
                f"full subject visible, golden hour light, photorealistic 8k, "
                f"crisp focal detail. Scene: {kw}"
            ),
            "caption_text": cap_text,
        })

    # ── 8. Write manifest ──────────────────────────────────────────────────
    manifest_path = CLIP_PILOT_ROOT / "data" / f"manifest_explainer_{VIDEO_ID}.json"
    manifest = {
        "project_info": {
            "id":         f"explainer_{VIDEO_ID}",
            "created_at": "2026-08-01T22:00:00Z",
            "status":     "ready_to_upload",
            "generation_params": {
                "starting_prompt": "What if mosquitoes drank cola instead of blood?",
                "title":    TITLE,
                "script":   SCRIPT,
                "keywords": KEYWORDS,
                "target_fps": 60,
                "target_crf": 16,
                "aspect_ratio": "9:16",
            },
        },
        "assets": {
            "video_path":        str(Path(final).resolve()),
            "final_alias_path":  str(alias.resolve()),
            "default_cover_path": str(
                (CLIP_PILOT_ROOT / "data" / "covers" / f"cover_explainer_{VIDEO_ID}.jpg").resolve()
            ),
            "cover_timestamp": "2.0",
            "aspect_ratio":    "9:16",
            "resolution":      "1080x1920 @ 60FPS",
            "fps":             60,
            "quality_crf":     16,
            "audio_sample_rate": 48000,
            "audio_bitrate":   "320k",
            "image_timeline":  timeline,
        },
        "master_metadata": {
            "title":       "What If Mosquitoes Drank Cola Instead of Blood? (Science)",
            "description": (
                "A wild hypothetical: what would really happen if mosquitoes swapped "
                "blood for cola? The answer could collapse entire ecosystems."
            ),
            "hashtags":   ["#shorts", "#science", "#mosquito", "#whatif", "#nature", "#facts"],
            "video_tags": [
                "what if mosquitoes drank cola", "mosquito science facts",
                "hypothetical science", "ecology facts", "nature shorts",
            ],
            "language": "en",
        },
        "platforms": {
            "youtube": {
                "enabled":     True,
                "title":       "What If Mosquitoes Drank Cola Instead of Blood? #shorts",
                "description": (
                    "A wild hypothetical: what would really happen if mosquitoes swapped "
                    "blood for cola?\n\n"
                    "#shorts #science #mosquito #whatif #nature #facts"
                ),
                "hashtags":    ["shorts", "science", "mosquito", "whatif", "nature", "facts"],
                "video_tags":  [
                    "what if mosquitoes drank cola", "mosquito science",
                    "hypothetical science", "nature shorts",
                ],
                "scheduled_at": "2026-08-02T18:00:00Z",
                "privacy":      "private",
                "category_id":  "28",
            },
            "instagram": {
                "enabled":  True,
                "caption": (
                    "What if mosquitoes drank cola instead of blood? "
                    "The answer is both hilarious and terrifying. "
                    "\n\n#shorts #science #mosquito #whatif #nature #reels #viral"
                ),
                "scheduled_at": "2026-08-02T19:30:00Z",
            },
            "tiktok": {
                "enabled":  True,
                "caption":  (
                    "What if mosquitoes drank cola? "
                    "#fyp #foryou #viral #shorts #science #nature #mosquito #whatif"
                ),
                "scheduled_at": "2026-08-02T17:00:00Z",
            },
            "facebook_reels": {
                "enabled":  True,
                "caption":  (
                    "What if mosquitoes drank cola instead of blood? "
                    "The science behind this will blow your mind. #science #nature #whatif"
                ),
                "scheduled_at": "2026-08-02T20:00:00Z",
            },
            "x": {
                "enabled":  True,
                "caption":  (
                    "What if mosquitoes drank cola instead of blood? "
                    "Science says it would end the world. Here's why. #science #nature"
                ),
                "scheduled_at": "2026-08-02T18:30:00Z",
            },
            "threads": {
                "enabled":  True,
                "caption":  (
                    "What if mosquitoes drank cola? "
                    "Two weeks later: no more mosquitoes. But also... no more planet. "
                    "#science #nature #whatif"
                ),
                "scheduled_at": "2026-08-02T19:00:00Z",
            },
            "snapchat": {
                "enabled":  True,
                "caption":  "Cola vs blood — which kills the planet faster? #science #nature",
                "scheduled_at": "2026-08-02T17:30:00Z",
            },
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # ── Done ───────────────────────────────────────────────────────────────
    dur = signals.probe(final).duration_s or 0.0
    print("\n[OK] ClipPilot 60 FPS Short ready!")
    print(f"   Final video  : {Path(final).resolve()}")
    print(f"   Alias        : {alias.resolve()}")
    print(f"   Manifest     : {manifest_path.resolve()}")
    print(f"   Data folder  : {OUT_DIR.resolve()}")
    print(
        f"   Stats        : {dur:.1f}s · 1080x1920 60FPS CRF-16 · "
        f"{visual} · karaoke captions ({src})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
