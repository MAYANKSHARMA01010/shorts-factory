# -*- coding: utf-8 -*-
"""Director creative-brief schema for the "ultimate" <=20s short pipeline.

A brief.json is the single creative-decision artifact the LLM "director" emits
from a transcript. It is a strict superset of the legacy produce_short_zimage.py
spec: instead of three parallel arrays (captions / scene_map / scene_weights) it
carries one ordered list of `beats`, each an on-screen moment with its own visual
type, caption (+ style), and SFX cue.

Lives inside the self-contained skill folder
  <project>/.claude/skills/ultimate-short/
and references the project's shared resources (sound library, etc.) by path.

Pure stdlib (no GPU, no heavy deps). Provides:
  - validate_brief(brief)            -> normalized brief or raises ValueError
  - estimate_seconds(narration)      -> rough spoken length
  - derive_beat_times(beats, dur)    -> [(start, end, beat), ...]
  - resolve_cue(cue)                 -> absolute SFX path (or None)
  - write_styled_ass(...)            -> dynamic, colorful, per-beat captions
  - to_legacy_spec(brief)            -> back-compat spec dict (all-`still` briefs)

Standalone:  python director_brief.py --brief briefs/<slug>.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

PKG = Path(__file__).resolve().parent                 # .../ultimate-short
PROJECT_ROOT = Path(__file__).resolve().parents[3]    # .../Money making
SFX_ROOT = PROJECT_ROOT / "assets" / "sound_effects"

# Hard product rule: every short is <= this many seconds.
HARD_CAP_SECONDS = 20.0
# Leave headroom so caption fades / recut never push past the cap.
SOFT_TARGET_SECONDS = 19.0
# Average speaking rate (words / sec) for the brief-time length estimate.
# Measured: Chatterbox base reads ~4.0 w/s, so ~68 words ≈ 17s (fills the <=20s slot).
WORDS_PER_SEC = 4.0
# Below this the short under-uses its 20s window (advisory, not an error).
MIN_USEFUL_SECONDS = 12.0

VISUAL_TYPES = {"still", "animation", "three_d", "micro_video", "avatar"}
ANIM_ENGINES = {"hyperframes", "remotion", "remotion_r3f"}

# ---------------------------------------------------------------------------
# Semantic SFX cue -> real, license-clean file under assets/sound_effects/.
# Paths verified by the punchy-recut SKILL sound-design catalog. Unknown cues
# resolve to None (caller warns + skips, never crashes).
# ---------------------------------------------------------------------------
CUE_SFX = {
    "riser":          "soundfx-rse/soundfx.d/whoosh2.mp3",   # no true riser in lib; whoosh stand-in
    "whoosh":         "soundfx-rse/soundfx.d/whoosh3.mp3",
    "swoosh":         "soundfx-rse/soundfx.d/whoosh4.mp3",
    "slide":          "soundfx-rse/soundfx.d/slide2.mp3",
    "ui_click":       "soundfx-rse/soundfx.d/click3.mp3",
    "click":          "soundfx-rse/soundfx.d/click6.mp3",
    "beep":           "soundfx-rse/soundfx.d/beep5.mp3",
    "chime":          "soundfx-rse/soundfx.d/chime2.mp3",
    "bling":          "soundfx-rse/soundfx.d/bling3.mp3",
    "success_sting":  "soundfx-rse/soundfx.d/fanfare1.mp3",
    "boom":           "derived/cosmic_boom.wav",
    "impact":         "derived/cosmic_boom.wav",
    "cannon":         "soundfx-rse/soundfx.d/cannon1.mp3",
    "punch":          "soundfx-rse/soundfx.d/punch3.mp3",
    "splash":         "game-sound-effects/Sounds/Splash_Small.wav",
    "water":          "game-sound-effects/Sounds/water_ripples.wav",
    "glass":          "zulubo-sounds/Destruction/Glass/glass_break_00.wav",
    "break":          "zulubo-sounds/Destruction/Glass/glass_break_05.wav",
    "coin":           "game-sound-effects/Sounds/coin.wav",
    "laser":          "game-sound-effects/Sounds/laser_shot.wav",
}


def resolve_cue(cue: Optional[str]) -> Optional[Path]:
    """Map a semantic cue name to an absolute SFX path, or None if unknown/missing."""
    if not cue:
        return None
    rel = CUE_SFX.get(cue.strip().lower())
    if not rel:
        return None
    p = SFX_ROOT / rel
    return p if p.exists() else None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def estimate_seconds(narration: str) -> float:
    words = len(str(narration).split())
    return words / WORDS_PER_SEC if words else 0.0


def validate_brief(brief: dict) -> dict:
    """Validate + normalize a director brief. Raises ValueError on hard problems.

    Returns the (same) brief dict with defaults filled in so the orchestrator can
    rely on every key existing.
    """
    if not isinstance(brief, dict):
        raise ValueError("brief must be a JSON object")

    for key in ("slug", "narration", "beats"):
        if key not in brief:
            raise ValueError(f"brief missing required key: {key!r}")

    slug = str(brief["slug"]).strip()
    if not slug:
        raise ValueError("brief.slug is empty")

    narration = str(brief["narration"]).strip()
    if not narration:
        raise ValueError("brief.narration is empty")

    beats = brief["beats"]
    if not isinstance(beats, list) or not beats:
        raise ValueError("brief.beats must be a non-empty list")

    styles = brief.get("caption_styles", {})
    if not isinstance(styles, dict):
        raise ValueError("brief.caption_styles must be an object")

    for i, b in enumerate(beats):
        if not isinstance(b, dict):
            raise ValueError(f"beat[{i}] must be an object")
        b.setdefault("id", f"b{i}")
        vis = b.get("visual", "still")
        if vis not in VISUAL_TYPES:
            raise ValueError(f"beat[{i}].visual={vis!r} not in {sorted(VISUAL_TYPES)}")
        b["visual"] = vis
        try:
            w = float(b.get("t_weight", 1.0))
        except (TypeError, ValueError):
            raise ValueError(f"beat[{i}].t_weight is not a number")
        if w <= 0:
            raise ValueError(f"beat[{i}].t_weight must be > 0")
        b["t_weight"] = w
        if vis == "still" and not str(b.get("scene_prompt", "")).strip():
            raise ValueError(f"beat[{i}] visual=still requires a scene_prompt")
        cap = b.get("caption")
        if cap is not None:
            if not isinstance(cap, dict) or not str(cap.get("text", "")).strip():
                raise ValueError(f"beat[{i}].caption must have non-empty text")
            cstyle = cap.get("style", "default")
            if cstyle != "default" and cstyle not in styles:
                raise ValueError(
                    f"beat[{i}].caption.style={cstyle!r} not defined in caption_styles")
        anim = b.get("animation")
        if vis == "animation" and isinstance(anim, dict):
            eng = anim.get("engine", "hyperframes")
            if eng not in ANIM_ENGINES:
                raise ValueError(f"beat[{i}].animation.engine={eng!r} not in {sorted(ANIM_ENGINES)}")

    est = estimate_seconds(narration)
    brief["_estimate_seconds"] = round(est, 2)
    if est > HARD_CAP_SECONDS + 4:
        raise ValueError(
            f"narration ~{est:.1f}s is far over the {HARD_CAP_SECONDS:.0f}s cap; "
            f"shorten the script (target <= ~{SOFT_TARGET_SECONDS:.0f}s spoken).")
    if est < MIN_USEFUL_SECONDS:
        print(f"[brief] note: ~{est:.1f}s spoken under-uses the 20s slot — consider ~68 words "
              f"(~17s) so the short fills its window.", flush=True)

    brief.setdefault("brief", {})
    brief.setdefault("style", "")
    brief.setdefault("gen_w", 512)
    brief.setdefault("gen_h", 896)
    brief.setdefault("seed", 7)
    brief.setdefault("caption_styles", {})
    return brief


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------
def derive_beat_times(beats: list, audio_dur: float) -> list:
    """Distribute the (already <=20s) audio duration across beats by t_weight.
    Returns [(start, end, beat_dict), ...] covering [0, audio_dur]."""
    total = sum(float(b["t_weight"]) for b in beats)
    out = []
    t = 0.0
    for i, b in enumerate(beats):
        dur = audio_dur * (float(b["t_weight"]) / total)
        start = t
        end = audio_dur if i == len(beats) - 1 else t + dur
        out.append((start, end, b))
        t = end
    return out


# ---------------------------------------------------------------------------
# Dynamic, colorful captions (ASS) — req #13
# ---------------------------------------------------------------------------
DEFAULT_STYLE = {"size": 92, "color": "#FFFFFF", "highlight": "#FFD23F",
                 "anim": "pop", "y": 1500, "font": "Arial Black"}


def _hex_to_ass(hexcol: str, alpha: str = "00") -> str:
    """#RRGGBB -> ASS &HAABBGGRR (alpha 00 = opaque)."""
    h = str(hexcol).lstrip("#")
    if len(h) != 6:
        h = "FFFFFF"
    rr, gg, bb = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha}{bb}{gg}{rr}".upper()


