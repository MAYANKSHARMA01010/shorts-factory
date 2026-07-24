"""Real speech-to-text via faster-whisper (CPU int8). The model downloads from
HuggingFace on first use and is cached on disk; the loaded model is cached in
process. Output segments double as caption cues (edit.write_srt) and feed the
brain's transcript context + per-scene excerpts.
"""
from __future__ import annotations

import functools
from pathlib import Path
from typing import Any, Optional


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


@functools.lru_cache(maxsize=2)
def _model(model_size: str, compute_type: str):
    from faster_whisper import WhisperModel
    return WhisperModel(model_size, device="cpu", compute_type=compute_type)


def transcribe(path: str, model_size: str = "base", compute_type: str = "int8",
               language: Optional[str] = None, vad_filter: bool = True,
               word_timestamps: bool = True) -> dict[str, Any]:
    """Transcribe audio/video → {segments:[{start,end,text,words}], words, text, language}.

    With `word_timestamps` (default on) each segment carries word-level
    `{text,start,end}` timings and a flat top-level `words` list — what the
    karaoke-caption stage groups into TikTok pages. Returns {"available": False,
    ...} for a missing file / missing whisper rather than raising, so the pipeline
    degrades gracefully.
    """
    if not Path(path).exists():
        return {"available": False, "reason": f"source not found: {path}"}
    if not whisper_available():
        return {"available": False, "reason": "faster-whisper not installed"}

    model = _model(model_size, compute_type)
    seg_iter, info = model.transcribe(path, language=language, vad_filter=vad_filter,
                                      word_timestamps=word_timestamps)
    segments: list[dict[str, Any]] = []
    words: list[dict[str, Any]] = []
    for s in seg_iter:
        seg_words = [{"text": w.word, "start": float(w.start), "end": float(w.end)}
                     for w in (getattr(s, "words", None) or [])]
        words.extend(seg_words)
        segments.append({"start": float(s.start), "end": float(s.end),
                         "text": s.text.strip(), "words": seg_words})
    return {
        "available": True,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
        "segments": segments,
        "words": words,
        "text": " ".join(s["text"] for s in segments).strip(),
    }


def segments_to_cues(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pass-through shape for edit.write_srt (already {start,end,text})."""
    return [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in segments if s.get("text")]


def excerpt_for_window(segments: list[dict[str, Any]], start: float, end: float) -> str:
    """Join transcript text overlapping [start, end] — for per-scene excerpts."""
    parts = [s["text"] for s in segments
             if s.get("text") and s["end"] > start and s["start"] < end]
    return " ".join(parts).strip()
