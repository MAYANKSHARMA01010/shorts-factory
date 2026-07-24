"""Video stabilization — Premiere "Warp Stabilizer", via ffmpeg's vidstab two-pass.

Pass 1 (`vidstabdetect`) analyses camera motion into a transforms file; pass 2
(`vidstabtransform`) smooths it and warps each frame. Produces a new media file (it
can't be a single render-time filter), so it's a pre-process you point a clip at.
"""
from __future__ import annotations

import functools
import subprocess
from pathlib import Path
from typing import Optional

from .ffmpeg import get_ffmpeg, run_ffmpeg


@functools.lru_cache(maxsize=1)
def vidstab_available() -> bool:
    """True if the ffmpeg build includes libvidstab (vidstabdetect/transform)."""
    exe = get_ffmpeg()
    if not exe:
        return False
    try:
        r = subprocess.run([exe, "-hide_banner", "-filters"], capture_output=True,
                           text=True, timeout=30)
        return "vidstabtransform" in r.stdout
    except (OSError, subprocess.SubprocessError):
        return False


def _detect_vf(trf_name: str, shakiness: int) -> str:
    return f"vidstabdetect=shakiness={shakiness}:accuracy=15:result={trf_name}"


def _transform_vf(trf_name: str, smoothing: int, zoom: float, sharpen: bool) -> str:
    vf = (f"vidstabtransform=input={trf_name}:smoothing={smoothing}:zoom={zoom}:"
          f"optzoom=1:interpol=linear:crop=black")
    if sharpen:
        vf += ",unsharp=5:5:0.8:3:3:0.4"
    return vf


def stabilize_video(input_path: str, output_path: str, smoothing: int = 10,
                    shakiness: int = 5, zoom: float = 0.0, sharpen: bool = True) -> Optional[str]:
    """Stabilize `input_path` → `output_path` (two-pass vidstab). `smoothing` = how many
    frames to average the motion over (higher = steadier but more cropping); `shakiness`
    1–10. Returns the output path or None."""
    src = Path(input_path)
    if not src.exists():
        return None
    out = Path(output_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    smoothing = max(1, min(100, int(smoothing)))
    shakiness = max(1, min(10, int(shakiness)))
    trf = out.with_suffix(".trf")
    src_abs = str(src.resolve())
    # pass 1 — detect motion into the .trf (referenced by bare name; cwd = out dir)
    r1 = run_ffmpeg(["-i", src_abs, "-vf", _detect_vf(trf.name, shakiness), "-f", "null", "-"],
                    cwd=str(out.parent))
    if r1.returncode != 0 or not trf.exists():
        return None
    # pass 2 — warp each frame with the smoothed motion
    vf = _transform_vf(trf.name, smoothing, zoom, sharpen)
    r2 = run_ffmpeg(["-i", src_abs, "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                     "-movflags", "+faststart", "-y", out.name], cwd=str(out.parent))
    try:
        trf.unlink()
    except OSError:
        pass
    if r2.returncode != 0 or not out.exists():
        return None
    return str(out)
