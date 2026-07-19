"""Composite a Timeline to an mp4 via a single ffmpeg filtergraph — palmier-pro's
"export"/preview, re-authored with ffmpeg (no AVFoundation).

Each non-text clip becomes one ffmpeg input (trimmed via -ss/-t, looped for images);
its video is scaled/cropped to its on-canvas size, given opacity + fades, time-shifted
to its timeline position, and overlaid (track order = stack order, with `enable` so
same-track sequential clips show only in their window) onto a base canvas. Audio-bearing
clips are delayed/volumed/faded and amix'd. Text clips are baked with `drawtext`.

The filter-string builders are pure (unit-testable); `render_timeline` runs ffmpeg.
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Callable, Optional

from ..media.ffmpeg import run_ffmpeg
from . import keyframes as KF
from .timeline import Clip, Timeline

_VISUAL = ("video", "image")


# Clip-to-clip transitions (MoneyPrinterPlus/moviepy technique). The incoming clip
# starts `lead` frames early, overlapping the previous clip (on the base) — fade →
# crossfade; slide_* → slides in from off-screen; wipe_* → crop reveal.
TRANSITIONS = ("fade", "dissolve", "slide_left", "slide_right", "slide_up", "slide_down",
               "wipe_left", "wipe_right")


# Premiere opacity blend modes → ffmpeg `blend` all_mode. None = normal (plain overlay).
BLEND_MODES = {
    "normal": None, "multiply": "multiply", "screen": "screen", "overlay": "overlay",
    "darken": "darken", "lighten": "lighten", "color_dodge": "dodge", "color_burn": "burn",
    "hard_light": "hardlight", "soft_light": "softlight", "difference": "difference",
    "exclusion": "exclusion", "add": "addition", "linear_dodge": "addition",
    "subtract": "subtract", "divide": "divide", "linear_light": "linearlight",
    "vivid_light": "vividlight", "pin_light": "pinlight", "grain_merge": "grainmerge",
    "grain_extract": "grainextract",
}


def _blend_mode(clip: Clip) -> Optional[str]:
    """ffmpeg blend all_mode for the clip's Premiere blend_mode, or None (normal overlay)."""
    bm = getattr(clip, "blend_mode", None)
    if isinstance(bm, str) and bm:
        return BLEND_MODES.get(bm.lower().replace(" ", "_").replace("-", "_"))
    return None


# Color grading + film grain (OpenShot color/grain presets → ffmpeg eq/colortemperature/noise).
COLOR_PRESETS = {
    "warm": {"temperature": 5500, "saturation": 1.05},
    "cool": {"temperature": 8000, "saturation": 1.0},
    "vivid": {"saturation": 1.35, "contrast": 1.12},
    "cinematic": {"contrast": 1.1, "saturation": 0.92, "temperature": 4800, "grain": 6},
    "bw": {"saturation": 0.0, "contrast": 1.15},
    "film35": {"contrast": 1.08, "saturation": 0.96, "grain": 10},
}


_CURVE_CHANNELS = {"master": "m", "m": "m", "red": "r", "r": "r",
                   "green": "g", "g": "g", "blue": "b", "b": "b"}


def _curves_filter(curves: Any) -> Optional[str]:
    """Lumetri RGB Curves → ffmpeg `curves`. `curves` = {master|red|green|blue: "x/y x/y …"}
    (points in 0..1). Per-channel tone curves."""
    if not isinstance(curves, dict):
        return None
    parts = []
    for k, pts in curves.items():
        opt = _CURVE_CHANNELS.get(str(k).lower())
        if opt and isinstance(pts, str) and pts.strip():
            parts.append(f"{opt}='{pts.strip()}'")
    return "curves=" + ":".join(parts) if parts else None


def _wheels_filter(color: dict[str, Any]) -> Optional[str]:
    """Lumetri Color Wheels (Lift/Gamma/Gain) → ffmpeg `colorbalance` shadows/midtones/
    highlights. Each is an [r,g,b] triple in -1..1 (0 = neutral)."""
    def trip(key: str) -> Optional[list[float]]:
        v = color.get(key)
        if isinstance(v, (list, tuple)) and len(v) >= 3:
            try:
                return [max(-1.0, min(1.0, float(x))) for x in v[:3]]
            except (TypeError, ValueError):
                return None
        return None
    lift, mid, gain = trip("lift"), trip("gamma_rgb"), trip("gain")
    if not (lift or mid or gain):
        return None
    p: list[str] = []
    if lift:
        p += [f"rs={lift[0]:.3f}", f"gs={lift[1]:.3f}", f"bs={lift[2]:.3f}"]
    if mid:
        p += [f"rm={mid[0]:.3f}", f"gm={mid[1]:.3f}", f"bm={mid[2]:.3f}"]
    if gain:
        p += [f"rh={gain[0]:.3f}", f"gh={gain[1]:.3f}", f"bh={gain[2]:.3f}"]
    return "colorbalance=" + ":".join(p)


_SC_FAMILIES = ("reds", "yellows", "greens", "cyans", "blues", "magentas",
                "whites", "neutrals", "blacks")


