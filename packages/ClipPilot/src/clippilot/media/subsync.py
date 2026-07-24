"""Subtitle ↔ audio resync — re-authored from ffsubsync's MIT FFT-aligner.

Technique: build a "speech present" signal from the audio and a "subtitle present"
signal from the SRT (both as per-frame 0/1 arrays), then FFT cross-correlate them to
find the time offset that best lines the subtitles up with the speech, and shift the
cues by it. We derive the speech signal from ffmpeg's `silencedetect` (CPU, already
in media/signals) rather than ffsubsync's GPL `auditok` VAD. Pure-numpy aligner.
"""
from __future__ import annotations

from typing import Any, Optional


def speech_mask_from_silences(silences: list[dict[str, float]], duration: float,
                              fps: int = 50):
    """Per-frame speech-presence array: 1 where NOT silent, 0 inside a silence."""
    import numpy as np
    n = max(1, int(round(duration * fps)) + 1)
    mask = np.ones(n, dtype=float)
    for s in silences or []:
        a = int(round(float(s.get("start", 0.0)) * fps))
        end = s.get("end", -1.0)
        b = int(round((duration if (end is None or float(end) < 0) else float(end)) * fps))
        mask[max(0, a):max(0, min(n, b))] = 0.0
    return mask


def sub_mask_from_cues(cues: list[dict[str, Any]], duration: float, fps: int = 50):
    """Per-frame subtitle-presence array: 1 while a cue is on screen, else 0."""
    import numpy as np
    n = max(1, int(round(duration * fps)) + 1)
    mask = np.zeros(n, dtype=float)
    for c in cues or []:
        a = int(round(float(c["start"]) * fps))
        b = int(round(float(c["end"]) * fps))
        mask[max(0, min(n, a)):max(0, min(n, b))] = 1.0
    return mask


def find_offset_frames(speech, subs) -> int:
    """FFT cross-correlation → the frame lag at which `subs` best matches `speech`.
    Positive = subtitles should be delayed (moved later); negative = advanced."""
    import numpy as np
    a = np.asarray(speech, dtype=float)
    b = np.asarray(subs, dtype=float)
    if a.size == 0 or b.size == 0 or a.sum() == 0 or b.sum() == 0:
        return 0
    a = a - a.mean()
    b = b - b.mean()
    size = 1 << int(np.ceil(np.log2(a.size + b.size)))
    corr = np.fft.irfft(np.fft.rfft(a, size) * np.conj(np.fft.rfft(b, size)), size)
    best = int(np.argmax(corr))
    return best - size if best >= size // 2 else best  # unwrap circular lag to ±


def resync_cues(cues: list[dict[str, Any]], offset_s: float) -> list[dict[str, Any]]:
    """Shift every cue by `offset_s` (clamped at 0)."""
    out: list[dict[str, Any]] = []
    for c in cues:
        out.append({"start": max(0.0, float(c["start"]) + offset_s),
                    "end": max(0.05, float(c["end"]) + offset_s),
                    "text": c.get("text", "")})
    return out


def sync_subtitles(srt_path: str, audio_path: str, out_path: Optional[str] = None,
                   fps: int = 50, max_offset_s: float = 30.0) -> Optional[dict[str, Any]]:
    """Auto-align an SRT to a media file's audio. Writes the shifted SRT (in place
    unless `out_path`). Returns {offset_s, path, cues} or None if it can't run."""
    from pathlib import Path

    from .edit import parse_srt, write_srt
    from .ffmpeg import ffmpeg_available
    from .signals import detect_silence, probe
    if not (ffmpeg_available() and Path(srt_path).exists() and Path(audio_path).exists()):
        return None
    duration = probe(audio_path).duration_s
    cues = parse_srt(srt_path)
    if duration <= 0 or not cues:
        return None
    speech = speech_mask_from_silences(detect_silence(audio_path), duration, fps)
    subs = sub_mask_from_cues(cues, duration, fps)
    lag = find_offset_frames(speech, subs)
    offset_s = max(-max_offset_s, min(max_offset_s, lag / fps))
    out_path = out_path or srt_path
    write_srt(resync_cues(cues, offset_s), out_path)
    return {"offset_s": round(offset_s, 3), "path": out_path, "cues": len(cues)}
