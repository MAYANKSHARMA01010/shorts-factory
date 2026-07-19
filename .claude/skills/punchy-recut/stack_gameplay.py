#!/usr/bin/env python3
"""
stack_gameplay.py - the "brainrot" split-screen final stage.

Takes a FINISHED vertical short (the produced/punchy 9:16 video) and a folder of
long, horizontal gameplay videos (e.g. downloads/gta5-gameplay/), then stacks
them into one 9:16 video:

  +--------------------------+
  |   the produced short     |  <- TOP half: your video, kept WHOLE (fit +
  |   (whole frame, fit on   |     blurred fill) so its lower-third captions
  |    its own blurred bg)   |     are never cropped off.
  +--------------------------+
  |   gameplay (center-      |  <- BOTTOM half: a RANDOM clip from the folder,
  |   cropped, MUTED)        |     starting at a RANDOM point, cover-cropped to
  +--------------------------+     fill, audio dropped. Loops if too short.

Only the short's audio survives; the gameplay is silent. Output length == the
short's length. Output canvas == the short's canvas (1080x1920 by default).
Pure stdlib + ffmpeg/ffprobe.

  python .claude/skills/punchy-recut/stack_gameplay.py \
      --input output/my_short_punchy.mp4 \
      --gameplay-dir downloads/gta5-gameplay

Output defaults to <input_stem>_gameplay.mp4 next to the input. The module also
exposes build_stack(...) so recut.py can run this as its final stage.
"""
from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
from pathlib import Path

# yt-dlp encodes '|' in titles as the fullwidth '｜' (U+FF5C); the default Windows
# cp1252 console can't encode it, so logging a filename would crash. Make stdout
# tolerant (utf-8 where the terminal supports it, replace otherwise).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

VIDEO_EXT = {".mp4", ".mkv", ".mov", ".webm", ".m4v", ".avi"}
# Skip partial/temp downloads and obvious junk.
SKIP_SUFFIXES = (".part", ".ytdl", ".tmp", ".crdownload")
MIN_BYTES = 1_000_000  # ignore <1 MB stubs (e.g. aborted .part renamed to .mp4)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-of", "json",
         "-show_entries", "format=duration:stream=width,height,r_frame_rate,codec_type",
         str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    vid = next(s for s in data["streams"] if s["codec_type"] == "video")
    num, den = vid["r_frame_rate"].split("/")
    fps = float(num) / float(den) if float(den) else 30.0
    return {
        "duration": float(data["format"]["duration"]),
        "w": int(vid["width"]),
        "h": int(vid["height"]),
        "fps": round(fps) or 30,
    }


def pick_gameplay(gameplay_dir: Path, rng: random.Random) -> Path:
    """Pick a random *complete* video file from the folder (skips .part/stubs)."""
    cands = [
        p for p in sorted(gameplay_dir.iterdir())
        if p.is_file()
        and p.suffix.lower() in VIDEO_EXT
        and not p.name.lower().endswith(SKIP_SUFFIXES)
        and p.stat().st_size >= MIN_BYTES
    ]
    if not cands:
        raise SystemExit(
            f"ERROR: no complete gameplay videos in {gameplay_dir} "
            f"(looked for {sorted(VIDEO_EXT)}, skipped .part/<1MB stubs)")
    return rng.choice(cands)