def _selective_filter(selective: Any) -> Optional[str]:
    """Lumetri HSL Secondary (qualify by colour family) → ffmpeg `selectivecolor`.
    `selective` = {family: [cyan, magenta, yellow, (black)]} each -1..1; family ∈ reds|
    yellows|greens|cyans|blues|magentas|whites|neutrals|blacks."""
    if not isinstance(selective, dict):
        return None
    parts = []
    for fam, vals in selective.items():
        if str(fam).lower() in _SC_FAMILIES and isinstance(vals, (list, tuple)) and len(vals) >= 3:
            try:
                v = [max(-1.0, min(1.0, float(x))) for x in vals[:4]]
            except (TypeError, ValueError):
                continue
            parts.append(f"{str(fam).lower()}=" + " ".join(f"{x:.3f}" for x in v))
    return "selectivecolor=" + ":".join(parts) if parts else None


def _color_filters(color: Optional[dict[str, Any]], lut_name: Optional[str] = None) -> list[str]:
    """ffmpeg color-grade filters for a clip's `color` dict (or a preset name) — Lumetri:
    Basic Correction (eq/temperature), RGB Curves, Color Wheels (lift/gamma/gain), HSL Secondary
    (selective colour), Creative LUT, grain. `lut_name` is a bare .cube filename in the workdir."""
    if isinstance(color, str):
        color = COLOR_PRESETS.get(color, {})
    if not isinstance(color, dict) or not color:
        return [f"lut3d={lut_name}"] if lut_name else []
    out: list[str] = []
    eq = []
    b = _cf(color.get("brightness"), -1.0, 1.0, 0.0)      # -1..1
    c = _cf(color.get("contrast"), 0.0, 3.0, 1.0)         # 0..3 (1 = none)
    s = _cf(color.get("saturation"), 0.0, 3.0, 1.0)       # 0..3
    g = _cf(color.get("gamma"), 0.1, 10.0, 1.0)           # 0.1..10 (luminance gamma)
    if abs(b) > 1e-3:
        eq.append(f"brightness={b:.3f}")
    if abs(c - 1.0) > 1e-3:
        eq.append(f"contrast={c:.3f}")
    if abs(s - 1.0) > 1e-3:
        eq.append(f"saturation={s:.3f}")
    if abs(g - 1.0) > 1e-3:
        eq.append(f"gamma={g:.3f}")
    if eq:
        out.append("eq=" + ":".join(eq))
    cv = _curves_filter(color.get("curves"))              # Lumetri RGB curves
    if cv:
        out.append(cv)
    wb = _wheels_filter(color)                            # Lumetri color wheels (lift/gamma/gain)
    if wb:
        out.append(wb)
    sc = _selective_filter(color.get("selective"))        # Lumetri HSL Secondary (selective color)
    if sc:
        out.append(sc)
    temp = color.get("temperature")
    if temp:                                              # Kelvin white-balance shift
        out.append(f"colortemperature=temperature={max(1000, min(40000, int(temp)))}")
    if lut_name:                                          # Lumetri Creative LUT (.cube)
        out.append(f"lut3d={lut_name}")
    grain = _cf(color.get("grain"), 0.0, 60.0, 0.0)       # film grain strength
    if grain > 0:
        out.append(f"noise=alls={int(grain)}:allf=t")
    return out


# ── Premiere-style per-clip effect stack ──────────────────────────────────────
# Each effect is a single-input ffmpeg filter so it slots into the clip's linear
# video chain (Premiere's "Effects" panel: Blur & Sharpen / Stylize / Distort /
# Image Control). The stack is applied in order, after the color grade.
EFFECTS = ("gaussian_blur", "box_blur", "sharpen", "vignette", "hflip", "vflip",
           "invert", "grayscale", "sepia", "hue", "vibrance", "pixelate",
           "edges", "noise")


def _cf(v: Any, lo: float, hi: float, default: float) -> float:
    """Clamp an externally-supplied effect param to a safe range (bad input → default)."""
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


def _one_effect(eff: Any, w: int, h: int) -> Optional[str]:
    """One effect dict → an ffmpeg filter string (or None if unknown/malformed)."""
    if not isinstance(eff, dict):
        return None
    t = eff.get("type")
    if t == "gaussian_blur":
        return f"gblur=sigma={_cf(eff.get('amount'), 0.1, 100, 8):.3f}"
    if t == "box_blur":
        return f"boxblur={int(_cf(eff.get('amount'), 1, 50, 4))}:1"
    if t == "sharpen":
        return f"unsharp=5:5:{_cf(eff.get('amount'), 0.0, 5.0, 1.0):.3f}:5:5:0.0"
    if t == "vignette":                               # smaller angle = stronger darkening
        return f"vignette=angle={_cf(eff.get('angle'), 0.05, 1.5, 0.628):.4f}"
    if t == "hflip":
        return "hflip"
    if t == "vflip":
        return "vflip"
    if t == "invert":
        return "negate"
    if t == "grayscale":
        return "hue=s=0"
    if t == "sepia":                                  # classic sepia color matrix
        return "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0"
    if t == "hue":
        return f"hue=h={_cf(eff.get('degrees'), -360, 360, 30):.1f}"
    if t == "vibrance":
        return f"vibrance=intensity={_cf(eff.get('amount'), -2.0, 2.0, 0.3):.3f}"
    if t == "pixelate":                               # downscale→upscale nearest (mosaic)
        n = int(_cf(eff.get("size"), 2, 128, 16))
        return f"scale=iw/{n}:ih/{n}:flags=neighbor,scale={w}:{h}:flags=neighbor"
    if t == "edges":
        return "edgedetect=mode=colormix:high=0.4"
    if t == "noise":
        return f"noise=alls={int(_cf(eff.get('amount'), 1, 100, 20))}:allf=t"
    return None


