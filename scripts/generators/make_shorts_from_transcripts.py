"""
Batch-makes ClipPilot short videos from transcript .txt files.

Transcript texts are used DIRECTLY as the narration script — no AI script generation needed.
Each video goes through: transcript -> TTS narration -> content-matched B-roll ->
karaoke captions (faster-whisper) -> punchy-recut (SFX + fast cuts).

Usage:
    python make_shorts_from_transcripts.py             # first 5 transcripts
    python make_shorts_from_transcripts.py --limit 100 # next 100 (after --offset 5)
    python make_shorts_from_transcripts.py --offset 5 --limit 10
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Force UTF-8 stdout on Windows so emoji/arrows in library output don't crash
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[1]
CLIPPILOT_SRC = PROJECT_ROOT / "packages" / "ClipPilot" / "src"
RECUT_PY = PROJECT_ROOT / ".claude" / "skills" / "punchy-recut" / "recut.py"
TRANSCRIPT_DIR = PROJECT_ROOT / "transcripts"
OUT_BASE = PROJECT_ROOT / "output" / "transcript_shorts"

sys.path.insert(0, str(CLIPPILOT_SRC))
# ClipPilot config reads .env relative to CWD; set it to the ClipPilot root
os.chdir(str(PROJECT_ROOT / "packages" / "ClipPilot"))

from clippilot.generate.pipeline import generate_short  # noqa: E402
from clippilot.media import captions as cap              # noqa: E402
from clippilot.media import edit                         # noqa: E402
from clippilot.media import transcribe as tr             # noqa: E402


def _title_from_text(text: str) -> str:
    first = text.split(".")[0].strip()
    return first[:80] if len(first) > 80 else first


def make_short(txt_path: Path, out_base: Path, skin: str = "karaoke_yellow") -> Path | None:
    text = txt_path.read_text(encoding="utf-8").strip()
    if not text:
        print(f"  [SKIP] {txt_path.name}: empty file")
        return None

    video_id = txt_path.stem
    title = _title_from_text(text)
    job_dir = out_base / video_id
    job_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"[{video_id}]  {len(text.split())} words")
    print(f"title : {title[:70]!r}")

    # -- Step 1: TTS + B-roll -> raw video ------------------------------------
    print("Step 1: TTS + B-roll generation...")

    def _generate_fn(prompt: str) -> str:
        # Return our transcript directly — no AI script generation
        return json.dumps({"title": title, "script": text})

    result = generate_short(
        topic=title,
        out_dir=str(job_dir),
        generate_fn=_generate_fn,
        target_seconds=max(20, len(text.split()) // 3),
    )

    if not result.get("available"):
        print(f"  [FAIL] generate_short: {result.get('reason', 'unknown')}")
        return None

    raw_mp4 = Path(result["video_path"])
    print(f"  visual : {result.get('visual', '?')}")
    print(f"  raw    : {raw_mp4.name}")

    # ── Step 2: Transcribe for word-level timings ──────────────────────────────
    print("Step 2: Transcribing (faster-whisper)...")
    wav = str(job_dir / "narration.wav")
    source_for_tr = wav if Path(wav).exists() else str(raw_mp4)
    tr_result = tr.transcribe(source_for_tr, model_size="base")
    words = tr_result.get("words", [])
    has_words = bool(words) and tr_result.get("available")
    print(f"  words  : {len(words) if has_words else 'n/a (transcription failed)'}")

    # ── Step 3: Burn karaoke captions ────────────────────────────────────────
    print("Step 3: Karaoke captions...")
    if has_words:
        duration = result.get("duration_s") or 35.0
        pages = cap.pages_for_clip(words, 0.0, float(duration) + 1.0)
        if pages:
            ass_path = str(job_dir / "captions.ass")
            style = edit.skin_style(skin)
            if skin in edit.KARAOKE_SKINS:
                edit.write_ass_karaoke(pages, ass_path, width=1080, height=1920, **style)
            else:
                cues = [
                    {
                        "start": p["start"],
                        "end": p["end"],
                        "text": " ".join(t.get("text", "") for t in p.get("tokens", [])),
                    }
                    for p in pages
                ]
                edit.write_ass(cues, ass_path, width=1080, height=1920, **style)
            cap_out = str(job_dir / "captioned.mp4")
            burned = edit.burn_subtitles(str(raw_mp4), ass_path, cap_out)
            cap_mp4 = Path(burned) if burned else raw_mp4
            print(f"  captions -> {cap_mp4.name}")
        else:
            print("  [WARN] no caption pages — using raw video")
            cap_mp4 = raw_mp4
    else:
        print("  [WARN] no word timings — skipping captions")
        cap_mp4 = raw_mp4

    # ── Step 4: Punchy-recut ─────────────────────────────────────────────────
    print("Step 4: Punchy-recut (zoom cuts + SFX)...")
    punchy_out = str(job_dir / "final_punchy.mp4")
    r = subprocess.run(
        [sys.executable, str(RECUT_PY), "--input", str(cap_mp4), "--out", punchy_out],
        capture_output=True,
        text=True,
    )
    if r.returncode == 0 and Path(punchy_out).exists():
        final = Path(punchy_out)
        print(f"  [OK] -> {final.name}")
    else:
        if r.stderr:
            print(f"  [WARN] recut failed: {r.stderr[:300]}")
        # Fall back: use captioned video as the final
        final_path = job_dir / "final.mp4"
        shutil.copy2(str(cap_mp4), str(final_path))
        final = final_path
        print(f"  [OK] (no recut) -> {final.name}")

    print(f"\n  DONE: {final}")
    return final


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=5, help="max videos to make (default: 5)")
    parser.add_argument("--offset", type=int, default=0, help="skip first N transcript files")
    parser.add_argument("--skin", default="karaoke_yellow",
                        choices=["classic", "opaque_box", "kinetic_pop", "anime_outline",
                                 "sticker", "karaoke_yellow", "neon_pop"],
                        help="caption skin (default: karaoke_yellow)")
    args = parser.parse_args()

    OUT_BASE.mkdir(parents=True, exist_ok=True)
    txts = sorted(TRANSCRIPT_DIR.glob("*.txt"))
    if not txts:
        print(f"No .txt files found in {TRANSCRIPT_DIR}")
        sys.exit(1)

    batch = txts[args.offset: args.offset + args.limit]
    print(f"Making {len(batch)} shorts  (offset={args.offset}, limit={args.limit})")
    print(f"Transcripts dir : {TRANSCRIPT_DIR}")
    print(f"Output dir      : {OUT_BASE}")
    print(f"Caption skin    : {args.skin}")
    print(f"Files           : {[t.name for t in batch]}")

    results: list[dict] = []
    for txt in batch:
        path = make_short(txt, OUT_BASE, skin=args.skin)
        results.append({"file": txt.name, "output": str(path) if path else None, "ok": path is not None})

    print("\n" + "=" * 60)
    print("BATCH SUMMARY")
    print("=" * 60)
    ok = sum(1 for r in results if r["ok"])
    for r in results:
        tag = "[OK  ]" if r["ok"] else "[FAIL]"
        print(f"  {tag} {r['file']}")
        if r["output"]:
            print(f"         -> {r['output']}")
    print(f"\n{ok}/{len(results)} videos completed successfully.")
    print(f"Output: {OUT_BASE}")


if __name__ == "__main__":
    main()
