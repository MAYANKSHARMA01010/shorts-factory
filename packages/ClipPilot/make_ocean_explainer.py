"""Make a ~45s animated explainer: "Why is the sky blue?"

Uses ClipPilot's own Section-B building blocks end to end — only the *brain*
(script + visual search terms) is supplied here, because without an
ANTHROPIC_API_KEY the stock script generator returns a generic template, and a
generic template about Rayleigh scattering would be slop. So we hand the pipeline
a correct, lively script and let it do the real work: SAPI narration, free
(no-key) content-matched b-roll, a Ken-Burns slideshow, whisper word-timing, and
karaoke caption burn-in.

Run:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/ClipPilot
    PYTHONPATH="$PWD/src" python make_sky_explainer.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from clippilot.generate import assemble as A
from clippilot.generate import broll as B
from clippilot.media import captions as C
from clippilot.media import edit as E
from clippilot.media import signals, tts

# ── the brain: a correct, scroll-stopping ~45s script (acting as Claude) ──────
TITLE = "Why is the ocean salty?"
# ~111 words → ~45s at SAPI's ~148 wpm.
SCRIPT = (
    """Have you ever swallowed a mouthful of ocean water? It's incredibly salty! But where does all that salt come from? It actually starts on land. Rainwater is slightly acidic because it absorbs carbon dioxide from the air. As this rain falls on rocks, it slowly breaks them down, creating electrically charged particles called ions. Rivers and streams carry these dissolved ions all the way to the ocean. The two most common ions are sodium and chloride, which make up over 90 percent of all dissolved ions in seawater. When they combine, they form plain old salt. Over billions of years, this process has turned our vast oceans into a giant saltwater bath!"""
)
# Visual beats, in narrative order → free Openverse/Bing stills (no API key).
KEYWORDS = [
    "crashing ocean waves",
    "rain falling on rocks",
    "river flowing into ocean",
    "salt crystals macro",
    "beautiful blue ocean aerial",
]

OUT_DIR = Path(__file__).resolve().parent / "data" / "explainer_ocean_salty"
FINAL = OUT_DIR / "why_ocean_is_salty.mp4"


# Keep pages short (~3 words) so big 92px uppercase karaoke lines fit 1080px wide.
COMBINE_MS = 820


def _karaoke_pages_from_words(words, duration):
    """Whisper words → clip-local karaoke pages. Falls back to SAPI proportional
    word timing when whisper produced nothing (e.g. model couldn't download)."""
    if words:
        pages = C.pages_for_clip(words, 0.0, duration, combine_within_ms=COMBINE_MS)
        if pages:
            return pages, "whisper"
    # Fallback: estimate word timing from the script proportionally (no network).
    toks = tts.word_timings(SCRIPT, duration)
    raw = C.create_tiktok_style_captions(toks, combine_within_ms=COMBINE_MS)["pages"]
    pages = []
    for p in raw:
        start = p["start_ms"] / 1000.0
        dur = p["duration_ms"]
        end = start + (dur / 1000.0 if math.isfinite(dur) and dur > 0 else 2.0)
        pages.append({"start": round(start, 3), "end": round(end, 3),
                      "tokens": p.get("tokens", [])})
    return pages, "sapi-estimate"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    broll_dir = OUT_DIR / "broll"

    # 1) Narration (Windows SAPI) ────────────────────────────────────────────
    wav = str(OUT_DIR / "narration.wav")
    print("1/5  Narrating with SAPI…")
    res = tts.synthesize(SCRIPT, wav)
    if not res.get("available"):
        print(f"   ! TTS failed: {res.get('reason')}")
        return 1
    duration = signals.probe(wav).duration_s or 0.0
    words = len(SCRIPT.split())
    print(f"   narration: {duration:.1f}s  ({words} words, ~{words / duration * 60:.0f} wpm)")

    # 2) Content-matched b-roll (free, no key: Openverse → Bing) ──────────────
    print("2/5  Sourcing content-matched b-roll (Openverse/Bing, no key)…")
    images = B.fetch_broll_images(KEYWORDS, str(broll_dir), per_keyword=2, max_images=12)
    print(f"   fetched {len(images)} image(s) across {len(KEYWORDS)} visual beats")

    # 3) Assemble the base vertical video timed to the narration ──────────────
    base = str(OUT_DIR / "base.mp4")
    if images:
        print("3/5  Building Ken-Burns slideshow timed to the narration…")
        video = A.assemble_slideshow(images, wav, base)
        visual = "content-matched slideshow"
    else:
        video = None
    if not video:  # no network / no images → still a narrated, titled gradient
        print("3/5  No b-roll available — falling back to an animated gradient + title card…")
        video = A.assemble_short(wav, base, title=TITLE)
        visual = "animated gradient + title"
    if not video:
        print("   ! assemble failed")
        return 1
    print(f"   base video: {visual}")

    # 4) Word-timed karaoke captions (whisper → SAPI-estimate fallback) ───────
    print("4/5  Transcribing for word-synced karaoke captions…")
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
    # Safety net: the ASS header hardcodes WrapStyle 2 (no auto-wrap), so a rare
    # long page bleeds off-frame. Switch to 0 (smart wrap) so it wraps instead.
    _p = Path(ass)
    _p.write_text(_p.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"),
                  encoding="utf-8")

    # 5) Burn captions → final deliverable ────────────────────────────────────
    print("5/5  Burning karaoke captions into the final video…")
    final = E.burn_subtitles(video, ass, str(FINAL))
    if not final:
        print("   ! caption burn-in failed; the un-captioned base video is still at:", base)
        return 1

    dur = signals.probe(final).duration_s or 0.0
    print("\n[OK] Explainer ready")
    print(f"   {Path(final).resolve()}")
    print(f"   {dur:.1f}s · 1080x1920 · {visual} · karaoke captions ({src})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
