"""`understand_video(path)` — assembles the holistic Understanding (docs/07).

Phase-1 scope (CPU-only, no ML, no Claude call yet): run the cheap ffmpeg
signals, carve the timeline into shots, sample one keyframe per shot, and
populate the deterministic fields of the `Understanding` object. The semantic
fields (`summary`, per-scene `visual_desc`, mood labels, on-screen-text reads,
highlight `reasons`) are intentionally left as placeholders — they get filled by
Claude's own vision over the attached keyframes in the `understand_video` MCP
tool turn (Phase 1b), and by faster-whisper/MediaPipe/CLIP once the 3.12 venv
lands.
"""
from __future__ import annotations

import hashlib
import os
from typing import Optional

from . import config as cfg
from .media import sampler, signals
from .understanding import Scene, SourceMeta, Understanding


def _keyframe_dir(path: str) -> str:
    cfg.ensure_dirs()
    key = hashlib.sha1(os.path.abspath(path).encode("utf-8")).hexdigest()[:12]
    return str(cfg.MEDIA_DIR / "keyframes" / key)


# Anthropic vision accepts <=100 images per request (brain.prompt.MAX_IMAGES);
# never sample more keyframes than the vision pass can actually use.
_MAX_VISION_FRAMES = 100


def understand_video(path: str, frame_cap: int = _MAX_VISION_FRAMES, frame_width: int = 768,
                     out_dir: Optional[str] = None, client: Optional[object] = None,
                     transcript_segments: Optional[list] = None) -> Understanding:
    """Build the Understanding for a video file.

    The deterministic fields (scenes, keyframes, source, energy) are always
    filled from ffmpeg. If a `client` (brain VisionClient) is supplied, the
    semantic fields (summary, per-scene visual_desc, mood, on-screen text,
    highlight reasons, likeness flag) are filled by Claude's vision pass over the
    keyframes. With no client, the semantic fields stay as placeholders.

    Raises nothing on a missing file/ffmpeg — returns an Understanding whose
    summary explains why it's empty, so callers can branch on `source.duration_s`.
    """
    sig = signals.extract_signals(path)
    if not sig.get("available"):
        u = Understanding()
        u.summary = f"(unavailable) {sig.get('reason', 'no signals')}"
        return u

    meta = SourceMeta(**sig["source"])
    duration = meta.duration_s
    scene_cuts = sig.get("scene_cuts", [])
    out_dir = out_dir or _keyframe_dir(path)

    keyframes = sampler.sample_keyframes(
        path, scene_cuts, duration, out_dir, width=frame_width,
        cap=min(frame_cap, _MAX_VISION_FRAMES),  # don't extract frames the brain can't see
    )

    segs = transcript_segments or []
    scenes: list[Scene] = []
    for idx, (a, b) in enumerate(sampler.shot_windows(scene_cuts, duration)):
        kf = next((k for k in keyframes if a <= k["t"] < b), None)
        excerpt = ""
        if segs:
            from .media.transcribe import excerpt_for_window
            excerpt = excerpt_for_window(segs, a, b)
        scenes.append(Scene(
            idx=idx, start=round(a, 3), end=round(b, 3),
            keyframe_path=kf["path"] if kf else None,
            shot_change_score=0.0,
            transcript_excerpt=excerpt,
            visual_desc="",            # ← Claude fills from the keyframe
        ))

    u = Understanding(
        source=meta,
        summary="(pending Claude-vision pass over keyframes)",
        scenes=scenes,
        keyframe_paths=[k["path"] for k in keyframes],
        mood_energy_timeline=[{
            "t": 0.0,
            "integrated_lufs": sig.get("integrated_lufs"),
            "label": "",            # ← Claude labels mood
        }],
        flags={"third_party_source": []},
    )
    # Optional Claude vision pass (fills the semantic fields + likeness flag).
    # A brain/API failure (rate limit, timeout, refusal) must NOT sink the stage —
    # degrade to the deterministic Understanding we already built.
    if client is not None:
        from .brain.orchestrator import enrich_understanding
        try:
            u = enrich_understanding(u, keyframe_paths=u.keyframe_paths, client=client)  # type: ignore[arg-type]
        except Exception as exc:  # noqa: BLE001
            u.flags.setdefault("brain", []).append(f"enrich failed: {type(exc).__name__}: {exc}")
    return u


def understanding_meta(path: str) -> dict:
    """Lightweight summary of what an understanding pass would cost/produce —
    handy for the UI/approval gate before committing to the (costlier) Claude pass."""
    sig = signals.extract_signals(path)
    if not sig.get("available"):
        return {"available": False, "reason": sig.get("reason")}
    meta = SourceMeta(**sig["source"])
    times = sampler.sampling_times(sig.get("scene_cuts", []), meta.duration_s)
    return {
        "available": True,
        "duration_s": meta.duration_s,
        "shots": sig.get("shot_count", 0),
        "planned_keyframes": len(times),
        "has_audio": meta.has_audio,
    }
