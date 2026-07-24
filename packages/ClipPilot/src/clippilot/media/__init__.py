"""Media layer: real FFmpeg-backed extraction (Phase 1).

`ffmpeg.py` resolves a usable ffmpeg binary (bundled via imageio-ffmpeg, or on
PATH). `signals.py` implements the cheap, deterministic `extract_signals` stage
(probe metadata, scene cuts, silence, loudness, keyframes) — the foundation the
Video Understanding Engine (docs/07) builds on.
"""
