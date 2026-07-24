"""Explainer / diagram clips — manim's role, but ffmpeg-native so it ALWAYS works.

manim (the programmatic-animation engine) needs MSVC build tools (+ LaTeX for math)
and won't install everywhere, so the explainer-clip ROLE is fulfilled with a
dependency-free ffmpeg card: a titled, bulleted, animated diagram card usable as an
educational insert in Section B. `manim_available()` is exposed so a richer manim path
can be used when it's present.
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from ..media.ffmpeg import run_ffmpeg
from .assemble import GRADIENT, _font, _has, _ok, _wrap_title


def manim_available() -> bool:
    import importlib.util
    return importlib.util.find_spec("manim") is not None


def explainer_clip(title: str, bullets: Optional[list[str]] = None, out: str = "explainer.mp4",
                   width: int = 1080, height: int = 1920, duration: float = 5.0) -> Optional[str]:
    """Render an animated explainer card (title + up to 5 bullets) over a gradient as
    a `duration`-second vertical clip. Dependency-free; returns the path or None."""
    if not _has("drawtext"):
        return None
    font = _font()
    if not font:
        return None
    out_p = Path(out).resolve()
    workdir = out_p.parent
    workdir.mkdir(parents=True, exist_ok=True)
    try:
        shutil.copyfile(font, workdir / "font.ttf")
        lines = [_wrap_title(title, width=20, max_lines=3), ""]
        for b in (bullets or [])[:5]:
            lines.append("- " + b.strip())
        (workdir / "card.txt").write_text("\n".join(lines), encoding="utf-8")
    except OSError:
        return None

    fs = max(46, width // 15)
    bar_y = int(height * 0.30)
    vf = (f"drawbox=x={int(width * 0.12)}:y={bar_y}:w={int(width * 0.76)}:h=8:"
          f"color={GRADIENT[1]}@1:t=fill,"
          f"drawtext=fontfile=font.ttf:textfile=card.txt:fontcolor=white:fontsize={fs}:"
          f"line_spacing=20:x=(w-text_w)/2:y={bar_y + 60}:"
          f"alpha='if(lt(t,0.4),t/0.4,1)'")

    if _has("gradients"):
        bg = ["-f", "lavfi", "-i",
              f"gradients=s={width}x{height}:c0={GRADIENT[0]}:c1={GRADIENT[1]}:speed=0.012"]
    else:
        bg = ["-f", "lavfi", "-i", f"color=c={GRADIENT[0]}:s={width}x{height}"]
    args = bg + ["-vf", vf, "-t", f"{duration:.2f}", "-r", "30",
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                 "-y", "explainer_out.mp4"]
    if not _ok(run_ffmpeg(args, cwd=str(workdir)), str(workdir / "explainer_out.mp4")):
        return None
    shutil.move(str(workdir / "explainer_out.mp4"), str(out_p))
    return out
