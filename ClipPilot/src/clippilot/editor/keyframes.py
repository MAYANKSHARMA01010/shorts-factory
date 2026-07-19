"""Keyframe animation for the timeline editor — palmier-pro `setKeyframes` parity.

A clip carries `keyframes: {property: {interp, keys}}` where `keys` is a list of rows
`[clip_local_frame, *values]` (palmier's row shapes). Properties:
  opacity/volume/rotation → [frame, v]      position/scale → [frame, a, b]
  crop                    → [frame, t,r,b,l]
Interpolation: linear · hold (step) · smooth (smoothstep). This module SAMPLES a track
(pure) and COMPILES a track into an ffmpeg `t`-expression so `render.py` can animate
overlay x/y, alpha, rotation and volume over time.
"""
from __future__ import annotations

from typing import Any

INTERP = ("linear", "hold", "smooth", "spring", "ease_in", "ease_out", "ease_in_out",
          "there_and_back", "rush_into", "overshoot")


def _smoothstep(p: float) -> float:
    return p * p * (3 - 2 * p)


# manim rate_functions (normalized p∈[0,1] → eased). there_and_back/overshoot can exceed [0,1].
_EASING_FUNCS = {
    "ease_in": lambda p: p * p,                          # slow start
    "ease_out": lambda p: 1 - (1 - p) * (1 - p),         # slow end
    "ease_in_out": _smoothstep,
    "there_and_back": lambda p: _smoothstep(2 * p) if p < 0.5 else _smoothstep(2 * (1 - p)),
    "rush_into": lambda p: 2 * _smoothstep(0.5 * p),     # accelerate in
}


def _curve(interp: str, p: float) -> float:
    """Eased fraction for any easing at progress p (linear = identity)."""
    if interp == "smooth":
        return _smoothstep(p)
    if interp == "spring":
        return spring_curve(p)
    if interp == "overshoot":
        return spring_curve(p, damping=8.0, stiffness=130.0)   # softer bounce
    f = _EASING_FUNCS.get(interp)
    return f(p) if f else p


# easings that aren't a simple analytic linear/smooth segment → baked to points in the expr
_BAKED = {"spring", "ease_in", "ease_out", "there_and_back", "rush_into", "overshoot"}
# value-count per animatable property
PROP_ARITY = {"opacity": 1, "volume": 1, "rotation": 1, "position": 2, "scale": 2, "crop": 4}
# Cap how many keyframes reach a single ffmpeg expression — dense GSAP-style fades can
# produce hundreds, blowing up the nested-if() filtergraph (hyperframes' concern).
_MAX_EXPR_KF = 48