def _effect_filters(effects: Any, w: int, h: int) -> list[str]:
    """Compile a clip's FX stack to an ordered list of ffmpeg filter strings (linear,
    single-input effects only — region/mask effects are handled separately via a subgraph)."""
    if not isinstance(effects, list):
        return []
    return [f for f in (_one_effect(e, w, h) for e in effects) if f]


# Region/mask effects (Premiere masks): blur or pixelate a rectangular region of the clip —
# face/logo privacy blur. These need a split→crop→process→overlay subgraph (not a linear filter).
REGION_EFFECTS = ("region_blur", "region_pixelate")


def _region_effects(effects: Any) -> list[dict[str, Any]]:
    if not isinstance(effects, list):
        return []
    return [e for e in effects if isinstance(e, dict) and e.get("type") in REGION_EFFECTS]


def _region_subgraph(in_lab: str, out_lab: str, clip: Clip, tl: Timeline,
                     regions: list[dict[str, Any]], n: int) -> list[str]:
    """Blur/pixelate rectangular OR elliptical regions of the clip layer [in_lab] (size =
    its on-canvas box) → [out_lab]. Region {x,y,w,h} are normalized 0..1 of the clip frame;
    shape='ellipse' feathers the processed region to an ellipse (face/logo privacy)."""
    w, h, _x, _y = _px(clip, tl)
    nodes: list[str] = []
    cur = in_lab
    last = len(regions) - 1
    for i, reg in enumerate(regions):
        rx = max(0, min(w - 2, round(_cf(reg.get("x"), 0.0, 1.0, 0.0) * w)))
        ry = max(0, min(h - 2, round(_cf(reg.get("y"), 0.0, 1.0, 0.0) * h)))
        rw = max(2, min(w - rx, round(_cf(reg.get("w"), 0.01, 1.0, 0.3) * w)))
        rh = max(2, min(h - ry, round(_cf(reg.get("h"), 0.01, 1.0, 0.3) * h)))
        if reg.get("type") == "region_pixelate":
            sz = int(_cf(reg.get("amount"), 2, 128, 16))
            proc = (f"crop={rw}:{rh}:{rx}:{ry},scale=iw/{sz}:ih/{sz}:flags=neighbor,"
                    f"scale={rw}:{rh}:flags=neighbor")
        else:
            sigma = _cf(reg.get("amount"), 0.5, 100, 15)
            proc = f"crop={rw}:{rh}:{rx}:{ry},gblur=sigma={sigma:.2f}"
        if reg.get("shape") == "ellipse":                # feather the processed region to an ellipse
            cx, cy = rw / 2.0, rh / 2.0
            proc += (f",format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':"
                     f"a='255*(1-clip((pow((X-{cx:.1f})/{cx:.1f}\\,2)+"
                     f"pow((Y-{cy:.1f})/{cy:.1f}\\,2)-0.85)/0.15,0,1))'")
        out_i = out_lab if i == last else f"rg{n}_{i}"
        b, s, p = f"rb{n}_{i}", f"rs{n}_{i}", f"rp{n}_{i}"
        nodes.append(f"[{cur}]split[{b}][{s}]")
        nodes.append(f"[{s}]{proc}[{p}]")
        nodes.append(f"[{b}][{p}]overlay=x={rx}:y={ry}:format=auto[{out_i}]")
        cur = out_i
    return nodes


def _transition_lead(clip: Clip) -> int:
    tr = clip.transition
    if isinstance(tr, dict) and tr.get("type") in TRANSITIONS:
        return max(0, int(tr.get("duration_frames", 0)))
    return 0


def _px(clip: Clip, tl: Timeline) -> tuple[int, int, int, int]:
    """On-canvas (w, h, x, y) in pixels from the clip's normalized transform."""
    t = clip.transform
    w = max(2, round(t.width * tl.width))
    h = max(2, round(t.height * tl.height))
    x = round(t.center_x * tl.width - w / 2)
    y = round(t.center_y * tl.height - h / 2)
    return w, h, x, y


