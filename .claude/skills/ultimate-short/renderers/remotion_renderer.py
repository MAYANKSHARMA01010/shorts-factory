# -*- coding: utf-8 -*-
"""Remotion + React-Three-Fiber renderer for `three_d` beats (real geometry).

Phase 2b. Requires a one-time install in ClipPilot/remotion_explainer/:
    npm install @remotion/three@4.0.482 three@^0.169.0 \
                @react-three/fiber@^8.17.10 @types/three@^0.169.0
plus src/BeatClip.tsx + src/beat-index.tsx. Until those exist, render_3d raises
RenderError and the caller falls back to the on-topic Z-Image 3D-style still.
"""
from __future__ import annotations

import json
from pathlib import Path

from .base import run, RenderError, FPS, SIZE, probe_duration
from .ffmpeg_norm import normalize_to_spec
from . import engines


def _colors(palette):
    """Accept the brief palette as a dict {bg,primary,accent} OR a list [bg,shape,accent]."""
    if isinstance(palette, dict):
        return {"bg": palette.get("bg", "#0D1B2A"),
                "shapeColor": palette.get("primary", palette.get("shape", "#4cc9f0")),
                "accentColor": palette.get("accent", "#f72585")}
    p = list(palette or []) + ["#0D1B2A", "#4cc9f0", "#f72585", "#FFD23F"]
    return {"bg": p[0], "shapeColor": p[1], "accentColor": p[2]}


def render_3d(beat: dict, seconds: float, out_path: Path, *, size=SIZE, palette=None) -> Path:
    if not engines.remotion_r3f_available():
        raise RenderError("remotion R3F not installed (ClipPilot/remotion_explainer); "
                          "falling back to Z-Image still")
    td = beat.get("three_d") or beat.get("micro_video") or {}
    frames = max(1, round(seconds * FPS))
    gen = frames / FPS
    props = {
        "subject": td.get("subject", "structure"),
        "kind": td.get("kind", "abstract"),
        **_colors(palette),
        "durationInFrames": frames, "fps": FPS,
        "width": size[0], "height": size[1],
    }
    proj = engines.REMOTION_PROJECT
    props_dir = proj / "props"
    props_dir.mkdir(parents=True, exist_ok=True)
    name = f"{beat.get('id', 'beat')}"
    (props_dir / f"{name}.json").write_text(json.dumps(props), encoding="utf-8")
    raw = props_dir / f"{name}_raw.mp4"

    def _do_render(gl: str):
        run(["node", str(engines.REMOTION_CLI), "render", "src/beat-index.tsx", "BeatClip",
             str(raw), f"--props=./props/{name}.json", "--concurrency=1", f"--gl={gl}",
             "--log=error"], cwd=str(proj), timeout=600)

    # try the GPU path, fall back to CPU swangle on failure/blank
    try:
        _do_render("angle")
        if not raw.exists() or probe_duration(raw) <= 0:
            raise RenderError("angle produced blank")
    except RenderError:
        _do_render("swangle")
    if not raw.exists() or probe_duration(raw) <= 0:
        raise RenderError("remotion produced no/blank output")
    return normalize_to_spec(raw, out_path, seconds, size=size)


def render_animation(beat: dict, seconds: float, out_path: Path, *, size=SIZE, palette=None) -> Path:
    # Optional DOM/GSAP-in-Remotion path; HyperFrames is the primary animation engine.
    raise RenderError("remotion animation renderer not implemented; use hyperframes")