def _perp_dist(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    return abs(dy * px - dx * py + bx * ay - by * ax) / ((dx * dx + dy * dy) ** 0.5)


def simplify_rdp(points: list[tuple[float, float]], epsilon: float,
                 max_points: int = _MAX_EXPR_KF) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker polyline simplification (hyperframes technique): drop
    perceptually-redundant (time, value) points, keeping endpoints. Raises epsilon
    until the result fits `max_points` so a dense keyframe list can't overflow ffmpeg."""
    if len(points) <= 2:
        return points
    eps = epsilon
    for _ in range(24):
        out = _rdp(points, eps)
        if len(out) <= max_points:
            return out
        eps *= 1.6
    return out[:: max(1, len(out) // max_points)]


def _rdp(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dmax, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        d = _perp_dist(points[i], a, b)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return _rdp(points[: idx + 1], eps)[:-1] + _rdp(points[idx:], eps)
    return [a, b]


def _norm_keys(keys: list[list[float]]) -> list[list[float]]:
    return sorted([list(map(float, k)) for k in keys if k], key=lambda k: k[0])


def spring_curve(p: float, damping: float = 12.0, stiffness: float = 100.0,
                 mass: float = 1.0) -> float:
    """Normalized spring easing (remotion spring-utils): a damped harmonic oscillator
    eased from 0→1 over normalized progress p∈[0,1] — underdamped springs OVERSHOOT 1
    then settle (the natural 'bounce'). Numerically integrated (cached step count)."""
    if p <= 0:
        return 0.0
    p = min(1.0, p)
    dt = 0.004
    steps = int(p / dt)
    pos, vel = 0.0, 0.0
    for _ in range(steps):
        accel = (-stiffness * (pos - 1.0) - damping * vel) / mass
        vel += accel * dt
        pos += vel * dt
    return pos


def sample(keys: list[list[float]], interp: str, frame: float, idx: int = 0) -> float:
    """Value of column `idx` at clip-local `frame` (held at the ends; interpolated within)."""
    col = idx + 1
    ks = [k for k in _norm_keys(keys) if len(k) > col]   # drop rows missing this column
    if not ks:
        return 0.0
    if frame <= ks[0][0]:
        return ks[0][col]
    if frame >= ks[-1][0]:
        return ks[-1][col]
    for i in range(len(ks) - 1):
        f0, f1 = ks[i][0], ks[i + 1][0]
        if f0 <= frame <= f1:
            v0, v1 = ks[i][col], ks[i + 1][col]
            if f1 == f0 or interp == "hold":
                return v0
            x = _curve(interp, (frame - f0) / (f1 - f0))
            return v0 + (v1 - v0) * x
    return ks[-1][col]


def ffmpeg_expr(keys: list[list[float]], interp: str, idx: int, start_s: float,
                fps: int, var: str = "t") -> str:
    """Compile a track column into a piecewise ffmpeg expression in the time variable
    `var` (timeline seconds). overlay/rotate/volume use `t`; geq uses `T`. Each keyframe
    frame is clip-local; we add `start_s` so it lines up on the timeline."""
    col = idx + 1
    ks = [k for k in _norm_keys(keys) if len(k) > col]   # drop rows missing this column
    if not ks:
        return "0"
    times = [start_s + k[0] / fps for k in ks]
    vals = [k[col] for k in ks]
    if len(ks) == 1:
        return f"{vals[0]:.5f}"
    if interp in _BAKED:                                 # bake the eased curve → RDP → linear
        baked: list[tuple[float, float]] = []
        n = 16
        for i in range(len(ks) - 1):
            f0, f1, v0, v1 = ks[i][0], ks[i + 1][0], ks[i][col], ks[i + 1][col]
            for j in range(n):
                p = j / (n - 1)
                baked.append((start_s + (f0 + p * (f1 - f0)) / fps, v0 + (v1 - v0) * _curve(interp, p)))
        baked = simplify_rdp(baked, 0.004)
        times = [b[0] for b in baked]
        vals = [b[1] for b in baked]
        interp = "linear"
    if len(ks) > _MAX_EXPR_KF:                            # cap dense lists (RDP) → linear
        pts = simplify_rdp(list(zip(times, vals)), epsilon=0.002)
        times = [p[0] for p in pts]
        vals = [p[1] for p in pts]
        interp = "linear"
    expr = f"{vals[-1]:.5f}"                            # value after the last key
    for i in range(len(vals) - 2, -1, -1):              # len(vals): may be < len(ks) after RDP
        t0, t1, v0, v1 = times[i], times[i + 1], vals[i], vals[i + 1]
        if interp == "hold" or t1 == t0:
            seg = f"{v0:.5f}"
        else:
            frac = f"({var}-{t0:.5f})/{t1 - t0:.5f}"
            if interp == "smooth":
                frac = f"({frac})*({frac})*(3-2*({frac}))"
            seg = f"({v0:.5f}+({v1 - v0:.5f})*({frac}))"
        expr = f"if(lt({var},{t1:.5f}),{seg},{expr})"
    return f"if(lt({var},{times[0]:.5f}),{vals[0]:.5f},{expr})"


def get_track(clip: Any, prop: str) -> tuple[list[list[float]], str] | None:
    """Return (keys, interp) for a clip's animated `prop`, or None."""
    kf = getattr(clip, "keyframes", None) or {}
    tr = kf.get(prop)
    if not isinstance(tr, dict) or not tr.get("keys"):
        return None
    return tr["keys"], str(tr.get("interp", "smooth"))
