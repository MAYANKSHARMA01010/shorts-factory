"""Subject-cutout b-roll (backgroundremover technique; rembg / u2net).

Cut the subject out of a still (transparent background) and composite it over a fresh
background for a punchier, more dynamic b-roll shot than a flat photo. Uses `rembg`
(u2net), which downloads a ~176 MB model on first use. Graceful no-op when rembg isn't
installed — callers fall back to the plain image.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from .ffmpeg import run_ffmpeg


def cutout_available() -> bool:
    import importlib.util
    return importlib.util.find_spec("rembg") is not None


def remove_background(image_path: str, out_png: str) -> Optional[str]:
    """Remove the background → transparent PNG. None if rembg is absent or it fails."""
    if not cutout_available() or not Path(image_path).exists():
        return None
    try:
        from rembg import remove
        result = remove(Path(image_path).read_bytes())
        Path(out_png).parent.mkdir(parents=True, exist_ok=True)
        Path(out_png).write_bytes(result)
        return out_png
    except Exception:  # noqa: BLE001 — model/runtime failure → caller falls back
        return None


def composite_over(subject_png: str, background: str, out: str,
                   width: int = 1080, height: int = 1920, scale: float = 0.82) -> Optional[str]:
    """Composite a transparent subject (centered, `scale` of frame width) over a
    background, reframed to width×height. Returns the output image path or None."""
    if not (Path(subject_png).exists() and Path(background).exists()):
        return None
    fc = (f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height},setsar=1[bg];"
          f"[1:v]scale={int(width * scale)}:-1[subj];"
          f"[bg][subj]overlay=(W-w)/2:(H-h)/2")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    r = run_ffmpeg(["-i", str(Path(background).resolve()), "-i", str(Path(subject_png).resolve()),
                    "-filter_complex", fc, "-frames:v", "1", "-y", str(Path(out).resolve())])
    return out if (r.returncode == 0 and Path(out).exists()) else None


def cutout_broll(image_path: str, background: str, out: str,
                 width: int = 1080, height: int = 1920) -> Optional[str]:
    """Full pipeline: cut the subject out of `image_path` and composite it over
    `background`. Returns the composited image or None (rembg absent / failure)."""
    tmp = str(Path(out).with_suffix(".subject.png"))
    if remove_background(image_path, tmp) is None:
        return None
    return composite_over(tmp, background, out, width, height)
