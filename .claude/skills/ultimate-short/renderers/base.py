# -*- coding: utf-8 -*-
"""Shared base for the ultimate-short beat renderers."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

FPS = 30
SIZE = (1080, 1920)


class RenderError(Exception):
    """Any engine failure. compose() catches this and falls back to the Z-Image still."""


def run(args, *, cwd=None, timeout=None):
    """Run a subprocess; turn any failure into RenderError (never a bare exception)."""
    try:
        subprocess.run([str(a) for a in args], cwd=cwd, check=True, timeout=timeout)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        raise RenderError(f"{args[0]} failed: {e}") from e


def probe_duration(path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True)
    try:
        return float(json.loads(r.stdout)["format"]["duration"])
    except Exception:
        return 0.0


def probe_size(path) -> tuple[int, int]:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "json", str(path)],
                       capture_output=True, text=True)
    try:
        s = json.loads(r.stdout)["streams"][0]
        return int(s["width"]), int(s["height"])
    except Exception:
        return (0, 0)