def _video_chain(in_label: str, out_label: str, clip: Clip, tl: Timeline,
                 lut_name: Optional[str] = None) -> str:
    """Filter chain turning input [in_label] into a positioned, timed [out_label] layer."""
    fps = tl.fps
    w, h, _x, _y = _px(clip, tl)
    lead = _transition_lead(clip)                        # clip starts `lead` frames early
    start_s = max(0, clip.start_frame - lead) / fps      # effective (transition pre-roll) start
    end_s = clip.end_frame / fps
    speed = clip.speed if clip.speed and clip.speed > 0 else 1.0
    parts = [f"scale={w}:{h}:force_original_aspect_ratio=increase",
             f"crop={w}:{h}", "setsar=1"]
    if clip.transform.flip_h:                            # geometric flips (were previously ignored)
        parts.append("hflip")
    if clip.transform.flip_v:
        parts.append("vflip")
    ck = clip.chroma_key                                 # green-screen removal (ShortGPT technique)
    if isinstance(ck, dict) and ck.get("color"):
        sim = float(ck.get("similarity", 0.3))
        blend = float(ck.get("blend", 0.1))
        parts.append(f"chromakey=color={ck['color']}:similarity={sim:.3f}:blend={blend:.3f}")
    parts.extend(_color_filters(clip.color, lut_name))   # Lumetri grade + creative LUT + grain
    parts.extend(_effect_filters(clip.effects, w, h))    # Premiere-style FX stack (blur/sharpen/stylize)
    rot_tr = KF.get_track(clip, "rotation")
    if rot_tr:                                          # animated rotation (expr quoted)
        e = KF.ffmpeg_expr(rot_tr[0], rot_tr[1], 0, start_s, fps)
        parts.append(f"rotate=a='({e})*PI/180':c=none")
    elif abs(clip.transform.rotation) > 0.01:           # static rotation
        parts.append(f"rotate={clip.transform.rotation}*PI/180:c=none")
    # opacity: animated (geq alpha over rgba — r/g/b/a planes) else static via yuva
    op_tr = KF.get_track(clip, "opacity")
    if op_tr:
        e = KF.ffmpeg_expr(op_tr[0], op_tr[1], 0, start_s, fps, var="T")   # geq time var = T
        parts.append("format=rgba")
        parts.append(f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip(({e}),0,1)'")
    else:
        parts.append("format=yuva420p")
        if clip.opacity < 1.0:
            parts.append(f"colorchannelmixer=aa={clip.opacity:.3f}")
    # speed + shift to the clip's (effective) timeline start, in one setpts
    parts.append(f"setpts=(PTS-STARTPTS)/{speed}+{start_s:.4f}/TB")
    tr_type = (clip.transition or {}).get("type", "fade") if lead > 0 else None
    if tr_type in ("fade", "dissolve"):                  # crossfade in over the lead window (alpha)
        parts.append(f"fade=t=in:st={start_s:.4f}:d={lead / fps:.4f}:alpha=1")
    elif clip.fade_in_frames > 0:                         # own fade-in (dip color or alpha)
        parts.append(_fade("in", start_s, clip.fade_in_frames / fps, clip.fade_color))
    if clip.fade_out_frames > 0:
        fo = clip.fade_out_frames / fps
        parts.append(_fade("out", end_s - fo, fo, clip.fade_color))
    return f"[{in_label}]" + ",".join(parts) + f"[{out_label}]"


def _fade(kind: str, st: float, d: float, color: Optional[str]) -> str:
    """A fade-in/out filter. Default (black/transparent) uses an alpha fade so it reveals
    whatever is beneath (a true dip-to-black on the base, a crossfade over lower tracks);
    a named color (e.g. white) dips to/from that solid color (Premiere Dip to White)."""
    c = (color or "black").strip().lower()
    if c in ("black", "", "transparent", "none"):
        return f"fade=t={kind}:st={st:.4f}:d={d:.4f}:alpha=1"
    return f"fade=t={kind}:st={st:.4f}:d={d:.4f}:color={c}"


def _overlay_xy(clip: Clip, tl: Timeline) -> tuple[str, str]:
    """Overlay x/y — animated for a position track or a slide_* transition, else static."""
    w, h, x, y = _px(clip, tl)
    pos = KF.get_track(clip, "position")
    if pos:
        cx = KF.ffmpeg_expr(pos[0], pos[1], 0, clip.start_frame / tl.fps, tl.fps)
        cy = KF.ffmpeg_expr(pos[0], pos[1], 1, clip.start_frame / tl.fps, tl.fps)
        return f"({cx})*{tl.width}-{w}/2", f"({cy})*{tl.height}-{h}/2"
    lead = _transition_lead(clip)
    tr_type = (clip.transition or {}).get("type", "") if lead > 0 else ""
    if tr_type.startswith("slide_"):                     # slide in from off-screen over the lead
        t0 = max(0, clip.start_frame - lead) / tl.fps
        t1 = clip.start_frame / tl.fps
        frac = f"clip((t-{t0:.4f})/{max(1e-6, t1 - t0):.4f},0,1)"
        off = {"slide_left": (f"{tl.width}-({tl.width}+{x})*({frac})", str(y)),
               "slide_right": (f"-{w}+({x}+{w})*({frac})", str(y)),
               "slide_up": (str(x), f"{tl.height}-({tl.height}+{y})*({frac})"),
               "slide_down": (str(x), f"-{h}+({y}+{h})*({frac})")}
        return off.get(tr_type, (str(x), str(y)))
    return str(x), str(y)


# ── Premiere Essential-Sound audio FX stack ───────────────────────────────────
# Per-clip audio effects (Premiere's Essential Sound panel: Loudness / Repair /
# Clarity / EQ / Dynamics). Each is a single ffmpeg audio filter applied in order.
AUDIO_FX = ("gain", "normalize", "denoise", "highpass", "lowpass", "bass", "treble",
            "eq", "compressor", "limiter", "deesser", "reverb")


def _one_audio_effect(eff: Any) -> Optional[str]:
    """One audio-effect dict → an ffmpeg audio filter string (or None if unknown)."""
    if not isinstance(eff, dict):
        return None
    t = eff.get("type")
    if t == "gain":                                   # Premiere "Gain" (dB)
        return f"volume={_cf(eff.get('db'), -60, 30, 0):.2f}dB"
    if t == "normalize":                              # loudness auto-match (target LUFS)
        return f"loudnorm=I={_cf(eff.get('target_lufs'), -40, -5, -14):.1f}:TP=-1.5:LRA=11"
    if t == "denoise":                                # FFT noise reduction (Repair)
        return f"afftdn=nr={_cf(eff.get('amount'), 0.01, 97, 12):.2f}"
    if t == "highpass":                               # remove rumble
        return f"highpass=f={int(_cf(eff.get('freq'), 20, 2000, 90))}"
    if t == "lowpass":
        return f"lowpass=f={int(_cf(eff.get('freq'), 2000, 20000, 16000))}"
    if t == "bass":
        return f"bass=g={_cf(eff.get('db'), -20, 20, 0):.2f}"
    if t == "treble":
        return f"treble=g={_cf(eff.get('db'), -20, 20, 0):.2f}"
    if t == "eq":                                     # 3-band shelf/peak EQ (dB)
        low = _cf(eff.get("low"), -20, 20, 0)
        mid = _cf(eff.get("mid"), -20, 20, 0)
        high = _cf(eff.get("high"), -20, 20, 0)
        return (f"bass=g={low:.2f}:f=110,equalizer=f=1200:t=q:w=1.0:g={mid:.2f},"
                f"treble=g={high:.2f}:f=10000")
    if t == "compressor":                             # Dynamics (threshold dB, ratio)
        return (f"acompressor=threshold={_cf(eff.get('threshold'), -60, 0, -18):.1f}dB:"
                f"ratio={_cf(eff.get('ratio'), 1, 20, 3):.1f}")
    if t == "limiter":                                # Hard Limiter
        return f"alimiter=limit={_cf(eff.get('limit'), 0.05, 1.0, 0.95):.3f}"
    if t == "deesser":                                # tame sibilance
        return "deesser"
    if t == "reverb":                                 # simple room reverb
        amt = _cf(eff.get("amount"), 0.0, 1.0, 0.3)
        return f"aecho=0.8:0.88:{int(40 + amt * 80)}:{amt:.3f}"
    return None


def _audio_effect_filters(fx: Any) -> list[str]:
    """Compile a clip's audio-FX stack to an ordered list of ffmpeg audio filters."""
    if not isinstance(fx, list):
        return []
    return [f for f in (_one_audio_effect(e) for e in fx) if f]


def _adjustment_node(cur: str, nxt: str, clip: Clip, tl: Timeline,
                     lut_name: Optional[str] = None) -> str:
    """A Premiere **adjustment layer**: apply the clip's color grade + FX stack + LUT to the
    whole running composite [cur] beneath it, gated to the layer's time window via each
    filter's `enable` (so it affects clips below it only while it's on the timeline) → [nxt]."""
    fps = tl.fps
    s, e = clip.start_frame / fps, clip.end_frame / fps
    filt = _color_filters(clip.color, lut_name) + _effect_filters(clip.effects, tl.width, tl.height)
    if not filt:
        return f"[{cur}]null[{nxt}]"                      # nothing to apply → passthrough
    win = f"enable='between(t,{s:.4f},{e:.4f})'"         # single-quoted (protects the commas)
    gated = ",".join(f"{f}:{win}" for f in filt)
    return f"[{cur}]{gated}[{nxt}]"


def _composite_nodes(cur: str, vlab: str, nxt: str, clip: Clip, tl: Timeline, n: int) -> list[str]:
    """Filter node(s) compositing clip layer [vlab] onto the running base [cur] → [nxt].

    Normal clips: a single positioned `overlay` (alpha = opacity/fades/chroma) with an
    `enable` window. Clips with a Premiere `blend_mode` use an alpha-aware blend: position
    the layer on a transparent full canvas, blend its RGB with the base in the chosen mode,
    then re-composite the blended result over the base through the layer's own alpha — so
    fades, partial opacity and the time window all still apply."""
    fps = tl.fps
    s = max(0, clip.start_frame - _transition_lead(clip)) / fps
    e = clip.end_frame / fps
    bm = _blend_mode(clip)
    if not bm:
        ox, oy = _overlay_xy(clip, tl)
        return [f"[{cur}][{vlab}]overlay=x='{ox}':y='{oy}':"
                f"enable='between(t,{s:.4f},{e:.4f})'[{nxt}]"]
    W, H = tl.width, tl.height
    _w, _h, x, y = _px(clip, tl)
    return [
        f"color=c=black@0:s={W}x{H}:r={fps},format=rgba[bg{n}]",
        f"[{vlab}]format=rgba[vr{n}]",
        f"[bg{n}][vr{n}]overlay=x={x}:y={y}:format=auto[tf{n}]",   # full-canvas top, alpha kept
        f"[tf{n}]split[tfa{n}][tfb{n}]",
        f"[tfa{n}]alphaextract[ta{n}]",                            # the layer's alpha mask
        f"[{cur}]split[cb{n}][cc{n}]",                             # base → blend branch + composite branch
        f"[cb{n}]format=gbrp[cbr{n}]",                            # both operands forced to planar RGB so
        f"[tfb{n}]format=gbrp[tfr{n}]",                           # `blend` runs in RGB (not YUV → no hue shift)
        f"[cbr{n}][tfr{n}]blend=all_mode={bm}[bl{n}]",           # base ⊗ top (RGB blend)
        f"[bl{n}][ta{n}]alphamerge[bla{n}]",                      # blended RGB gets the layer's alpha
        f"[cc{n}][bla{n}]overlay=enable='between(t,{s:.4f},{e:.4f})'[{nxt}]",
    ]


def _atempo_chain(speed: float) -> list[str]:
    """atempo only accepts 0.5–2.0 per instance; chain factors to reach any speed so
    audio stays in sync with the (uncapped) video speed."""
    factors: list[float] = []
    s = speed
    while s > 2.0:
        factors.append(2.0)
        s /= 2.0
    while s < 0.5:
        factors.append(0.5)
        s /= 0.5
    factors.append(s)
    return [f"atempo={f:.4f}" for f in factors]


def _audio_chain(in_label: str, out_label: str, clip: Clip, tl: Timeline) -> str:
    fps = tl.fps
    start_ms = round(clip.start_frame / fps * 1000)
    speed = clip.speed if clip.speed and clip.speed > 0 else 1.0
    parts = ["asetpts=PTS-STARTPTS"]
    if abs(speed - 1.0) > 0.001:
        parts.extend(_atempo_chain(speed))
    vol_tr = KF.get_track(clip, "volume")
    if vol_tr:                                          # animated volume (eval per frame)
        e = KF.ffmpeg_expr(vol_tr[0], vol_tr[1], 0, clip.start_frame / fps, fps)
        parts.append(f"volume=volume='clip(({e}),0,4)':eval=frame")
    elif clip.volume != 1.0:
        parts.append(f"volume={clip.volume:.3f}")
    parts.extend(_audio_effect_filters(clip.audio_fx))   # Essential-Sound audio FX stack
    if start_ms > 0:
        parts.append(f"adelay={start_ms}|{start_ms}")
    return f"[{in_label}]" + ",".join(parts) + f"[{out_label}]"


def _amix_into(labels: list[str], name: str, nodes: list[str]) -> str:
    """Mix one-or-more bare labels into a single bus; returns its label (no node if 1)."""
    if len(labels) == 1:
        return labels[0]
    nodes.append("".join(f"[{l}]" for l in labels)
                 + f"amix=inputs={len(labels)}:normalize=0[{name}]")
    return name


def _audio_mix_nodes(entries: list[tuple[int, str]], tl: Timeline) -> tuple[list[str], Optional[str]]:
    """Build the final audio-mix filter nodes for per-clip audio labels (each tagged with its
    track index). With `tl.auto_duck`, the music track is sidechain-compressed by the voice
    track (ducks under the VO); otherwise a plain amix. Returns (nodes, out_label)."""
    if not entries:
        return [], None
    duck = tl.auto_duck if isinstance(getattr(tl, "auto_duck", None), dict) else None
    if duck:
        v_t, m_t = duck.get("voice_track"), duck.get("music_track")
        voice = [lab for (t, lab) in entries if t == v_t]
        music = [lab for (t, lab) in entries if t == m_t]
        other = [lab for (t, lab) in entries if t != v_t and t != m_t]
        if voice and music and v_t != m_t:
            nodes: list[str] = []
            vmix = _amix_into(voice, "vmix", nodes)
            mmix = _amix_into(music, "mmix", nodes)
            nodes.append(f"[{vmix}]asplit[vkey][avoice]")        # voice → sidechain key + final
            thr = float(duck.get("threshold", 0.03))
            ratio = float(duck.get("ratio", 8.0))
            rel = int(duck.get("release_ms", 250))
            nodes.append(f"[{mmix}][vkey]sidechaincompress=threshold={thr:.4f}:"
                         f"ratio={ratio:.2f}:attack=20:release={rel}[ducked]")
            finals = ["avoice", "ducked", *other]
            nodes.append("".join(f"[{l}]" for l in finals)
                         + f"amix=inputs={len(finals)}:normalize=0[aout]")
            return nodes, "aout"
    nodes = []
    out = _amix_into([lab for (_t, lab) in entries], "aout", nodes)
    if not nodes:                                            # single label → wrap so it's mappable
        nodes.append(f"[{out}]anull[aout]")
        out = "aout"
    return nodes, out


def _drawtext(clip: Clip, tl: Timeline, workdir: Path, idx: int) -> Optional[str]:
    """Bake a text clip via drawtext (textfile referenced by bare name; cwd=workdir)."""
    from ..generate.assemble import _font
    font = _font()
    if not font or not (clip.text_content or "").strip():
        return None
    try:
        shutil.copyfile(font, workdir / "font.ttf")
        (workdir / f"etext_{idx}.txt").write_text(clip.text_content, encoding="utf-8")
    except OSError:
        return None
    from .timeline import TextStyle
    st = clip.text_style or TextStyle()
    size = round(st.font_size)
    color = st.color.lstrip("#")
    _w, _h, x, y = _px(clip, tl)
    start_s = clip.start_frame / tl.fps
    end_s = clip.end_frame / tl.fps
    parts = ["fontfile=font.ttf", f"textfile=etext_{idx}.txt", f"fontcolor=0x{color}",
             f"fontsize={size}", "x=(w-text_w)/2", f"y={y}"]
    bw = int(getattr(st, "border_width", 6))
    if bw > 0:                                            # stroke
        parts += [f"borderw={bw}", f"bordercolor=0x{st.border_color.lstrip('#')}"]
    if getattr(st, "box", False):                        # Essential-Graphics background box
        parts += ["box=1", f"boxcolor=0x{st.box_color.lstrip('#')}@{max(0.0, min(1.0, st.box_opacity)):.2f}",
                  f"boxborderw={int(st.box_border)}"]
    if getattr(st, "shadow", False):                     # drop shadow
        parts += [f"shadowcolor=0x{st.shadow_color.lstrip('#')}",
                  f"shadowx={int(st.shadow_x)}", f"shadowy={int(st.shadow_y)}"]
    parts.append(f"enable='between(t,{start_s:.4f},{end_s:.4f})'")
    return "drawtext=" + ":".join(parts)


def _shape_chain(out_lab: str, clip: Clip, tl: Timeline) -> str:
    """Essential-Graphics shape clip → a positioned colored layer (a `color` source filter,
    no input). rect = solid box; ellipse = the box with an elliptical alpha mask. Carries
    opacity + fades + an `enable` window comes from the compositor."""
    fps = tl.fps
    w, h, _x, _y = _px(clip, tl)
    shp = clip.shape if isinstance(clip.shape, dict) else {}
    fill = (shp.get("fill") or "#FFFFFF").lstrip("#")
    start_s = clip.start_frame / fps
    end_s = clip.end_frame / fps
    dur = max(0.1, clip.duration_frames / fps)
    parts = [f"color=c=0x{fill}:s={w}x{h}:r={fps}:d={dur:.3f}", "format=rgba", "setsar=1"]
    if shp.get("type") == "ellipse":                     # elliptical alpha mask (feathered edge)
        cx, cy = w / 2.0, h / 2.0
        parts.append(f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':"
                     f"a='255*(1-clip((pow((X-{cx:.1f})/{cx:.1f}\\,2)+pow((Y-{cy:.1f})/{cy:.1f}\\,2)-0.92)/0.08,0,1))'")
    if clip.opacity < 1.0:
        parts.append(f"colorchannelmixer=aa={clip.opacity:.3f}")
    parts.append(f"setpts=PTS-STARTPTS+{start_s:.4f}/TB")
    if clip.fade_in_frames > 0:
        parts.append(_fade("in", start_s, clip.fade_in_frames / fps, clip.fade_color))
    if clip.fade_out_frames > 0:
        fo = clip.fade_out_frames / fps
        parts.append(_fade("out", end_s - fo, fo, clip.fade_color))
    return ",".join(parts) + f"[{out_lab}]"


def _matte_nodes(fill: Clip, vlab: str, out_lab: str, tl: Timeline, midx: int) -> list[str]:
    """Track Matte Key: mask the fill layer [vlab] by matte input [midx:v] (scaled to the
    fill's box). Luma matte → the matte's brightness becomes the fill's alpha; alpha matte →
    the matte's alpha; `invert` flips it. → [out_lab]."""
    w, h, _x, _y = _px(fill, tl)
    tm = fill.track_matte or {}
    parts = [f"scale={w}:{h}:force_original_aspect_ratio=increase", f"crop={w}:{h}", "setsar=1"]
    parts.append("alphaextract" if tm.get("type") == "alpha" else "format=gray")
    if tm.get("invert"):
        parts.append("negate")
    mask = f"mtk{midx}"
    return [f"[{midx}:v]" + ",".join(parts) + f"[{mask}]",
            f"[{vlab}][{mask}]alphamerge[{out_lab}]"]


# Export presets — palmier H.264 / H.265 / ProRes parity.
_CODECS = {
    "h264": (["-c:v", "libx264", "-pix_fmt", "yuv420p"], "mp4"),
    "hevc": (["-c:v", "libx265", "-tag:v", "hvc1", "-pix_fmt", "yuv420p"], "mp4"),
    "prores": (["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"], "mov"),
}


def render_timeline(tl: Timeline, out: str,
                    resolve: Optional[Callable[[str], str]] = None,
                    codec: str = "h264") -> Optional[str]:
    """Render the timeline to `out`. `resolve` maps a clip.media_ref → a local file
    path (default: the media_ref IS the path). `codec` ∈ h264|hevc|prores. Returns the
    path or None."""
    resolve = resolve or (lambda ref: ref)
    fps, W, H = tl.fps, tl.width, tl.height
    total_s = max(tl.total_frames() / fps, 0.1)
    out_p = Path(out).resolve()
    workdir = out_p.parent
    workdir.mkdir(parents=True, exist_ok=True)

    visual = [(t_i, c) for t_i, t in enumerate(tl.tracks) if not t.hidden
              for c in t.clips if c.media_type in _VISUAL or c.media_type in ("adjustment", "shape")]
    visual.sort(key=lambda tc: (tc[0], tc[1].start_frame))      # track order = stack order
    clip_by_id = {c.id: c for t in tl.tracks for c in t.clips}  # for resolving track mattes
    matte_ids = {c.track_matte["matte_id"] for (_t, c) in visual
                 if isinstance(c.track_matte, dict) and c.track_matte.get("matte_id")}
    visual = [(t_i, c) for (t_i, c) in visual if c.id not in matte_ids]  # mattes are consumed, not shown
    texts = [c for t in tl.tracks if not t.hidden for c in t.clips if c.media_type == "text"]
    audio_clips = [(t_i, c) for t_i, t in enumerate(tl.tracks) if not t.muted
                   for c in t.clips if c.media_type in ("video", "audio")]

    inputs: list[str] = []
    filters: list[str] = []
    input_idx = 0

    # base canvas
    inputs += ["-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={fps}:d={total_s:.3f}"]
    base_idx = input_idx
    input_idx += 1
    filters.append(f"[{base_idx}:v]format=yuva420p[base0]")

    # one input per visual clip + its video chain + overlay onto the running base
    cur = "base0"
    for n, (_t_i, clip) in enumerate(visual):
        if clip.media_type == "adjustment":              # grades the composite below it (no input)
            lut_name = None
            if isinstance(clip.color, dict) and clip.color.get("lut"):
                from .lut import resolve_lut
                lut_name = resolve_lut(clip.color["lut"], str(workdir), n, resolve)
            nxt = f"b{n + 1}"
            filters.append(_adjustment_node(cur, nxt, clip, tl, lut_name))
            cur = nxt
            continue
        if clip.media_type == "shape":                   # Essential-Graphics shape (no input)
            shplab = f"shp{n}"
            filters.append(_shape_chain(shplab, clip, tl))
            nxt = f"b{n + 1}"
            filters.extend(_composite_nodes(cur, shplab, nxt, clip, tl, n))
            cur = nxt
            continue
        path = str(Path(resolve(clip.media_ref)).resolve())
        lead = _transition_lead(clip)                    # transition pre-roll (overlaps prev clip)
        eff_start = max(0, clip.start_frame - lead)
        span = clip.duration_frames + (clip.start_frame - eff_start)
        dur_src = (span / fps) * (clip.speed if clip.speed > 0 else 1.0)
        if clip.media_type == "image":
            inputs += ["-loop", "1", "-t", f"{span / fps:.3f}", "-i", path]
        else:
            src_ss = max(0, clip.trim_start_frame - lead) / fps
            inputs += ["-ss", f"{src_ss:.3f}", "-t", f"{dur_src:.3f}", "-i", path]
        lut_name = None                                  # resolve a Creative LUT into the workdir
        if isinstance(clip.color, dict) and clip.color.get("lut"):
            from .lut import resolve_lut
            lut_name = resolve_lut(clip.color["lut"], str(workdir), n, resolve)
        vlab = f"v{input_idx}"
        filters.append(_video_chain(f"{input_idx}:v", vlab, clip, tl, lut_name=lut_name))
        comp_lab = vlab
        regions = _region_effects(clip.effects)          # blur/pixelate a region (face/logo mask)
        if regions:
            rlab = f"vrg{n}"
            filters.extend(_region_subgraph(vlab, rlab, clip, tl, regions, n))
            comp_lab = rlab
        extra = 0                                        # Track Matte Key (mask by another clip)
        tm = clip.track_matte
        mclip = clip_by_id.get(tm.get("matte_id")) if isinstance(tm, dict) else None
        if mclip is not None and mclip.media_type in ("video", "image") and mclip.media_ref:
            midx = input_idx + 1
            mpath = str(Path(resolve(mclip.media_ref)).resolve())
            mdur = clip.duration_frames / fps            # play the matte across the fill's duration
            if mclip.media_type == "image":
                inputs += ["-loop", "1", "-t", f"{mdur:.3f}", "-i", mpath]
            else:
                inputs += ["-ss", f"{mclip.trim_start_frame / fps:.3f}", "-t", f"{mdur:.3f}", "-i", mpath]
            mlab = f"vmt{n}"
            filters.extend(_matte_nodes(clip, comp_lab, mlab, tl, midx))
            comp_lab = mlab
            extra = 1
        nxt = f"b{n + 1}"
        filters.extend(_composite_nodes(cur, comp_lab, nxt, clip, tl, n))   # overlay or blend-mode
        cur = nxt
        input_idx += 1 + extra

    # audio inputs + chains (each tagged with its track index for auto-duck grouping)
    audio_entries: list[tuple[int, str]] = []
    for (t_i, clip) in audio_clips:
        path = str(Path(resolve(clip.media_ref)).resolve())
        dur_src = (clip.duration_frames / fps) * (clip.speed if clip.speed > 0 else 1.0)
        try:
            from ..media.signals import probe
            if clip.media_type == "video" and not probe(path).has_audio:
                continue
        except Exception:  # noqa: BLE001
            pass
        inputs += ["-ss", f"{clip.trim_start_frame / fps:.3f}", "-t", f"{dur_src:.3f}", "-i", path]
        alab = f"a{input_idx}"
        filters.append(_audio_chain(f"{input_idx}:a", alab, clip, tl))
        audio_entries.append((t_i, alab))
        input_idx += 1

    # bake text on top of the composite
    vout = cur
    dt = [d for d in (_drawtext(c, tl, workdir, i) for i, c in enumerate(texts)) if d]
    if dt:
        filters.append(f"[{cur}]" + ",".join(dt) + "[vtext]")
        vout = "vtext"
    filters.append(f"[{vout}]format=yuv420p[vout]")

    vcodec, ext = _CODECS.get(codec, _CODECS["h264"])
    tmp_name = f"render_out.{ext}"
    args = inputs + ["-filter_complex", ";".join(filters), "-map", "[vout]"]
    mix_nodes, aout = _audio_mix_nodes(audio_entries, tl)
    if aout:
        args[-3] = ";".join(filters + mix_nodes)  # rebuild filter_complex with the audio mix
        args += ["-map", f"[{aout}]", "-c:a", "aac"]
    args += ["-r", str(fps), *vcodec, "-t", f"{total_s:.3f}"]
    if ext == "mp4":
        args += ["-movflags", "+faststart"]
    args += ["-y", tmp_name]
    r = run_ffmpeg(args, cwd=str(workdir))
    final = workdir / tmp_name
    if r.returncode != 0 or not final.exists():
        return None
    shutil.move(str(final), str(out_p))
    return out
