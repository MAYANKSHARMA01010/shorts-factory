"""Speed ramps / time remapping — Premiere's variable-speed feature.

Variable within-clip speed is brittle to express as a single render-time `setpts`, so we
bake it as a pre-process: split the source into constant-speed segments (trim + setpts) and
`concat` them into a new video file (audio dropped — ramps are typically on b-roll). The
clip then points at the ramped file. This is the same "pre-process → swap media" pattern as
the stabilizer.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from .ffmpeg import run_ffmpeg


def ramp_output_frames(segments: list[dict[str, Any]], fps: int) -> int:
    """Output frame count after ramping: each segment of N source frames at speed s yields
    N/s output frames."""
    total = 0
    for seg in segments:
        n = int(seg.get("end_frame", 0)) - int(seg.get("start_frame", 0))
        sp = max(0.05, float(seg.get("speed", 1.0)))
        if n > 0:
            total += max(1, round(n / sp))
    return total


def _ramp_filter(segments: list[dict[str, Any]], fps: int) -> Optional[str]:
    """Build the trim+setpts+concat filtergraph for source-frame segments, or None."""
    nodes, labels = [], []
    i = 0
    for seg in segments:
        s0, s1 = int(seg.get("start_frame", 0)), int(seg.get("end_frame", 0))
        if s1 <= s0:
            continue
        sp = max(0.05, min(20.0, float(seg.get("speed", 1.0))))
        s, e = s0 / fps, s1 / fps
        nodes.append(f"[0:v]trim={s:.4f}:{e:.4f},setpts=(PTS-STARTPTS)/{sp:.4f}[rv{i}]")
        labels.append(f"[rv{i}]")
        i += 1
    if not labels:
        return None
    nodes.append("".join(labels) + f"concat=n={len(labels)}:v=1:a=0,fps={fps}[vout]")
    return ";".join(nodes)


def speed_ramp(input_path: str, output_path: str, segments: list[dict[str, Any]],
               fps: int) -> Optional[str]:
    """Render a speed-ramped copy of `input_path`. `segments` = [{start_frame, end_frame,
    speed}] in SOURCE frames (speed>1 = faster, <1 = slow-mo). Returns the path or None."""
    src = Path(input_path)
    if not src.exists() or not segments:
        return None
    fg = _ramp_filter(segments, fps)
    if not fg:
        return None
    out = Path(output_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    args = ["-i", str(src.resolve()), "-filter_complex", fg, "-map", "[vout]", "-an",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(fps),
            "-movflags", "+faststart", "-y", out.name]
    r = run_ffmpeg(args, cwd=str(out.parent))
    if r.returncode != 0 or not out.exists():
        return None
    return str(out)