def even(x: float) -> int:
    return (int(round(x)) // 2) * 2


def build_stack(
    top: Path,
    gameplay_dir: Path,
    out: Path,
    *,
    split: float = 0.5,
    top_fit: str = "blur",
    gameplay: Path | None = None,
    seed: int | None = None,
    crf: int = 18,
) -> Path:
    """Stack `top` (a finished 9:16 short) over a random muted gameplay clip.

    split    fraction of the height given to the TOP (your video). 0.5 = halves.
    top_fit  'blur' (whole video on a blurred fill, no crop - default, caption-safe),
             'pad' (whole video on black bars), or 'crop' (cover-crop, CUTS captions).
    gameplay explicit clip to use; otherwise a random complete file from the dir.
    seed     RNG seed for reproducible clip/offset choice (default: time-based).
    """
    top, gameplay_dir, out = top.resolve(), gameplay_dir.resolve(), out.resolve()
    if not top.exists():
        raise SystemExit(f"ERROR: input short not found: {top}")
    if not gameplay_dir.is_dir():
        raise SystemExit(f"ERROR: gameplay dir not found: {gameplay_dir}")

    rng = random.Random(seed)
    gp = gameplay.resolve() if gameplay else pick_gameplay(gameplay_dir, rng)

    ti, gi = probe(top), probe(gp)
    W, H, FPS = ti["w"], ti["h"], ti["fps"]
    TH = even(H * split)
    BH = H - TH
    if BH % 2:  # keep both halves even for libx264
        BH -= 1
        TH = H - BH
    dur = ti["duration"]

    # Random window into the (long) gameplay clip; loop if it's somehow shorter.
    loop = gi["duration"] < dur + 0.5
    start = 0.0 if loop else round(rng.uniform(0.0, gi["duration"] - dur), 2)
    print(f"[stack] top {W}x{H}@{FPS} {dur:.2f}s  +  gameplay '{gp.name}'")
    print(f"[stack] layout {W}x{H}: top {W}x{TH} ({top_fit}) / bottom {W}x{BH} "
          f"(cover-crop, muted) | gameplay start {start:.1f}s{' (looped)' if loop else ''}")

    cover_top = (f"scale={W}:{TH}:force_original_aspect_ratio=increase,"
                 f"crop={W}:{TH}")
    if top_fit == "crop":
        top_chain = f"[0:v]fps={FPS},{cover_top},setsar=1,format=yuv420p[top]"
    elif top_fit == "pad":
        top_chain = (f"[0:v]fps={FPS},scale={W}:{TH}:force_original_aspect_ratio=decrease,"
                     f"pad={W}:{TH}:(ow-iw)/2:(oh-ih)/2:color=black,"
                     f"setsar=1,format=yuv420p[top]")
    else:  # blur (default): whole frame fit over a blurred, dimmed cover of itself
        top_chain = (
            f"[0:v]fps={FPS},split=2[tb][tf];"
            f"[tb]{cover_top},boxblur=24:3,eq=brightness=-0.12[bg];"
            f"[tf]scale={W}:{TH}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[top]"
        )

    bottom_chain = (f"[1:v]fps={FPS},scale={W}:{BH}:force_original_aspect_ratio=increase,"
                    f"crop={W}:{BH},setsar=1,format=yuv420p[bot]")
    fc = f"{top_chain};{bottom_chain};[top][bot]vstack=inputs=2[v]"

    cmd = ["ffmpeg", "-hide_banner", "-y", "-i", str(top)]
    if loop:
        cmd += ["-stream_loop", "-1"]
    cmd += ["-ss", f"{start:.2f}", "-t", f"{dur:.3f}", "-i", str(gp),
            "-filter_complex", fc,
            "-map", "[v]", "-map", "0:a?",   # only the short's audio; gameplay muted
            "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
            "-c:a", "aac", "-b:a", "192k",
            "-t", f"{dur:.3f}", "-movflags", "+faststart", str(out)]
    subprocess.run([str(a) for a in cmd], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    print(f"[stack] wrote {out}")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, type=Path,
                    help="finished vertical short (.mp4) to put on TOP")
    ap.add_argument("--gameplay-dir", type=Path, default=Path("downloads/gta5-gameplay"),
                    help="folder of long horizontal gameplay clips (default downloads/gta5-gameplay)")
    ap.add_argument("--gameplay", type=Path, default=None,
                    help="use this specific gameplay file instead of a random one")
    ap.add_argument("--out", type=Path, default=None,
                    help="output path (default <input_stem>_gameplay.mp4)")
    ap.add_argument("--split", type=float, default=0.5,
                    help="fraction of height for the TOP (your) video. default 0.5")
    ap.add_argument("--top-fit", choices=["blur", "pad", "crop"], default="blur",
                    help="how the short fills the top: blur=whole+blurred fill (caption-safe, "
                         "default), pad=whole+black bars, crop=cover-crop (CUTS lower-third captions)")
    ap.add_argument("--seed", type=int, default=None,
                    help="RNG seed for reproducible clip/start choice")
    ap.add_argument("--crf", type=int, default=18)
    args = ap.parse_args()

    out = args.out or args.input.with_name(args.input.stem + "_gameplay.mp4")
    build_stack(args.input, args.gameplay_dir, out,
                split=args.split, top_fit=args.top_fit,
                gameplay=args.gameplay, seed=args.seed, crf=args.crf)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
