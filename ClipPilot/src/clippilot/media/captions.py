"""TikTok-style caption grouping — faithful port of remotion's
`createTikTokStyleCaptions` (`packages/captions/src/create-tiktok-style-captions.ts`,
MIT, (c) Remotion). Groups word-level tokens into short on-screen "pages" that
flip rapidly — the punchy short-form caption look. Pure logic, no deps.

Input: token captions [{text, start_ms, end_ms}] (text keeps its leading space,
as Whisper emits). Output: pages [{text, start_ms, duration_ms, tokens}].
"""
from __future__ import annotations

import math
from typing import Any


def create_tiktok_style_captions(captions: list[dict[str, Any]],
                                 combine_within_ms: int = 1200) -> dict[str, Any]:
    pages: list[dict[str, Any]] = []
    current_text = ""
    current_tokens: list[dict[str, Any]] = []
    current_from = 0
    current_to = 0

    def add() -> None:
        pages.append({
            "text": current_text.lstrip(),
            "start_ms": current_from,
            "tokens": current_tokens,
            "duration_ms": math.inf,
        })
        if len(pages) > 1:
            pages[-2]["duration_ms"] = current_from - pages[-2]["start_ms"]

    n = len(captions)
    for index, item in enumerate(captions):
        text = item["text"]
        start_ms, end_ms = item["start_ms"], item["end_ms"]

        if text.startswith(" ") and (current_to - current_from) > combine_within_ms:
            if current_text != "":
                add()
            current_text = text.lstrip()
            current_tokens = [t for t in
                              [{"text": current_text, "from_ms": start_ms, "to_ms": end_ms}]
                              if t["text"] != ""]
            current_from = start_ms
            current_to = end_ms
        else:
            if current_text == "":
                current_from = start_ms
            current_text = (current_text + text).lstrip()
            if text.strip() != "":
                current_tokens.append({
                    "text": current_text.lstrip() if len(current_tokens) == 0 else text,
                    "from_ms": start_ms, "to_ms": end_ms,
                })
            current_to = end_ms

        if index == n - 1 and current_text != "":
            add()
            pages[-1]["duration_ms"] = current_to - pages[-1]["start_ms"]

    # A whitespace-only final token can strand the last page with duration_ms=inf;
    # give it a real duration from the last seen time.
    if pages and not math.isfinite(pages[-1]["duration_ms"]):
        pages[-1]["duration_ms"] = max(0, current_to - pages[-1]["start_ms"])
    return {"pages": pages}


def captions_from_words(words: list[Any]) -> list[dict[str, Any]]:
    """Convert faster-whisper word objects (or dicts) → token captions.
    Accepts `.word/.start/.end` (faster-whisper) or `{text/word, start, end}`."""
    out: list[dict[str, Any]] = []
    for w in words:
        if isinstance(w, dict):
            text = w.get("text", w.get("word", ""))
            start, end = w.get("start", 0.0), w.get("end", 0.0)
        else:
            text = getattr(w, "word", "")
            start, end = getattr(w, "start", 0.0), getattr(w, "end", 0.0)
        out.append({"text": text, "start_ms": int(float(start) * 1000),
                    "end_ms": int(float(end) * 1000)})
    return out


def cues_for_clip(words: list[dict[str, Any]], clip_start: float, clip_end: float,
                  combine_within_ms: int = 1200) -> list[dict[str, Any]]:
    """Source-time word timings → clip-local TikTok caption cues for one clip.

    `words` are `{text|word, start, end}` in SOURCE seconds. Keeps the words that
    overlap `[clip_start, clip_end)`, groups them into TikTok pages, and offsets
    everything so the clip begins at t=0 — ready for `edit.write_srt` +
    `edit.burn_subtitles`. Returns [] when no words fall in the window.
    """
    in_clip: list[dict[str, Any]] = []
    for w in words:
        s = float(w.get("start", 0.0))
        e = float(w.get("end", s))
        if e > clip_start and s < clip_end:
            in_clip.append({"text": w.get("text", w.get("word", "")), "start": s, "end": e})
    if not in_clip:
        return []
    tokens = captions_from_words(in_clip)
    pages = create_tiktok_style_captions(tokens, combine_within_ms)["pages"]
    return pages_to_cues(pages, offset_s=clip_start)


def pages_for_clip(words: list[dict[str, Any]], clip_start: float, clip_end: float,
                   combine_within_ms: int = 1200) -> list[dict[str, Any]]:
    """Like `cues_for_clip` but keeps per-token timing for karaoke captions.
    Returns clip-local pages [{start, end, tokens:[{text, from_ms, to_ms}]}]."""
    in_clip: list[dict[str, Any]] = []
    for w in words:
        s = float(w.get("start", 0.0))
        e = float(w.get("end", s))
        if e > clip_start and s < clip_end:
            in_clip.append({"text": w.get("text", w.get("word", "")), "start": s, "end": e})
    if not in_clip:
        return []
    tokens = captions_from_words(in_clip)
    pages = create_tiktok_style_captions(tokens, combine_within_ms)["pages"]
    offset_ms = int(clip_start * 1000)
    out: list[dict[str, Any]] = []
    for p in pages:
        toks = [{"text": t["text"], "from_ms": t["from_ms"] - offset_ms,
                 "to_ms": t["to_ms"] - offset_ms} for t in p.get("tokens", [])]
        start = (p["start_ms"] - offset_ms) / 1000.0
        dur = p["duration_ms"]
        end = start + (dur / 1000.0 if math.isfinite(dur) and dur > 0 else 2.0)
        out.append({"start": max(0.0, round(start, 3)), "end": max(0.05, round(end, 3)),
                    "tokens": toks})
    return out


def pages_to_cues(pages: list[dict[str, Any]], offset_s: float = 0.0,
                  default_dur_s: float = 2.0) -> list[dict[str, Any]]:
    """Pages → SRT cues [{start, end, text}] (seconds), shiftable by `offset_s`
    for clip-local timing. Infinite/zero durations clamp to `default_dur_s`."""
    cues: list[dict[str, Any]] = []
    for p in pages:
        start = p["start_ms"] / 1000.0 - offset_s
        dur = p["duration_ms"] / 1000.0
        if not math.isfinite(dur) or dur <= 0:
            dur = default_dur_s
        end = start + dur
        if end <= 0:
            continue
        cues.append({"start": max(0.0, start), "end": max(0.05, end),
                     "text": p["text"]})
    return cues
