"""Slide Replacement & Video Re-composition Engine.

Given a ClipPilot explainer project directory (one that already has slide_XX.mp4
clips, narration.wav, and captions.ass), this module lets you:

  1.  replace_slide_image(project_dir, slide_index, new_image_path)
      — Converts a new image into a correctly sized/timed slide_XX.mp4, with a
        non-destructive backup of the original in broll/.bak/.

  2.  revert_slide(project_dir, slide_index)
      — Restores the original backed-up broll image and re-renders slide_XX.mp4.

  3.  recompose_project(project_dir)
      — Re-stitches all slide clips, re-muxes with narration, and re-burns
        captions. Returns path to the updated Final_*.mp4.

All functions are pure Python + ffmpeg (via ClipPilot's existing ffmpeg helper).
No TTS or transcription is re-run — the existing narration.wav and captions.ass
are reused exactly.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .ffmpeg import run_ffmpeg, get_ffmpeg

# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ok(r: subprocess.CompletedProcess, out: str) -> bool:
    return r.returncode == 0 and Path(out).exists() and Path(out).stat().st_size > 0


def _probe_duration(path: str) -> float:
    """Return the video/audio duration in seconds via ffprobe or ffmpeg -i stderr."""
    # Try ffprobe first
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=30,
        )
        try:
            return float(r.stdout.strip())
        except (ValueError, AttributeError):
            pass

    # Fallback: parse ffmpeg -i stderr for "Duration: HH:MM:SS.ss"
    exe = get_ffmpeg()
    if exe:
        r = subprocess.run([exe, "-hide_banner", "-i", path],
                           capture_output=True, text=True, timeout=30)
        m = re.search(r"Duration:\s+(\d+):(\d+):([\d.]+)", r.stderr or "")
        if m:
            h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
            return h * 3600 + mn * 60 + s
    return 0.0


def _probe_video_size(path: str) -> tuple[int, int]:
    """Return (width, height) of the first video stream."""
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height",
             "-of", "csv=s=x:p=0", path],
            capture_output=True, text=True, timeout=30,
        )
        try:
            w, h = map(int, r.stdout.strip().split("x"))
            return w, h
        except (ValueError, AttributeError):
            pass
    return 1080, 1920  # safe default for vertical shorts


def _kenburns_vf(width: int, height: int, index: int = 0) -> str:
    """Alternate slow zoom-in / zoom-out Ken-Burns filter (identical to assemble.py)."""
    if index % 2 == 0:
        scale_expr = f"scale=w='{width}*(1+0.0005*n)':h='{height}*(1+0.0005*n)':eval=frame"
    else:
        scale_expr = f"scale=w='{width}*(1.12-0.0005*n)':h='{height}*(1.12-0.0005*n)':eval=frame"
    return (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},"
        f"{scale_expr},"
        f"crop={width}:{height},"
        f"setsar=1,format=yuv420p"
    )


def _get_slide_files(project_dir: Path) -> list[Path]:
    """Return all slide_XX.mp4 files sorted by index."""
    slides = sorted(
        project_dir.glob("slide_*.mp4"),
        key=lambda p: int(re.search(r"slide_(\d+)", p.name).group(1))  # type: ignore[union-attr]
    )
    return slides


def _find_final_out_path(project_dir: Path) -> Path:
    """Compute the output path for the final composed video."""
    # Prefer the naming pattern already in use (Final_<Name>.mp4)
    existing = sorted(project_dir.glob("Final_*.mp4"), key=lambda p: p.stat().st_size, reverse=True)
    if existing:
        return existing[0]
    stem = project_dir.name.replace("explainer_", "").replace("short_", "").title()
    return project_dir / f"Final_{stem}.mp4"


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def replace_slide_image(
    project_dir: str | Path,
    slide_index: int,
    new_image_path: str | Path,
    fps: int = 30,
) -> dict:
    """Replace slide *slide_index* with a new background image.

    Steps:
      1. Probe the existing slide_XX.mp4 for its exact duration and resolution.
      2. Back up the current broll/broll_XX.jpg → broll/.bak/broll_XX.jpg (skip
         if already backed up, so the *original* is never overwritten).
      3. Copy the new image → broll/broll_XX.jpg.
      4. Re-render slide_XX.mp4 using Ken-Burns (matching the original duration).

    Returns a dict with keys: ``success``, ``slide_path``, and optionally ``error``.
    """
    project_dir = Path(project_dir)
    new_image_path = Path(new_image_path)

    slide_name = f"slide_{slide_index:02d}.mp4"
    slide_path = project_dir / slide_name

    if not slide_path.exists():
        return {"success": False, "error": f"{slide_name} not found in {project_dir}"}

    if not new_image_path.exists():
        return {"success": False, "error": f"New image not found: {new_image_path}"}

    # Probe original slide for duration and size
    duration = _probe_duration(str(slide_path))
    if duration <= 0:
        return {"success": False, "error": f"Could not determine duration of {slide_name}"}
    width, height = _probe_video_size(str(slide_path))

    # Back up original broll image (only once — preserve the true original)
    broll_dir = project_dir / "broll"
    bak_dir = broll_dir / ".bak"
    bak_dir.mkdir(parents=True, exist_ok=True)

    original_broll = broll_dir / f"broll_{slide_index:02d}.jpg"
    bak_broll = bak_dir / f"broll_{slide_index:02d}.jpg"
    if original_broll.exists() and not bak_broll.exists():
        shutil.copy2(original_broll, bak_broll)

    # Write new image as the current broll_XX.jpg (convert if needed)
    dest_broll = broll_dir / f"broll_{slide_index:02d}.jpg"
    ext = new_image_path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        shutil.copy2(new_image_path, dest_broll)
    else:
        # Convert PNG/WEBP/etc. → JPEG via ffmpeg
        r = run_ffmpeg(["-y", "-i", str(new_image_path), str(dest_broll)])
        if r.returncode != 0:
            return {"success": False, "error": f"Image conversion failed: {r.stderr[-500:]}"}

    # Re-render the slide clip
    vf = _kenburns_vf(width, height, index=slide_index)
    r = run_ffmpeg([
        "-loop", "1",
        "-i", str(dest_broll),
        "-t", f"{duration:.3f}",
        "-vf", vf,
        "-r", str(fps),
        "-an",
        "-c:v", "libx264",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-y", str(slide_path),
    ], timeout=600)

    if not _ok(r, str(slide_path)):
        return {"success": False, "error": f"Slide re-render failed: {r.stderr[-800:]}"}

    # Bust the cached thumbnail so the UI shows the new frame on next manifest fetch
    thumb = project_dir / "thumbs" / f"slide_{slide_index:02d}_thumb.jpg"
    if thumb.exists():
        thumb.unlink()

    return {"success": True, "slide_path": str(slide_path)}


def revert_slide(project_dir: str | Path, slide_index: int, fps: int = 30) -> dict:
    """Revert slide *slide_index* to the original backed-up broll image.

    Returns a dict with keys: ``success``, ``slide_path``, and optionally ``error``.
    """
    project_dir = Path(project_dir)

    bak_broll = project_dir / "broll" / ".bak" / f"broll_{slide_index:02d}.jpg"
    if not bak_broll.exists():
        return {"success": False, "error": f"No backup found for slide {slide_index}. It was never replaced."}

    return replace_slide_image(
        project_dir=project_dir,
        slide_index=slide_index,
        new_image_path=bak_broll,
        fps=fps,
    )


def recompose_project(project_dir: str | Path, fps: int = 30, timeout: int = 1200) -> dict:
    """Re-stitch all slide clips, mux with narration, and burn captions.

    This re-runs the *final assembly steps only* — no TTS, no captioning, no
    b-roll fetch.  It is fast (~5–30 s depending on video length and machine).

    Returns a dict with keys: ``success``, ``video_path``, and optionally ``error``.
    """
    project_dir = Path(project_dir)

    narration = project_dir / "narration.wav"
    captions  = project_dir / "captions.ass"

    if not narration.exists():
        return {"success": False, "error": f"narration.wav not found in {project_dir}"}

    # ── Step 1: Re-generate slides_concat.txt ────────────────────────────────
    slide_files = _get_slide_files(project_dir)
    if not slide_files:
        return {"success": False, "error": "No slide_XX.mp4 files found in project."}

    concat_txt = project_dir / "slides_concat.txt"
    concat_txt.write_text(
        "".join(f"file '{s.name}'\n" for s in slide_files),
        encoding="utf-8",
    )

    # ── Step 2: Concatenate slides → slides_silent.mp4 ────────────────────
    silent_mp4 = project_dir / "slides_silent.mp4"
    r = run_ffmpeg([
        "-f", "concat", "-safe", "0",
        "-i", concat_txt.name,
        "-c", "copy",
        "-y", str(silent_mp4.resolve()),
    ], cwd=str(project_dir), timeout=timeout)

    if not _ok(r, str(silent_mp4)):
        return {"success": False, "error": f"Slide concatenation failed: {r.stderr[-800:]}"}

    # ── Step 3: Mux video + narration ─────────────────────────────────────
    base_mp4 = project_dir / "base.mp4"
    r = run_ffmpeg([
        "-i", str(silent_mp4),
        "-i", str(narration),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        "-movflags", "+faststart",
        "-y", str(base_mp4),
    ], timeout=timeout)

    if not _ok(r, str(base_mp4)):
        return {"success": False, "error": f"Narration mux failed: {r.stderr[-800:]}"}

    # ── Step 4: Burn captions (if captions.ass exists) ────────────────────
    final_mp4 = _find_final_out_path(project_dir)
    # Work from the project dir so the subtitles filter can reference captions.ass by bare name
    if captions.exists():
        # Use the subtitles filter with the bare filename (cwd=project_dir avoids path escaping issues)
        r = run_ffmpeg([
            "-i", str(base_mp4),
            "-vf", f"subtitles=captions.ass",
            "-c:v", "libx264",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-movflags", "+faststart",
            "-y", str(final_mp4.resolve()),
        ], cwd=str(project_dir), timeout=timeout)

        if not _ok(r, str(final_mp4)):
            # Caption burn failed — fall back to base (no captions)
            shutil.copy2(base_mp4, final_mp4)
    else:
        shutil.copy2(base_mp4, final_mp4)

    # Also update the legacy alias (why_cant_remember_baby.mp4 style)
    for alias in project_dir.glob("*.mp4"):
        if alias != final_mp4 and alias not in slide_files and alias not in (silent_mp4, base_mp4):
            if not alias.name.startswith("slide_") and "silent" not in alias.name and "base" not in alias.name:
                shutil.copy2(final_mp4, alias)
                break

    # ── Step 5: Update manifest.json ──────────────────────────────────────
    try:
        update_manifest_after_recompose(project_dir, final_mp4)
    except Exception:
        pass  # Never let manifest update failure block the video result

    return {"success": True, "video_path": str(final_mp4)}


def _extract_slide_thumbnail(slide_path: Path, thumb_path: Path) -> bool:
    """Extract a single frame from slide_path at t=0.5s → thumb_path (JPEG).

    Returns True on success.
    """
    ffmpeg = get_ffmpeg()
    r = subprocess.run(
        [
            ffmpeg, "-y",
            "-ss", "0.5",
            "-i", str(slide_path),
            "-vframes", "1",
            "-vf", "scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2",
            "-q:v", "3",
            str(thumb_path),
        ],
        capture_output=True, text=True, timeout=30,
    )
    return r.returncode == 0 and thumb_path.exists() and thumb_path.stat().st_size > 0


def get_slide_metadata(project_dir: str | Path) -> dict:
    """Return per-slide metadata for the Slide Timeline Editor UI.

    Each slide entry contains:
      index, slide_file, thumbnail (thumbs/slide_XX_thumb.jpg or None),
      has_replacement (bool — True if user uploaded a custom image),
      duration_s, width, height.

    Thumbnails are extracted from each slide_XX.mp4 on first call and
    cached in <project_dir>/thumbs/ so subsequent loads are instant.
    """
    project_dir = Path(project_dir)
    slides = _get_slide_files(project_dir)

    thumbs_dir = project_dir / "thumbs"
    thumbs_dir.mkdir(exist_ok=True)

    result = []
    for slide in slides:
        m = re.search(r"slide_(\d+)", slide.name)
        idx = int(m.group(1)) if m else 0
        dur = _probe_duration(str(slide))
        w, h = _probe_video_size(str(slide))

        # Thumbnail: extracted from the slide clip itself (reliable for all projects)
        thumb_name = f"slide_{idx:02d}_thumb.jpg"
        thumb_path = thumbs_dir / thumb_name
        if not thumb_path.exists() or thumb_path.stat().st_size == 0:
            _extract_slide_thumbnail(slide, thumb_path)

        thumb_rel = f"thumbs/{thumb_name}" if thumb_path.exists() else None

        # Replacement detection: a backup broll image exists → user replaced this slide
        bak = project_dir / "broll" / ".bak" / f"broll_{idx:02d}.jpg"
        has_replacement = bak.exists()

        result.append({
            "index": idx,
            "slide_file": slide.name,
            "broll_image": thumb_rel,   # served via /api/project/<id>/slide_asset/thumbs/...
            "has_replacement": has_replacement,
            "duration_s": round(dur, 3),
            "width": w,
            "height": h,
        })

    return {"project_id": project_dir.name, "slides": result}


def update_manifest_after_recompose(project_dir: str | Path, final_video_path: str | Path) -> dict:
    """Update manifest.json to reflect the newly recomposed video.

    Sets / updates:
      assets.video_path          ← absolute path to the new Final_*.mp4
      project_info.recomposed_at ← ISO-8601 UTC timestamp of this recompose
      project_info.status        ← 'ready_to_upload' (reset so Drive re-upload runs)
      gdrive.drive_file_id       ← cleared (stale — old Drive file will be deleted)
      gdrive.drive_link          ← cleared

    Returns the updated manifest dict.
    """
    project_dir = Path(project_dir)
    final_video_path = Path(final_video_path)
    manifest_path = project_dir / "manifest.json"

    # Load existing manifest (or create a minimal one)
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            manifest = {}
    else:
        manifest = {}

    # Ensure top-level sections exist
    manifest.setdefault("project_info", {})
    manifest.setdefault("assets", {})

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Update video path
    manifest["assets"]["video_path"] = str(final_video_path.resolve())

    # Mark as recomposed and reset status so Drive re-upload triggers
    manifest["project_info"]["recomposed_at"] = now_iso
    manifest["project_info"]["status"] = "ready_to_upload"

    # Clear stale Drive metadata so the next upload creates a fresh file
    if "gdrive" in manifest:
        manifest["gdrive"].pop("drive_file_id", None)
        manifest["gdrive"].pop("drive_link", None)

    # Write back
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest
