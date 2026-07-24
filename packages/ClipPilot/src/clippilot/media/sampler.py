"""Scene-aware keyframe sampling (docs/07 §4).

One representative frame per shot, a forced floor for long static shots (so a
3-min talking head isn't a single frame), a hard cap on total frames, and
aggressive downscale — the disciplined sampling that keeps Claude-vision cost
bounded. CPU-only via ffmpeg.
"""
from __future__ import annotations

import os
from typing import Any

from . import signals


def shot_windows(scene_cuts: list[float], duration: float) -> list[tuple[float, float]]:
    """Turn scene-cut timestamps into [start, end) shot windows over [0, duration)."""
    bounds = [0.0] + sorted(t for t in scene_cuts if 0 < t < duration) + [duration]
    return [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1) if bounds[i + 1] > bounds[i]]


def sampling_times(scene_cuts: list[float], duration: float,
                   floor_s: float = 10.0, cap: int = 120) -> list[float]:
    """Timestamps to sample: shot midpoints + a frame every `floor_s` within long
    shots, deduped/sorted, then evenly subsampled to `cap`."""
    if duration <= 0:
        return []
    times: list[float] = []
    for a, b in shot_windows(scene_cuts, duration):
        times.append((a + b) / 2.0)
        length = b - a
        if length > floor_s:
            k = 1
            while a + k * floor_s < b:
                times.append(a + k * floor_s)
                k += 1
    uniq = sorted({round(t, 3) for t in times if 0.0 <= t < duration})
    if len(uniq) > cap:
        step = len(uniq) / cap
        uniq = [uniq[int(i * step)] for i in range(cap)]
    return uniq


def sample_keyframes(path: str, scene_cuts: list[float], duration: float, out_dir: str,
                     width: int = 768, cap: int = 120, floor_s: float = 10.0) -> list[dict[str, Any]]:
    """Extract one downscaled JPEG per sampling time. Returns [{idx, t, path}]."""
    os.makedirs(out_dir, exist_ok=True)
    out: list[dict[str, Any]] = []
    for i, t in enumerate(sampling_times(scene_cuts, duration, floor_s, cap)):
        p = os.path.join(out_dir, f"kf_{i:03d}_{int(t * 1000):08d}.jpg")
        got = signals.extract_keyframe(path, t, p, width=width)
        if got:
            out.append({"idx": i, "t": t, "path": got})
    return out
