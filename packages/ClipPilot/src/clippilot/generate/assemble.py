"""Assemble a vertical short from a narration WAV + a background, via ffmpeg.

Background, best→fallback: a supplied still `image` (scaled+cropped) → an animated
`gradients` backdrop → a flat color. With a `title`, a centered top **title card**
is drawn (ffmpeg drawtext). Everything degrades gracefully — if the rich render
fails (e.g. an ffmpeg build without drawtext/freetype), it retries a plain
solid-color render so generation never hard-fails. Duration follows the audio
(`-shortest`). Output is 1080×1920 H.264/AAC. CPU-only.

drawtext on Windows is path-escaping-hostile, so (like media/edit.burn_subtitles)
we run with cwd set to a work dir holding a copied `font.ttf` + `title.txt` and
reference them by bare name — no colon/backslash escaping in the filtergraph.
"""
from __future__ import annotations

import functools
import shutil
import textwrap
from pathlib import Path
from typing import Optional

from ..media.ffmpeg import run_ffmpeg

_FONT_CANDIDATES = [
    # macOS — system fonts
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    # Linux
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    # Windows (kept for cross-platform users)
    r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf",
]
# Tasteful dark gradient endpoints (0xRRGGBB).
GRADIENT = ("0x16213e", "0x53354a")


def _ok(r, out: str) -> bool:
    return r.returncode == 0 and Path(out).exists() and Path(out).stat().st_size > 0


@functools.lru_cache(maxsize=1)
def _filters() -> set[str]:
    r = run_ffmpeg(["-hide_banner", "-filters"], timeout=30)
    out = (r.stdout or "") + (r.stderr or "")
    return {line.split()[1] for line in out.splitlines()
            if len(line.split()) >= 2 and line.split()[1].isidentifier()}


def _has(filter_name: str) -> bool:
    return filter_name in _filters()


def _font() -> Optional[str]:
    for f in _FONT_CANDIDATES:
        if Path(f).exists():
            return f
    return None


def _wrap_title(title: str, width: int = 22, max_lines: int = 3) -> str:
    lines = textwrap.wrap(title.strip(), width=width)[:max_lines]
    return "\n".join(lines)


