"""
Corrected ClipPilot pipeline: repurpose the ORIGINAL source video for each transcript
(the skill.md way) instead of generating slop b-roll.

Per transcript ID:
  1. Ensure an HD source  -> re-download native HD via yt-dlp (sources are up to 4K),
                             downscale to 1080x1920.  Real-ESRGAN upscale ONLY if the
                             best available source is genuinely low-res (<700 min dim).
  2. Normalize to a clean 1080x1920 h264 file.
  3. Light punchy-recut    -> fast-cut rhythm + SCENE-MATCHED SFX (skill.md), low zoom
                             punch (0.035) so it never crops the source's baked captions.
                             speed=1.0 preserves the already-good viral narration pacing.
  4. loudnorm final        -> safe true peak, no clipping.

The originals already carry their own narration + burned captions, so we do NOT
re-voice or re-caption — we make the cut + sound premium, which is exactly what
.claude/skills/punchy-recut/SKILL.md is for.

Usage:
    python make_from_source.py --ids -1ebmOgPN2w -4Okq698Ayw ...
    python make_from_source.py --first 5          # first 5 transcripts (sorted)
    python make_from_source.py --first 5 --offset 0
"""
from __future__ import annotations

import argparse
import io
import subprocess
import sys
import tempfile
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[1]
TRANSCRIPTS = PROJECT_ROOT / "transcripts"
HD_DIR = PROJECT_ROOT / "hd_sources"
OUT_BASE = PROJECT_ROOT / "output" / "transcript_shorts_hd"
RECUT = PROJECT_ROOT / ".claude" / "skills" / "punchy-recut" / "recut.py"
SFX = PROJECT_ROOT / "assets" / "sound_effects"
ESRGAN = PROJECT_ROOT / "tools" / "realesrgan_full" / "realesrgan-ncnn-vulkan"
SCRATCH = Path(tempfile.mkdtemp(prefix="shorts-factory-"))

S = "soundfx-rse/soundfx.d"  # shorthand for the verified ✅ monetization-safe pool


def sfx(*names: str) -> str:
    return ",".join(str(SFX / S / n) for n in names)


# Scene -> SFX profile (skill.md "match SFX to the scene, don't default to whooshes").
# Each: cut sound pool, emphasis impact, impact cadence. speed stays 1.0 (the originals
# are already well-paced viral shorts; we add cut-rhythm + sound, not chipmunking).
PROFILES = {
    "dread":   dict(cut=sfx("whoosh3.mp3", "whoosh4.mp3", "whoosh5.mp3"),
                    impact=str(SFX / "derived" / "cosmic_boom.wav"), every=4, igain=0.8),
    "heart":   dict(cut=sfx("slide2.mp3", "whoosh3.mp3", "slide3.mp3"),
                    impact=str(SFX / S / "chime2.mp3"), every=5, igain=0.7),
    "satisfy": dict(cut=sfx("whoosh4.mp3", "whoosh3.mp3", "click6.mp3"),
                    impact=str(SFX / S / "punch3.mp3"), every=4, igain=0.8),
    "default": dict(cut=sfx("whoosh3.mp3", "whoosh4.mp3", "whoosh5.mp3"),
                    impact=str(SFX / S / "cannon1.mp3"), every=4, igain=0.75),
}

_DREAD = ("died", "death", "dead", "kill", "strangl", "blood", "horror", "crime",
          "murder", "seizure", "destroy", "corpse", "mummif", "buried", "drown",
          "stab", "artery", "unconscious", "fatal", "poison", "fire", "burn")
_HEART = ("gave", "reunit", "dad", "father", "son", "mother", "family", "love",
          "hero", "surprise", "cried", "hugg", "saved", "donat", "kind", "gift",
          "together", "home", "rescue", "tears")
_SATISFY = ("how to", "trick", "hack", "make", "build", "potato", "straw", "paper",
            "knife", "science", "perfect", "diy", "experiment", "works", "turn")


def pick_profile(text: str) -> str:
    t = (text or "").lower()
    # dread wins over satisfy when both present (tone dominates); heart is a distinct lane
    d = sum(w in t for w in _DREAD)
    h = sum(w in t for w in _HEART)
    s = sum(w in t for w in _SATISFY)
    if d >= 2 and d >= h:
        return "dread"
    if h >= 2 and h > d:
        return "heart"
    if s >= 1 and d < 2:
        return "satisfy"
    if d >= 1:
        return "dread"
    return "default"


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe_wh(path: str) -> tuple[int, int]:
    r = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0", path])
    try:
        w, h = r.stdout.strip().split(",")[:2]
        return int(w), int(h)
    except Exception:
        return 0, 0


