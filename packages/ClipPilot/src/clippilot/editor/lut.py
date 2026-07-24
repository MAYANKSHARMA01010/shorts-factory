"""3D LUT (.cube) support — Premiere Lumetri "Creative → Look" / the LUT dropdown.

A clip's `color.lut` may be either a path to a user-supplied `.cube` file OR the name of
a **built-in look** (a small per-pixel RGB transform baked into an identity LUT grid).
`render` resolves it into the workdir and references it by a bare filename (ffmpeg runs
with cwd=workdir) so Windows drive-letter paths never reach the filtergraph — the same
proven pattern used for fonts/subtitles.
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Callable, Optional


def _clip01(x: float) -> float:
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


# Built-in looks: (r,g,b in 0..1) → graded (r,g,b). Kept simple/portable (no numpy).
def _warm(r: float, g: float, b: float) -> tuple[float, float, float]:
    return _clip01(r * 1.06 + 0.02), _clip01(g * 1.01), _clip01(b * 0.94)


def _cool(r: float, g: float, b: float) -> tuple[float, float, float]:
    return _clip01(r * 0.94), _clip01(g * 1.0 + 0.01), _clip01(b * 1.06 + 0.02)


def _teal_orange(r: float, g: float, b: float) -> tuple[float, float, float]:
    luma = 0.299 * r + 0.587 * g + 0.114 * b      # push highlights orange, shadows teal
    hi, sh = luma, 1.0 - luma
    return (_clip01(r + hi * 0.10 - sh * 0.06),
            _clip01(g + hi * 0.04 + sh * 0.03),
            _clip01(b - hi * 0.10 + sh * 0.10))


def _vintage(r: float, g: float, b: float) -> tuple[float, float, float]:
    return _clip01(r * 0.85 + 0.06), _clip01(g * 0.85 + 0.05), _clip01(b * 0.82 + 0.07)


def _bw(r: float, g: float, b: float) -> tuple[float, float, float]:
    y = 0.299 * r + 0.587 * g + 0.114 * b
    return _clip01(y), _clip01(y), _clip01(y)


BUILTIN_LOOKS: dict[str, Callable[[float, float, float], tuple[float, float, float]]] = {
    "warm": _warm, "cool": _cool, "teal_orange": _teal_orange,
    "vintage": _vintage, "bw": _bw,
}


def generate_cube(look: str, path: str, size: int = 17) -> Optional[str]:
    """Write a `size³` .cube 3D LUT for a built-in look (red index changes fastest, per
    the .cube spec). Returns the path, or None for an unknown look."""
    fn = BUILTIN_LOOKS.get(str(look).lower())
    if not fn:
        return None
    d = size - 1
    lines = [f"LUT_3D_SIZE {size}", ""]
    for bi in range(size):
        for gi in range(size):
            for ri in range(size):
                r, g, b = fn(ri / d, gi / d, bi / d)
                lines.append(f"{r:.5f} {g:.5f} {b:.5f}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def resolve_lut(ref: str, workdir: str, idx: int,
                resolve: Optional[Callable[[str], str]] = None) -> Optional[str]:
    """Resolve a clip's `color.lut` ref into a bare .cube filename inside `workdir`:
    a built-in look name is generated; a path to an existing .cube is copied. Returns the
    bare name (for `lut3d=<name>` with cwd=workdir), or None if it's neither."""
    if not isinstance(ref, str) or not ref.strip():
        return None
    name = f"lut_{idx}.cube"
    dest = Path(workdir) / name
    if ref.lower() in BUILTIN_LOOKS:
        return name if generate_cube(ref, str(dest)) else None
    src = Path((resolve or (lambda x: x))(ref))
    if src.exists() and src.suffix.lower() == ".cube":
        try:
            shutil.copyfile(src, dest)
            return name
        except OSError:
            return None
    return None
