"""Turn the brain's highlight candidates into a clean short-form clip plan.

The understanding stage gives Claude's `highlight_candidates` (each with a score +
reasons). This module refines them into the spans we actually cut: enforce
short-form duration bounds, drop overlaps (greedy by score), and cap to the best
few — so the engine clips the strongest, non-redundant moments. Pure + stdlib,
unit-tested without media.
"""
from __future__ import annotations

from typing import Any, Optional


def _overlaps(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


def signal_highlights(signals: dict[str, Any], duration: float, target_s: float = 32.0,
                      stride_s: float = 12.0, min_s: float = 15.0) -> list[dict[str, Any]]:
    """Deterministic highlight candidates from cheap ffmpeg signals — NO Claude key
    needed. Slides a target-length window across the video and scores each by
    speech density (fraction not silent), nudged up when it starts near a scene
    change. Feed the result through `plan_highlights` to rank/dedupe/cap. Lets the
    Section-A clipper pick decent moments for free instead of just the first span.
    """
    if not duration or duration <= 0:
        return []
    sils: list[tuple[float, float]] = []
    for s in signals.get("silences") or []:
        try:
            a = float(s.get("start", 0.0))
            b = s.get("end", -1.0)
            b = float(duration) if (b is None or float(b) < 0) else float(b)
        except (TypeError, ValueError):
            continue
        if b > a:
            sils.append((a, b))
    cuts = sorted(float(c) for c in (signals.get("scene_cuts") or []) if _is_num(c))

    def silent_in(w0: float, w1: float) -> float:
        tot = 0.0
        for a, b in sils:
            lo, hi = max(a, w0), min(b, w1)
            if hi > lo:
                tot += hi - lo
        return tot

    def near_cut(t: float, tol: float = 1.5) -> bool:
        return any(abs(c - t) <= tol for c in cuts)

    target = min(target_s, float(duration))
    out: list[dict[str, Any]] = []
    t = 0.0
    while t < duration - min(min_s, duration * 0.5) + 1e-3:
        w0, w1 = t, min(t + target, float(duration))
        wl = w1 - w0
        if wl < min_s and t > 0:
            break
        density = 1.0 - (silent_in(w0, w1) / wl if wl > 0 else 0.0)
        score = max(0.0, min(1.0, density))
        reasons = [f"speech density {int(round(density * 100))}%"]
        if near_cut(w0):
            score = min(1.0, score + 0.05)
            reasons.append("starts near a scene change")
        out.append({"start": round(w0, 3), "end": round(w1, 3),
                    "score": round(score, 4), "reasons": reasons})
        t += stride_s
    return out


def _is_num(x: Any) -> bool:
    try:
        float(x)
        return True
    except (TypeError, ValueError):
        return False


def plan_highlights(candidates: list[dict[str, Any]], duration: Optional[float] = None,
                    min_s: float = 15.0, max_s: float = 60.0, top_n: int = 3) -> list[dict[str, Any]]:
    """Refine raw candidates → at most `top_n` non-overlapping, duration-bounded,
    chronologically-ordered highlight spans. Each result carries score, reasons,
    and duration."""
    norm: list[dict[str, Any]] = []
    for c in candidates or []:
        try:
            s = max(0.0, float(c.get("start", 0.0)))
            e = float(c.get("end", s))
        except (TypeError, ValueError):
            continue
        if e <= s:
            continue
        try:
            score = float(c.get("score", 0.0) or 0.0)
        except (TypeError, ValueError):
            score = 0.0
        reasons = list(c.get("reasons") or [])

        # Enforce short-form duration bounds.
        dur = e - s
        if dur > max_s:
            e = s + max_s
        elif dur < min_s:
            e = s + min_s
        # Clamp to the source; if clamping shortened it past the floor, slide start back.
        if duration:
            d = float(duration)
            if e > d:
                e = d
                if e - s < min_s:
                    s = max(0.0, e - min_s)
        if e - s < 1.0:
            continue
        norm.append({"start": round(s, 3), "end": round(e, 3),
                     "score": round(score, 4), "reasons": reasons})

    # Greedy: highest score first, skip anything overlapping an already-picked span.
    norm.sort(key=lambda x: (-x["score"], x["start"]))
    picked: list[dict[str, Any]] = []
    for sp in norm:
        if all(not _overlaps(sp, p) for p in picked):
            picked.append(sp)
        if len(picked) >= top_n:
            break

    picked.sort(key=lambda x: x["start"])
    for p in picked:
        p["duration"] = round(p["end"] - p["start"], 3)
    return picked
