"""Project persistence for the timeline editor — palmier's `.palmier` bundle, here a
single JSON file (timeline + media references as absolute paths). load → op → save
gives Claude a stateful editor over MCP, exactly like palmier's agent workflow.
"""
from __future__ import annotations

import json
from pathlib import Path

from .timeline import Timeline


def save_project(tl: Timeline, path: str) -> str:
    """Write the timeline to `path` (JSON). Returns the path."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(tl.to_dict(), indent=2), encoding="utf-8")
    return str(p)


def load_project(path: str) -> Timeline:
    """Load a timeline JSON → Timeline. A missing/invalid file yields a fresh timeline."""
    p = Path(path)
    if not p.exists():
        return Timeline()
    try:
        return Timeline.from_dict(json.loads(p.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, ValueError, OSError):
        return Timeline()


# ── undo stack (palmier `undo` parity) — sidecar snapshot stack ──────────────
_UNDO_CAP = 30


def _undo_path(path: str) -> Path:
    return Path(str(path) + ".undo.json")


def push_undo(path: str) -> None:
    """Snapshot the CURRENT saved project state onto the undo stack (call before saving
    a mutation, so undo restores the pre-edit state)."""
    p = Path(path)
    if not p.exists():
        return
    up = _undo_path(path)
    try:
        stack = json.loads(up.read_text(encoding="utf-8")) if up.exists() else []
        if not isinstance(stack, list):
            stack = []
        stack.append(p.read_text(encoding="utf-8"))
        up.write_text(json.dumps(stack[-_UNDO_CAP:]), encoding="utf-8")
    except (json.JSONDecodeError, OSError):
        pass


def undo(path: str) -> Timeline | None:
    """Restore the most recent pre-edit snapshot. Returns the restored Timeline or None."""
    up = _undo_path(path)
    if not up.exists():
        return None
    try:
        stack = json.loads(up.read_text(encoding="utf-8"))
        if not isinstance(stack, list) or not stack:
            return None
        prev = stack.pop()
        up.write_text(json.dumps(stack), encoding="utf-8")
        Path(path).write_text(prev, encoding="utf-8")
        return Timeline.from_dict(json.loads(prev))
    except (json.JSONDecodeError, ValueError, OSError):
        return None


def export_edl(tl: Timeline, out: str) -> str:
    """Write a simple JSON edit-decision-list (interchange) — palmier's XML-interchange
    role. Lists every clip per track with source + in/out + timeline placement."""
    edl = {
        "format": "clippilot-edl-v1", "fps": tl.fps, "width": tl.width, "height": tl.height,
        "events": [
            {"track": t_i, "type": c.media_type, "clip_id": c.id, "source": c.media_ref,
             "record_in": c.start_frame, "record_out": c.end_frame,
             "source_in": c.trim_start_frame, "source_out": c.trim_end_frame,
             "speed": c.speed, "text": c.text_content}
            for t_i, t in enumerate(tl.tracks) for c in t.clips
        ],
    }
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(edl, indent=2), encoding="utf-8")
    return out


def _chapter_title(m: dict, i: int) -> str:
    return str(m.get("name") or m.get("comment") or f"Chapter {i + 1}").strip() or f"Chapter {i + 1}"


def export_chapters(tl: Timeline, out: str, fmt: str = "youtube") -> str:
    """Export the timeline markers as chapters. fmt='youtube' → a `0:00 Title` description
    block (paste into a YouTube description); fmt='ffmetadata' → an FFMETADATA1 file usable
    with `ffmpeg -i in -i chapters.txt -map_metadata 1` to embed chapter markers."""
    fps = tl.fps
    chaps = sorted([m for m in tl.markers if isinstance(m, dict)], key=lambda m: m.get("frame", 0))
    if fmt == "ffmetadata":
        total = tl.total_frames()
        lines = [";FFMETADATA1"]
        for i, m in enumerate(chaps):
            start_ms = round(m.get("frame", 0) / fps * 1000)
            end_frame = chaps[i + 1].get("frame", total) if i + 1 < len(chaps) else total
            end_ms = max(start_ms + 1, round(end_frame / fps * 1000))
            lines += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={start_ms}", f"END={end_ms}",
                      f"title={_chapter_title(m, i)}"]
        text = "\n".join(lines) + "\n"
    else:  # youtube description timestamps (H:MM:SS or M:SS); first should be 0:00
        def ts(frame: int) -> str:
            s = int(frame / fps)
            h, rem = divmod(s, 3600)
            mn, sec = divmod(rem, 60)
            return f"{h}:{mn:02d}:{sec:02d}" if h else f"{mn}:{sec:02d}"
        text = "\n".join(f"{ts(m.get('frame', 0))} {_chapter_title(m, i)}"
                         for i, m in enumerate(chaps)) + "\n"
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(text, encoding="utf-8")
    return out
