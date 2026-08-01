"""Make a ~50s animated explainer: 'Your "This Is Not a Bill" Paper Is Hiding Money'

Topic #002 — personal finance/health · high CPM
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
TITLE = "That 'This is not a bill' paper could owe you money."
SCRIPT = (
    "That piece of paper from your insurance company that says 'This is not a bill' "
    "is called an Explanation of Benefits, or EOB. Most people throw it straight "
    "in the bin. That is a costly mistake. Your EOB shows exactly what your "
    "insurance paid and what they decided you owe. But insurers make billing errors "
    "all the time — wrong procedure codes, services marked as uncovered that should "
    "be covered, duplicate charges. A 2023 NerdWallet survey found that 40% of "
    "people who challenged a medical bill got it reduced or eliminated. You have "
    "the legal right to request an itemised bill and dispute any charge within "
    "180 days. One phone call to your insurer's member services line, citing the "
    "specific code they used, resolves most errors. The EOB is your receipt. "
    "Read it before you pay anything."
)

KEYWORDS = [
    "insurance document paper desk",
    "medical bill invoice healthcare",
    "explanation of benefits EOB",
    "person reading financial document",
    "health insurance claim form",
]

OUT_DIR = Path(__file__).resolve().parent / "data" / "explainer_eob"
FINAL = OUT_DIR / "eob_not_a_bill_hiding_money.mp4"

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