def _ass_time(seconds: float) -> str:
    cs = max(0, round(seconds * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _anim_tags(anim: str) -> str:
    """Map an animation name to inline ASS override tags (line-relative time, ms).
    Each Dialogue line == one beat, so \\t timings restart per caption."""
    a = (anim or "pop").lower()
    if a == "pop":
        return r"{\fad(70,80)\fscx55\fscy55\t(0,160,\fscx100\fscy100)}"
    if a == "spring":
        return r"{\fad(60,80)\fscx40\fscy40\t(0,150,\fscx113\fscy113)\t(150,250,\fscx100\fscy100)}"
    if a == "pulse":
        return r"{\fad(70,80)\t(0,140,\fscx108\fscy108)\t(140,300,\fscx100\fscy100)}"
    if a == "shake":
        return r"{\fad(50,70)\frz350\t(0,90,\frz0)\t(90,170,\frz358)\t(170,240,\frz0)}"
    if a == "fade":
        return r"{\fad(140,140)}"
    if a == "slide_up":
        return r"{\fad(70,80)\move(540,1640,540,1500,0,180)}"
    return r"{\fad(80,90)}"


def write_styled_ass(timed_beats: list, caption_styles: dict, path: Path,
                     width: int = 1080, height: int = 1920) -> int:
    """Write an ASS file with a distinct, animated, colorful style PER beat.
    Returns the number of caption lines written."""
    styles = {"default": dict(DEFAULT_STYLE)}
    for name, s in (caption_styles or {}).items():
        merged = dict(DEFAULT_STYLE)
        merged.update(s or {})
        styles[name] = merged

    style_rows = []
    for name, s in styles.items():
        prim = _hex_to_ass(s.get("color", "#FFFFFF"))
        outline = _hex_to_ass(s.get("highlight", "#FFD23F"))   # colored outline = punchy look
        font = s.get("font", "Arial Black")
        size = int(s.get("size", 92))
        style_rows.append(
            f"Style: {name},{font},{size},{prim},&H000000FF,{outline},&HA0000000,"
            f"-1,0,0,0,100,100,0,0,1,5,3,5,60,60,60,1")

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n"
        "WrapStyle: 2\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        + "\n".join(style_rows) + "\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")

    lines = []
    n = 0
    for start, end, beat in timed_beats:
        cap = beat.get("caption")
        if not cap:
            continue
        text = str(cap.get("text", "")).strip()
        if not text:
            continue
        sname = cap.get("style", "default")
        s = styles.get(sname, styles["default"])
        y = int(s.get("y", 1500))
        body = text.replace("\\n", "\\N").replace("\n", "\\N")
        tags = _anim_tags(s.get("anim", "pop"))
        inline = "{\\an5}" + f"{{\\pos({width // 2},{y})}}" + tags
        lines.append(
            f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},{sname},,0,0,0,,{inline}{body}")
        n += 1

    path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
    return n


# ---------------------------------------------------------------------------
# Back-compat: collapse an all-`still` brief to the legacy spec shape.
# ---------------------------------------------------------------------------
def to_legacy_spec(brief: dict) -> dict:
    beats = brief["beats"]
    prompts, scene_map, weights, captions = [], [], [], []
    t = 0.0
    for b in beats:
        if b.get("visual") != "still":
            raise ValueError("to_legacy_spec only supports all-`still` briefs")
        idx = len(prompts)
        prompts.append(b.get("scene_prompt", ""))
        scene_map.append(idx)
        w = float(b["t_weight"])
        weights.append(w)
        cap = b.get("caption") or {}
        captions.append([t, t + w, cap.get("text", "")])
        t += w
    return {
        "slug": brief["slug"], "narration": brief["narration"], "captions": captions,
        "scene_prompts": prompts, "scene_map": scene_map, "scene_weights": weights,
        "style": brief.get("style", ""), "gen_w": brief.get("gen_w", 512),
        "gen_h": brief.get("gen_h", 896), "seed": brief.get("seed", 7),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate a director brief.json")
    ap.add_argument("--brief", required=True)
    args = ap.parse_args()
    brief = validate_brief(json.loads(Path(args.brief).read_text(encoding="utf-8")))
    print(f"OK: {brief['slug']} | {len(brief['beats'])} beats | "
          f"~{brief['_estimate_seconds']}s spoken (cap {HARD_CAP_SECONDS:.0f}s)")
    visuals = {}
    for b in brief["beats"]:
        visuals[b["visual"]] = visuals.get(b["visual"], 0) + 1
    print("beats by visual:", visuals)


if __name__ == "__main__":
    main()
