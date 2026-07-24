"""Resolve and run ffmpeg/ffprobe.

ffmpeg comes from imageio-ffmpeg (a bundled static gyan.dev build) or PATH.
imageio-ffmpeg does NOT ship ffprobe, so ffprobe is optional (PATH only); when
absent we parse `ffmpeg -i` stderr instead (see signals.probe).
"""
from __future__ import annotations

import functools
import shutil
import subprocess
from typing import Optional


@functools.lru_cache(maxsize=1)
def get_ffmpeg() -> Optional[str]:
    """Path to an ffmpeg binary, or None."""
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe:
            return exe
    except Exception:  # noqa: BLE001 — fall back to PATH
        pass
    return shutil.which("ffmpeg")


@functools.lru_cache(maxsize=1)
def get_ffprobe() -> Optional[str]:
    """Path to ffprobe if available on PATH (imageio-ffmpeg doesn't bundle it)."""
    return shutil.which("ffprobe")


def ffmpeg_available() -> bool:
    return get_ffmpeg() is not None


def run_ffmpeg(args: list[str], timeout: int = 300, cwd: Optional[str] = None) -> subprocess.CompletedProcess:
    """Run ffmpeg with the given args (ffmpeg path is prepended).

    ffmpeg writes diagnostics to stderr; callers parse `.stderr`. We never raise
    on a nonzero exit (ffmpeg returns nonzero for `-i` with no output), so callers
    decide what counts as failure. `cwd` lets filters reference bare filenames
    (e.g. the subtitles filter) without Windows path-escaping.
    """
    exe = get_ffmpeg()
    if not exe:
        raise RuntimeError("ffmpeg not available (install imageio-ffmpeg or add ffmpeg to PATH)")
    cmd = [exe, "-hide_banner", "-nostdin", *args]
    return subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=timeout, cwd=cwd,
    )


def run_ffprobe(args: list[str], timeout: int = 60) -> Optional[subprocess.CompletedProcess]:
    exe = get_ffprobe()
    if not exe:
        return None
    cmd = [exe, *args]
    return subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout
    )