def _drawtext_chain(workdir: Path, title: str, width: int) -> Optional[str]:
    """Prepare font.ttf + title.txt in `workdir`; return the drawtext filter
    (bare filenames, resolved against cwd) or None if unavailable."""
    if not (_has("drawtext") and title.strip()):
        return None
    font = _font()
    if not font:
        return None
    try:
        shutil.copyfile(font, workdir / "font.ttf")
        (workdir / "title.txt").write_text(_wrap_title(title), encoding="utf-8")
    except OSError:
        return None
    fontsize = max(40, width // 16)
    return (f"drawtext=fontfile=font.ttf:textfile=title.txt:fontcolor=white:"
            f"fontsize={fontsize}:line_spacing=14:box=1:boxcolor=black@0.45:"
            f"boxborderw=24:x=(w-text_w)/2:y=140")


def _concat_video(clips: list[str], out: str) -> bool:
    """Concat same-codec video-only clips via the concat demuxer (stream copy)."""
    workdir = Path(out).parent
    listf = workdir / "slides_concat.txt"
    listf.write_text("".join(f"file '{Path(c).name}'\n" for c in clips), encoding="utf-8")
    r = run_ffmpeg(["-f", "concat", "-safe", "0", "-i", listf.name,
                    "-c", "copy", "-y", str(Path(out).resolve())], cwd=str(workdir))
    return _ok(r, out)


def _kenburns_vf(width: int, height: int, frames: int, fps: int, index: int = 0) -> str:
    """Subpixel frame evaluation filter — 100% rock-solid and stable with ZERO shaking/jitter."""
    if index % 2 == 0:
        scale_expr = f"scale=w='{width}*(1+0.0005*n)':h='{height}*(1+0.0005*n)':eval=frame"
    else:
        scale_expr = f"scale=w='{width}*(1.12-0.0005*n)':h='{height}*(1.12-0.0005*n)':eval=frame"

    return (f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
            f"{scale_expr},crop={width}:{height},setsar=1,format=yuv420p")


def _render_slides(segments: list[tuple[str, float]], audio_path: str, out: str,
                   width: int, height: int, fps: int) -> Optional[str]:
    """Render [(image, seconds)] as a smooth, stable Ken-Burns sequence + narration audio."""
    segs = [(p, d) for (p, d) in segments if Path(p).exists() and d > 0]
    if not segs or not Path(audio_path).exists():
        return None
    workdir = Path(out).parent
    workdir.mkdir(parents=True, exist_ok=True)

    clips: list[str] = []
    for i, (img, dur) in enumerate(segs):
        clip = str(workdir / f"slide_{i:02d}.mp4")
        vf = _kenburns_vf(width, height, max(1, int(dur * fps)), fps, index=i)
        if _ok(run_ffmpeg(["-loop", "1", "-i", str(Path(img)), "-t", f"{dur:.3f}", "-vf", vf,
                           "-r", str(fps), "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                           "-y", clip]), clip):
            clips.append(clip)
    if not clips:
        return None

    silent = clips[0] if len(clips) == 1 else str(workdir / "slides_silent.mp4")
    if len(clips) > 1 and not _concat_video(clips, silent):
        return None
    if _ok(run_ffmpeg(["-i", silent, "-i", str(Path(audio_path)), "-map", "0:v", "-map", "1:a",
                       "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "+faststart",
                       "-y", str(Path(out))]), out):
        return out
    return out if _ok(run_ffmpeg(["-i", silent, "-i", str(Path(audio_path)), "-map", "0:v",
                                  "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                                  "-c:a", "aac", "-shortest", "-y", str(Path(out))]), out) else None


def assemble_timed_slideshow(segments: list[tuple[str, float]], audio_path: str, out: str,
                             width: int = 2160, height: int = 3840, fps: int = 30) -> Optional[str]:
    """Ken-Burns slideshow where each image shows for an explicit duration — used
    for per-caption-timed b-roll (a fresh image per spoken phrase)."""
    return _render_slides(segments, audio_path, out, width, height, fps)


def assemble_slideshow(images: list[str], audio_path: str, out: str, width: int = 2160,
                       height: int = 3840, fps: int = 30) -> Optional[str]:
    """Even-split Ken-Burns slideshow of `images`, timed to the narration."""
    from ..media import signals
    imgs = [i for i in images if Path(i).exists()]
    if not imgs or not Path(audio_path).exists():
        return None
    dur = signals.probe(audio_path).duration_s or (len(imgs) * 3.0)
    per = max(2.0, dur / len(imgs))
    return _render_slides([(i, per) for i in imgs], audio_path, out, width, height, fps)


def assemble_broll_video(video_path: str, audio_path: str, out: str, width: int = 2160,
                         height: int = 3840, fps: int = 30) -> Optional[str]:
    """Crop a stock clip to 9:16, loop it to cover the narration, set the narration
    as the audio. Returns the mp4 path, or None."""
    from ..media import signals
    if not (Path(video_path).exists() and Path(audio_path).exists()):
        return None
    dur = signals.probe(audio_path).duration_s or 0.0
    if dur <= 0:
        return None
    vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height},setsar=1,fps={fps}")
    args = ["-stream_loop", "-1", "-i", str(Path(video_path)), "-i", str(Path(audio_path)),
            "-vf", vf, "-map", "0:v", "-map", "1:a", "-t", f"{dur:.3f}",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
            "-movflags", "+faststart", "-y", str(Path(out))]
    return out if _ok(run_ffmpeg(args), out) else None


def assemble_motion_montage(clips: list[str], audio_path: str, out: str, width: int = 2160,
                            height: int = 3840, fps: int = 30) -> Optional[str]:
    """Real-footage montage: reframe each motion clip to 9:16, give each an even slice
    of the narration, concat them, loop/trim to the narration length, set the narration
    as audio. The anti-slop alternative to Ken-Burns stills. Returns the mp4 or None."""
    from ..media import signals
    clips = [c for c in clips if Path(c).exists()]
    if not clips or not Path(audio_path).exists():
        return None
    dur = signals.probe(audio_path).duration_s or (len(clips) * 3.0)
    if dur <= 0:
        return None
    per = max(2.0, dur / len(clips)) + 0.3       # slight overshoot so concat covers audio
    workdir = Path(out).resolve().parent
    workdir.mkdir(parents=True, exist_ok=True)
    vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height},setsar=1,fps={fps}")
    norm: list[str] = []
    for i, c in enumerate(clips):
        n = str(workdir / f"mnorm_{i:02d}.mp4")
        r = run_ffmpeg(["-t", f"{per:.2f}", "-i", str(Path(c).resolve()), "-vf", vf, "-an",
                        "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(fps), "-y", n])
        if _ok(r, n):
            norm.append(n)
    if not norm:
        return None
    silent = str(workdir / "mmontage_silent.mp4")
    if len(norm) == 1:
        shutil.copyfile(norm[0], silent)
    elif not _concat_video(norm, silent):
        return None
    args = ["-stream_loop", "-1", "-i", silent, "-i", str(Path(audio_path).resolve()),
            "-map", "0:v", "-map", "1:a", "-t", f"{dur:.3f}", "-c:v", "copy", "-c:a", "aac",
            "-shortest", "-movflags", "+faststart", "-y", str(Path(out).resolve())]
    return out if _ok(run_ffmpeg(args), out) else None


def _solid_args(audio_path: str, out: str, width: int, height: int,
                bg_color: str, fps: int) -> list[str]:
    return ["-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r={fps}",
            "-i", str(Path(audio_path)),
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-shortest", "-movflags", "+faststart", "-y", str(Path(out))]


def assemble_short(audio_path: str, out: str, width: int = 2160, height: int = 3840,
                   bg_color: str = "black", image: Optional[str] = None,
                   fps: int = 30, title: Optional[str] = None,
                   style: str = "gradient") -> Optional[str]:
    """Render `audio_path` over a background (+ optional title card) into a
    vertical mp4. Returns the path, or None if even the solid fallback fails."""
    if not Path(audio_path).exists():
        return None
    out_p = Path(out)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    # The rich render runs with cwd=out_p.parent (so drawtext can use bare font/
    # title filenames), so the output, audio and image MUST be absolute or ffmpeg
    # would write to the wrong place and we'd discard a good render (see burn_subtitles).
    out_abs = str(out_p.resolve())
    audio_abs = str(Path(audio_path).resolve())

    # ── attempt the rich render (image|gradient background + optional title) ──
    vf_parts: list[str] = []
    if image and Path(image).exists():
        bg_in = ["-loop", "1", "-i", str(Path(image).resolve())]
        vf_parts.append(f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                        f"crop={width}:{height},setsar=1")
        extra = ["-tune", "stillimage"]
    elif style == "gradient" and _has("gradients"):
        bg_in = ["-f", "lavfi", "-i",
                 f"gradients=s={width}x{height}:c0={GRADIENT[0]}:c1={GRADIENT[1]}:speed=0.012"]
        extra = []
    else:
        bg_in = None  # → solid fallback only
        extra = []

    if bg_in is not None:
        title_filter = _drawtext_chain(out_p.parent, title or "", width) if title else None
        if title_filter:
            vf_parts.append(title_filter)
        args = bg_in + ["-i", audio_abs]
        if vf_parts:
            args += ["-vf", ",".join(vf_parts)]
        args += extra + ["-r", str(fps), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                         "-c:a", "aac", "-shortest", "-movflags", "+faststart",
                         "-y", out_abs]
        if _ok(run_ffmpeg(args, cwd=str(out_p.parent)), out):
            return out

    # ── graceful fallback: plain solid color ──
    return out if _ok(run_ffmpeg(_solid_args(audio_path, out, width, height, bg_color, fps)), out) else None
