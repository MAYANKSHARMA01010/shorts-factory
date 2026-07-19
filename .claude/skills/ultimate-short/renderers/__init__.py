# -*- coding: utf-8 -*-
"""Per-beat renderer dispatch for the ultimate-short pipeline.

render_beat(beat, seconds, out_path, size, palette) -> Path renders ONE non-still beat
to a normalized 1080x1920 SILENT mp4 of EXACTLY `seconds`, or raises RenderError so the
caller (compose) can fall back to the Z-Image still. The pipeline therefore never fails
because an engine is missing or broken.
"""
from __future__ import annotations

from pathlib import Path

from .base import RenderError, SIZE
from . import hyperframes_renderer, remotion_renderer, engines

# visual-type -> (engine-key -> renderer fn). engine-key from
# beat['animation']['engine'] / beat['three_d']['engine'].
_REGISTRY = {
    "animation": {
        "hyperframes": hyperframes_renderer.render,
        "remotion": remotion_renderer.render_animation,
        "remotion_r3f": remotion_renderer.render_3d,
    },
    "three_d": {
        "three.js": remotion_renderer.render_3d,
        "remotion_r3f": remotion_renderer.render_3d,
        "default": remotion_renderer.render_3d,
    },
    # micro_video defaults to an R3F "camera-fly" 3D beat (the planned substitute for
    # LTX, which won't fit 6GB). wan2gp LTX-2B remains a documented opt-in future engine.
    "micro_video": {
        "default": remotion_renderer.render_3d,
        "remotion_r3f": remotion_renderer.render_3d,
    },
}


def render_beat(beat: dict, seconds: float, out_path: Path, size=SIZE, palette=None) -> Path:
    palette = palette or []
    vis = beat.get("visual")
    if vis == "animation":
        eng = (beat.get("animation") or {}).get("engine", "hyperframes")
    elif vis == "three_d":
        eng = (beat.get("three_d") or {}).get("engine", "default")
    elif vis == "micro_video":
        eng = (beat.get("micro_video") or {}).get("engine", "default")
    else:
        raise RenderError(f"render_beat called for visual={vis!r}; "
                          f"only animation/three_d/micro_video supported")
    table = _REGISTRY.get(vis, {})
    fn = table.get(eng) or table.get("default") or next(iter(table.values()), None)
    if fn is None:
        raise RenderError(f"no renderer registered for visual={vis} engine={eng}")
    return fn(beat, seconds, out_path, size=size, palette=palette)


__all__ = ["render_beat", "RenderError", "engines"]
