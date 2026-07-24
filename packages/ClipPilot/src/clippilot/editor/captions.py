"""Captions-into-timeline — palmier `addCaptions` parity. Transcribe a clip's media
(faster-whisper) and drop the transcript onto the timeline as timed TEXT clips, so the
captions become real, editable timeline objects (move/restyle/retime like any clip).
Graceful no-op (returns 0) when whisper is unavailable or there's no speech.
"""
from __future__ import annotations

from pathlib import Path

from .timeline import Timeline, add_text


def captions_to_timeline(tl: Timeline, media_path: str, track_index: int = 2,
                         start_frame: int = 0) -> int:
    """Add the media's spoken transcript as timed text clips on `track_index`, offset by
    `start_frame`. Returns the number of caption clips added (0 if it can't run)."""
    from ..media.captions import cues_for_clip
    from ..media.signals import probe
    from ..media.transcribe import transcribe, whisper_available
    if not whisper_available() or not Path(media_path).exists():
        return 0
    dur = probe(media_path).duration_s or 0.0
    if dur <= 0:
        return 0
    words = (transcribe(media_path).get("words") or [])
    if not words:
        return 0
    n = 0
    for cue in cues_for_clip(words, 0.0, dur):
        text = (cue.get("text") or "").strip()
        if not text:
            continue
        sf = start_frame + int(round(cue["start"] * tl.fps))
        df = max(1, int(round((cue["end"] - cue["start"]) * tl.fps)))
        add_text(tl, track_index, sf, df, text)
        n += 1
    return n
