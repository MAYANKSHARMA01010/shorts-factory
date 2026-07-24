"""Source-video download via yt-dlp (OpenMontage technique; yt-dlp is Unlicense).

Section A clips an OWNED / AUTHORIZED long-form source. This pulls such a source
from a URL to a local file so the rest of the pipeline (signals→clip→caption) can
work on it.

RIGHTS NOTE: only download content you own, license, or are otherwise authorized to
repurpose. ClipPilot tags every job with a rights flag and keeps the human approval
gate on — the operator owns the legal call. This is a tool, not a license.

Degrades gracefully: prefers the yt-dlp Python API, falls back to the `yt-dlp` CLI
on PATH, and otherwise returns {available: False} with an install hint.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional


def _have_module() -> bool:
    import importlib.util
    return importlib.util.find_spec("yt_dlp") is not None


def ytdlp_available() -> bool:
    return _have_module() or shutil.which("yt-dlp") is not None


def _valid_url(url: str) -> bool:
    return isinstance(url, str) and url.strip().lower().startswith(("http://", "https://"))


def _fmt(max_height: int) -> str:
    return (f"bestvideo[height<={max_height}]+bestaudio/"
            f"best[height<={max_height}]/best")


def _download_via_module(url: str, out_dir: str, max_height: int) -> dict[str, Any]:
    import yt_dlp
    opts = {
        "outtmpl": str(Path(out_dir) / "%(id)s.%(ext)s"),
        "format": _fmt(max_height),
        "merge_output_format": "mp4",
        "quiet": True, "no_warnings": True, "noprogress": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        rd = (info.get("requested_downloads") or [{}])[0]
        path = rd.get("filepath") or ydl.prepare_filename(info)
        return {"available": True, "path": str(path),
                "title": info.get("title"),
                "duration_s": float(info.get("duration") or 0.0),
                "source_url": url}


def _download_via_cli(url: str, out_dir: str, max_height: int) -> dict[str, Any]:
    exe = shutil.which("yt-dlp")
    tmpl = str(Path(out_dir) / "%(id)s.%(ext)s")
    before = set(Path(out_dir).glob("*"))
    proc = subprocess.run(
        [exe, "-f", _fmt(max_height), "--merge-output-format", "mp4",
         "--no-warnings", "-q", "-o", tmpl, url],
        capture_output=True, text=True, timeout=600,
    )
    if proc.returncode != 0:
        return {"available": False, "reason": (proc.stderr or "yt-dlp failed").strip()[:300]}
    new = [p for p in Path(out_dir).glob("*") if p not in before and p.is_file()]
    if not new:
        return {"available": False, "reason": "download produced no file"}
    newest = max(new, key=lambda p: p.stat().st_mtime)
    return {"available": True, "path": str(newest), "title": newest.stem, "source_url": url}


def download_source(url: str, out_dir: str, max_height: int = 1080) -> dict[str, Any]:
    """Download a source video from `url` into `out_dir`. Returns
    {available, path, title, duration_s, source_url} or {available: False, reason}."""
    if not _valid_url(url):
        return {"available": False, "reason": "url must start with http:// or https://"}
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    try:
        if _have_module():
            return _download_via_module(url, out_dir, max_height)
        if shutil.which("yt-dlp"):
            return _download_via_cli(url, out_dir, max_height)
    except Exception as e:  # noqa: BLE001 — network/extractor failure → clean reason
        return {"available": False, "reason": f"{type(e).__name__}: {e}"[:300]}
    return {"available": False, "reason": "yt-dlp not installed (pip install yt-dlp)"}
