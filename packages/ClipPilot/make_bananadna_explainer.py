"""Make a ~50s animated explainer: 'You Share 60% of Your DNA With a Banana'

Topic #025 — science/biology · mid CPM
"""
from __future__ import annotations

import math
from pathlib import Path

from clippilot.generate import assemble as A
from clippilot.generate import broll as B
from clippilot.media import captions as C
from clippilot.media import edit as E
from clippilot.media import signals, tts

# ── brain: ~131 words → ~53s at SAPI's ~148 wpm ──────────────────────────────
TITLE = "You share 60% of your DNA with a banana."
SCRIPT = (
    "You and a banana share sixty percent of the same DNA. That sounds like a joke, "
    "but it is completely true — and the reason why tells you something profound "
    "about all life on Earth. DNA is a set of instructions for building and running "
    "a living cell. Many of the most fundamental instructions — how to generate "
    "energy, how to copy DNA, how to make proteins — are so ancient and so critical "
    "that evolution essentially never changed them. These are called housekeeping "
    "genes, and they work the same way in a banana, a yeast cell, a mouse, and you. "
    "You share about 85% of your DNA with a mouse, 90% with a cat, and 98.7% with "
    "a chimpanzee. The closer the shared evolutionary ancestor, the more DNA you "
    "share. Every organism on Earth is running variations of the same ancient "
    "core code. Life basically copy-pastes what already works."
)

KEYWORDS = [
    "banana fruit yellow close-up",
    "DNA double helix strand",
    "genetics laboratory biology",
    "evolution tree of life",
    "chimpanzee wildlife primate",
]

OUT_DIR = Path(__file__).resolve().parent / "data" / "explainer_bananadna"
FINAL = OUT_DIR / "banana_dna_shared.mp4"

COMBINE_MS = 820


def _karaoke_pages_from_words(words, duration):
    """Whisper words → karaoke pages. Falls back to SAPI proportional timing."""
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
        pages.append({"start": round(start, 3), "end": round(end, 3),
                      "tokens": p.get("tokens", [])})
    return pages, "sapi-estimate"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    broll_dir = OUT_DIR / "broll"

    wav = str(OUT_DIR / "narration.wav")
    print("1/5  Narrating with SAPI…")
    res = tts.synthesize(SCRIPT, wav)
    if not res.get("available"):
        print(f"   ! TTS failed: {res.get('reason')}")
        return 1
    duration = signals.probe(wav).duration_s or 0.0
    words = len(SCRIPT.split())
    print(f"   narration: {duration:.1f}s  ({words} words, ~{words / duration * 60:.0f} wpm)")

    print("2/5  Sourcing content-matched b-roll (Openverse/Bing, no key)…")
    images = B.fetch_broll_images(KEYWORDS, str(broll_dir), per_keyword=2, max_images=12)
    print(f"   fetched {len(images)} image(s) across {len(KEYWORDS)} visual beats")

    base = str(OUT_DIR / "base.mp4")
    if images:
        print("3/5  Building Ken-Burns slideshow timed to the narration…")
        video = A.assemble_slideshow(images, wav, base)
        visual = "content-matched slideshow"
    else:
        video = None
    if not video:
        print("3/5  No b-roll — falling back to animated gradient + title card…")
        video = A.assemble_short(wav, base, title=TITLE)
        visual = "animated gradient + title"
    if not video:
        print("   ! assemble failed")
        return 1
    print(f"   base video: {visual}")

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
    _p = Path(ass)
    _p.write_text(_p.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"),
                  encoding="utf-8")

    print("5/5  Burning karaoke captions into the final video…")
    final = E.burn_subtitles(video, ass, str(FINAL))
    if not final:
        print("   ! caption burn-in failed; un-captioned base video still at:", base)
        return 1

    import shutil
    final_alias = OUT_DIR / f"Final_{OUT_DIR.name.replace('explainer_', '').title()}.mp4"
    shutil.copy2(final, final_alias)

    dur = signals.probe(final).duration_s or 0.0
    print("\n[OK] Explainer ready")
    print(f"   {Path(final).resolve()}")
    print(f"   {dur:.1f}s · 1080x1920 · {visual} · karaoke captions ({src})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
