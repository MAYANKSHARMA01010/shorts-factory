# -*- coding: utf-8 -*-
"""Normalize any engine output to the beat-clip contract: 1080x1920, exact seconds, silent."""
from __future__ import annotations

from pathlib import Path

from .base import run, probe_duration, probe_size, RenderError, FPS, SIZE


def normalize_to_spec(raw: Path, out: Path, seconds: float, size=SIZE, fps=FPS) -> Path:
    """Force `raw` to exactly `size` and `seconds` (loop-pad if short, trim if long), silent.

    Both engines already emit 1080x1920@30, but this is the single source of truth for the
    size+duration contract so concat math (which trusts end-start) never drifts.
    """
    w, h = size
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"fps={fps},format=yuv420p,"
        f"tpad=stop_mode=clone:stop_duration={seconds:.3f}"   # loop last frame if short
    )
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
         "-vf", vf, "-t", f"{seconds:.3f}", "-an", "-r", str(fps),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(out)])
    d = probe_duration(out)
    sz = probe_size(out)
    if abs(d - seconds) > (1.5 / fps) or sz != (w, h):
        raise RenderError(f"normalize produced {d:.3f}s {sz} (wanted {seconds:.3f}s {size}) for {out}")
    return out
