"""Cheap, deterministic video signals via ffmpeg — the `extract_signals` stage.

All CPU, no GPU, no ML. These feed the Video Understanding Engine (docs/07):
scene cuts → structure/pacing, loudness curve → energy, silence → dead air,
keyframes → the images Claude's vision reads. Metadata uses ffprobe JSON when
available, else parses `ffmpeg -i` stderr.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from ..understanding import SourceMeta
from .ffmpeg import ffmpeg_available, run_ffmpeg, run_ffprobe

_DUR = re.compile(r"Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)")
_VIDEO = re.compile(r"Video:\s+(\w+).*?,\s+(\d{2,5})x(\d{2,5})")
_FPS = re.compile(r"(\d+(?:\.\d+)?)\s+fps")
_AUDIO = re.compile(r"Stream #\d+:\d+.*?:\s+Audio:")
_PTS = re.compile(r"pts_time:(\d+(?:\.\d+)?)")
_SIL_START = re.compile(r"silence_start:\s*(-?\d+(?:\.\d+)?)")
_SIL_END = re.compile(r"silence_end:\s*(-?\d+(?:\.\d+)?)")
_LUFS_I = re.compile(r"\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS")


def _hms_to_s(h: str, m: str, s: str) -> float:
    return int(h) * 3600 + int(m) * 60 + float(s)


def probe(path: str) -> SourceMeta:
    """Source metadata. Prefer ffprobe JSON; fall back to ffmpeg stderr parsing."""
    p = run_ffprobe([
        "-v", "error", "-of", "json",
        "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
        path,
    ])
    if p and p.returncode == 0 and p.stdout.strip():
        try:
            data = json.loads(p.stdout)
            meta = SourceMeta()
            meta.duration_s = float(data.get("format", {}).get("duration", 0) or 0)
            for st in data.get("streams", []):
                if st.get("codec_type") == "video" and not meta.resolution:
                    w, h = st.get("width"), st.get("height")
                    meta.resolution = f"{w}x{h}" if w and h else ""
                    meta.codec = st.get("codec_name", "")
                    fr = st.get("avg_frame_rate", "0/1")
                    try:
                        num, den = fr.split("/")
                        meta.fps = round(int(num) / int(den), 3) if int(den) else 0.0
                    except (ValueError, ZeroDivisionError):
                        meta.fps = 0.0
                if st.get("codec_type") == "audio":
                    meta.has_audio = True
            return meta
        except (json.JSONDecodeError, ValueError, KeyError):
            pass

    # Fallback: parse `ffmpeg -i` stderr.
    r = run_ffmpeg(["-i", path], timeout=60)
    err = r.stderr or ""
    meta = SourceMeta()
    if (m := _DUR.search(err)):
        meta.duration_s = _hms_to_s(*m.groups())
    if (m := _VIDEO.search(err)):
        meta.codec = m.group(1)
        meta.resolution = f"{m.group(2)}x{m.group(3)}"
    if (m := _FPS.search(err)):
        meta.fps = float(m.group(1))
    meta.has_audio = bool(_AUDIO.search(err))
    return meta


def detect_scenes(path: str, threshold: float = 0.4) -> list[float]:
    """Shot-change timestamps (seconds) via the scene filter + showinfo."""
    r = run_ffmpeg([
        "-i", path,
        "-filter:v", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ])
    return [float(t) for t in _PTS.findall(r.stderr or "")]


def detect_silence(path: str, noise_db: int = -30, min_dur: float = 0.5) -> list[dict[str, float]]:
    """Silence segments via silencedetect. Returns [{start, end}]."""
    r = run_ffmpeg([
        "-i", path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}",
        "-vn", "-f", "null", "-",
    ])
    err = r.stderr or ""
    starts = [float(x) for x in _SIL_START.findall(err)]
    ends = [float(x) for x in _SIL_END.findall(err)]
    out: list[dict[str, float]] = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else None
        out.append({"start": s, "end": e if e is not None else -1.0})
    return out


def measure_loudness(path: str) -> Optional[float]:
    """Integrated loudness (LUFS) via ebur128; None if no audio / unmeasurable."""
    r = run_ffmpeg(["-i", path, "-af", "ebur128", "-vn", "-f", "null", "-"])
    matches = _LUFS_I.findall(r.stderr or "")
    if not matches:
        return None
    try:
        return float(matches[-1])  # the Summary value is last
    except ValueError:
        return None


def extract_keyframe(path: str, t: float, out_path: str, width: int = 768) -> Optional[str]:
    """Write a single downscaled JPEG keyframe at time `t`. Returns path or None."""
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    r = run_ffmpeg([
        "-ss", f"{t:.3f}", "-i", path,
        "-frames:v", "1",
        "-vf", f"scale={width}:-2:flags=lanczos",
        "-q:v", "3", "-y", out_path,
    ])
    return out_path if (r.returncode == 0 and Path(out_path).exists()) else None


def extract_signals(path: str) -> dict[str, Any]:
    """Aggregate the cheap signals into one dict (the `extract_signals` stage output)."""
    if not ffmpeg_available():
        return {"available": False, "reason": "ffmpeg not available"}
    if not Path(path).exists():
        return {"available": False, "reason": f"source not found: {path}"}

    meta = probe(path)
    scenes = detect_scenes(path)
    silences = detect_silence(path) if meta.has_audio else []
    loudness = measure_loudness(path) if meta.has_audio else None
    shots_per_min = round(len(scenes) / (meta.duration_s / 60.0), 2) if meta.duration_s else 0.0

    return {
        "available": True,
        "source": meta.to_dict() if hasattr(meta, "to_dict") else vars(meta),
        "scene_cuts": scenes,
        "shot_count": len(scenes),
        "shots_per_min": shots_per_min,
        "silences": silences,
        "integrated_lufs": loudness,
    }
