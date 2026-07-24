"""Batch enqueue — point ClipPilot at a folder and queue every video in it.

The done-for-you throughput path: an operator drops a client's whole footage
folder and the engine works through it. Re-running the same folder is **idempotent**
(each file gets a path-derived idempotency key), so it's safe to re-scan as new
files land — already-queued sources are skipped, not duplicated.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".flv", ".wmv", ".mpg", ".mpeg"}


def find_videos(folder: str, recursive: bool = True,
                exts: Optional[set[str]] = None) -> list[str]:
    """Sorted list of video files in `folder` (recursively by default)."""
    exts = exts or VIDEO_EXTS
    base = Path(folder)
    if not base.is_dir():
        return []
    it = base.rglob("*") if recursive else base.glob("*")
    return sorted(str(p) for p in it if p.is_file() and p.suffix.lower() in exts)


def enqueue_folder(queue: Any, folder: str, section: str = "A", rights: str = "owned",
                   channel: Optional[str] = None, recursive: bool = True) -> dict[str, Any]:
    """Enqueue every video in `folder` as a job. Idempotent per file path."""
    files = find_videos(folder, recursive)
    ids: list[int] = []
    for f in files:
        job = queue.enqueue(
            f, section=section, rights_tag=rights, channel=channel,
            # normcase so the same physical file via different-cased paths (common on
            # Windows) maps to ONE key — no duplicate enqueue/clip/publish.
            idempotency_key="folder:" + os.path.normcase(os.path.abspath(f)),
        )
        ids.append(job.id)
    return {"folder": str(folder), "found": len(files),
            "enqueued_ids": ids, "count": len(ids)}
