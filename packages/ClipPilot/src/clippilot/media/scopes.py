"""Lumetri Scopes — waveform / vectorscope / histogram / RGB-parade of a video frame.

Beyond Premiere parity these have real automation value: Claude can render a scope image
of a clip/render and visually inspect the luma + color distribution to decide a grade
(e.g. spot crushed blacks, a colour cast, clipping).
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from .ffmpeg import run_ffmpeg

# scope_type → the ffmpeg -vf that turns a frame into that scope visualization.
SCOPES = {
    "waveform": "format=yuv444p,waveform=mode=column:intensity=0.15:components=7,scale=512:512",
    "rgbparade": "format=gbrp,waveform=mode=column:intensity=0.15:components=7:display=parade,"
                 "scale=600:300",
    "vectorscope": "format=yuv444p,vectorscope=mode=color3:graticule=green:flags=name,scale=512:512",
    "histogram": "histogram=display_mode=stack:components=7,scale=512:512",
    "levels": "histogram=display_mode=parade:components=7,scale=600:300",
}


def scope_vf(scope_type: str) -> str:
    return SCOPES.get(scope_type, SCOPES["waveform"])


def generate_scope(input_path: str, output_path: str, scope_type: str = "waveform",
                   at_time: float = 0.0) -> Optional[str]:
    """Render a `scope_type` scope of the frame at `at_time` (seconds) of `input_path`
    to `output_path` (PNG). Returns the path or None."""
    src = Path(input_path)
    if not src.exists():
        return None
    out = Path(output_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    args = ["-ss", f"{max(0.0, float(at_time)):.3f}", "-i", str(src.resolve()),
            "-frames:v", "1", "-vf", scope_vf(scope_type), "-y", str(out)]
    r = run_ffmpeg(args)
    if r.returncode != 0 or not out.exists():
        return None
    return str(out)