def ensure_hd_source(vid: str) -> Path | None:
    HD_DIR.mkdir(parents=True, exist_ok=True)
    out = HD_DIR / f"{vid}.mp4"
    if out.exists() and min(probe_wh(str(out))) >= 700:
        print(f"  HD source cached: {out.name}")
        return out
    print(f"  Downloading HD source for {vid} ...")
    r = run(["yt-dlp", "-f", "bv*+ba/b", "-S", "res:1080,vcodec:h264,ext:mp4",
             "--merge-output-format", "mp4", "--no-playlist",
             "-o", str(HD_DIR / f"{vid}.%(ext)s"),
             f"https://www.youtube.com/watch?v={vid}"])
    if out.exists():
        w, h = probe_wh(str(out))
        print(f"  downloaded {w}x{h}")
        return out
    print(f"  [FAIL] download: {(r.stderr or '')[-200:]}")
    return None


def esrgan_upscale(src: Path, work: Path) -> Path | None:
    """Low-res fallback: explode -> Real-ESRGAN x4 -> re-encode. Returns upscaled mp4."""
    fin, fup = work / "fin", work / "fup"
    fin.mkdir(parents=True, exist_ok=True)
    fup.mkdir(parents=True, exist_ok=True)
    print("  Real-ESRGAN upscale (low-res source)...")
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-qscale:v", "1",
         str(fin / "%08d.png")])
    r = run([str(ESRGAN), "-i", str(fin), "-o", str(fup),
             "-n", "realesr-animevideov3", "-s", "4", "-g", "0", "-f", "png"])
    if not any(fup.iterdir()):
        print(f"  [FAIL] esrgan: {(r.stderr or '')[-200:]}")
        return None
    # detect src fps
    fr = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
              "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(src)])
    fps = fr.stdout.strip() or "30"
    up = work / "upscaled.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", fps, "-i", str(fup / "%08d.png"),
         "-i", str(src), "-map", "0:v", "-map", "1:a?",
         "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
                "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
         "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-shortest", str(up)])
    return up if up.exists() else None


def normalize_1080(src: Path, out: Path) -> Path | None:
    w, h = probe_wh(str(src))
    if min(w, h) and min(w, h) < 700:
        up = esrgan_upscale(src, out.parent / "_work")
        if up:
            return up  # already normalized to 1080x1920 in esrgan_upscale
    r = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
             "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
                    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
             "-r", "30", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "160k", str(out)])
    return out if out.exists() else None


def recut(norm: Path, out: Path, prof: dict) -> Path | None:
    cmd = [sys.executable, str(RECUT), "--input", str(norm), "--out", str(out),
           "--interval", "1.5", "--speed", "1.0", "--punch", "0.035",
           "--cut-sfx", prof["cut"], "--whoosh-gain", "0.55",
           "--impact-file", prof["impact"], "--impact-every", str(prof["every"]),
           "--impact-gain", str(prof["igain"])]
    r = run(cmd)
    if out.exists():
        return out
    print(f"  [FAIL] recut: {(r.stdout or '')[-200:]} {(r.stderr or '')[-200:]}")
    return None


def loudnorm(src: Path, out: Path) -> Path | None:
    r = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
             "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "160k", str(out)])
    return out if out.exists() else (src if not r.returncode else None)


def make_one(vid: str) -> Path | None:
    job = OUT_BASE / vid
    job.mkdir(parents=True, exist_ok=True)
    tpath = TRANSCRIPTS / f"{vid}.txt"
    text = tpath.read_text(encoding="utf-8").strip() if tpath.exists() else ""
    prof_name = pick_profile(text)
    print(f"\n{'='*60}\n[{vid}]  profile={prof_name}")
    print(f"  text: {text[:80]!r}")

    src = ensure_hd_source(vid)
    if not src:
        return None
    print(f"  source: {probe_wh(str(src))}")

    norm = normalize_1080(src, job / "normalized.mp4")
    if not norm:
        print("  [FAIL] normalize")
        return None

    cut = recut(norm, job / "_cut.mp4", PROFILES[prof_name])
    if not cut:
        return None

    final = loudnorm(cut, job / "final.mp4")
    if not final:
        return None
    w, h = probe_wh(str(final))
    dur = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "csv=p=0", str(final)]).stdout.strip()
    print(f"  [OK] final {w}x{h} {float(dur):.1f}s -> {final}")
    return final


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--first", type=int, default=0)
    ap.add_argument("--offset", type=int, default=0)
    args = ap.parse_args()

    if args.ids:
        ids = args.ids
    else:
        n = args.first or 5
        txts = sorted(TRANSCRIPTS.glob("*.txt"))[args.offset: args.offset + n]
        ids = [t.stem for t in txts]

    OUT_BASE.mkdir(parents=True, exist_ok=True)
    print(f"Making {len(ids)} videos from ORIGINAL sources: {ids}")
    results = []
    for vid in ids:
        try:
            results.append((vid, make_one(vid)))
        except Exception as e:  # noqa: BLE001
            print(f"  [ERROR] {vid}: {e}")
            results.append((vid, None))

    print(f"\n{'='*60}\nSUMMARY")
    ok = sum(1 for _, p in results if p)
    for vid, p in results:
        print(f"  {'[OK  ]' if p else '[FAIL]'} {vid}" + (f"  -> {p}" if p else ""))
    print(f"\n{ok}/{len(results)} done.  Output: {OUT_BASE}")


if __name__ == "__main__":
    main()
