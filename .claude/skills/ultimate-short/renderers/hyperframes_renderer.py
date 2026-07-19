# -*- coding: utf-8 -*-
"""HyperFrames renderer — authors a palette-driven GSAP motion-graphic composition
and renders it headless (SwiftShader) to a 1080x1920 silent beat clip.

The composition is a moving background (rings, pulsing core, rising bars, drifting
dots, light sweep) in the brief palette + an optional kicker chip. The hero text is
the burned ASS caption added later by compose(), so this deliberately avoids a big
duplicate headline.
"""
from __future__ import annotations

from pathlib import Path

from .base import run, RenderError, FPS, SIZE, probe_duration
from .ffmpeg_norm import normalize_to_spec
from . import engines

PKG = Path(__file__).resolve().parent
TEMPLATE = PKG / "templates" / "hyperframes_index.html.tmpl"
WORK = PKG / "_projects" / "hf"


def _darken(hexcol: str, f: float = 0.5) -> str:
    h = str(hexcol).lstrip("#")
    if len(h) != 6:
        h = "0D1B2A"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r * f):02x}{int(g * f):02x}{int(b * f):02x}"


def _colors(palette):
    """Accept the brief palette as a dict {bg,primary,accent,text} OR a list [bg,shape,accent]."""
    if isinstance(palette, dict):
        bg = palette.get("bg", "#0D1B2A")
        shape = palette.get("primary", palette.get("shape", "#4cc9f0"))
        accent = palette.get("accent", "#f72585")
        text = palette.get("text", "#FFFFFF")
    else:
        p = list(palette or []) + ["#0D1B2A", "#4cc9f0", "#f72585", "#FFD23F"]
        bg, shape, accent, text = p[0], p[1], p[2], "#FFFFFF"
    return {"bg": bg, "bg2": _darken(bg), "shape": shape, "accent": accent, "text": text}


def _kicker(beat: dict) -> str:
    # The burned ASS caption is the hero text; a scene-derived kicker tended to
    # duplicate it ("CAFFEINE BLOCKING" vs caption "CAFFEINE BLOCKS IT"). Default to
    # no kicker for clean motion-graphics + caption. A brief may set an explicit,
    # non-duplicative label via animation.kicker.
    k = ((beat.get("animation") or {}).get("kicker") or "").strip()
    return k.upper()[:18]


def render(beat: dict, seconds: float, out_path: Path, *, size=SIZE, palette=None) -> Path:
    if not engines.hyperframes_available():
        raise RenderError("hyperframes cli/node not available")
    frames = max(1, round(seconds * FPS))
    gen = frames / FPS
    c = _colors(palette)
    try:
        tmpl = TEMPLATE.read_text(encoding="utf-8")
    except OSError as e:
        raise RenderError(f"missing hyperframes template: {e}") from e
    html = (tmpl.replace("__W__", str(size[0])).replace("__H__", str(size[1]))
                .replace("__DURATION__", f"{gen:.3f}")
                .replace("__BG2__", c["bg2"]).replace("__BG__", c["bg"])
                .replace("__SHAPE__", c["shape"]).replace("__ACCENT__", c["accent"])
                .replace("__TEXT__", c["text"]).replace("__KICKER__", _kicker(beat)))
    proj = WORK / str(beat.get("id", "beat"))
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "index.html").write_text(html, encoding="utf-8")
    raw = proj / "raw.mp4"
    run(["node", str(engines.HF_CLI), "render", str(proj),
         "--fps", str(FPS), "--quality", "high", "--output", str(raw),
         "--no-browser-gpu", "--quiet"], cwd=str(proj), timeout=300)
    if not raw.exists() or probe_duration(raw) <= 0:
        raise RenderError("hyperframes produced no/blank output")
    return normalize_to_spec(raw, out_path, seconds, size=size)
