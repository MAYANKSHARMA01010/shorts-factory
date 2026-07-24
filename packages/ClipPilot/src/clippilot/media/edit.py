"""Real clip / caption / compose via ffmpeg (CPU, no moviepy dependency).

- clip_segment: cut a span and reframe to vertical 9:16 (fill + center-crop)
- write_srt / burn_subtitles: timed burned-in captions (libass `subtitles` filter)
- concat_clips: stitch clips into one (concat filter, re-encoded)

All shell out to the bundled ffmpeg. Subtitle burn-in uses cwd + a bare filename
to dodge Windows path-escaping in the filtergraph.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Optional

from .ffmpeg import run_ffmpeg

_SRT_TS = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)")


def parse_srt(path: str) -> list[dict[str, Any]]:
    """Parse an SRT file → [{start, end, text}] (seconds). Tolerant of CRLF/BOM."""
    try:
        text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    except OSError:
        return []
    cues: list[dict[str, Any]] = []
    for block in re.split(r"\r?\n\s*\r?\n", text.strip()):
        lines = [ln for ln in block.splitlines() if ln.strip()]
        ts_idx = next((i for i, ln in enumerate(lines) if "-->" in ln), None)
        if ts_idx is None:
            continue
        m = _SRT_TS.search(lines[ts_idx])
        if not m:
            continue
        g = list(map(int, m.groups()))
        start = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000.0
        end = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000.0
        cues.append({"start": start, "end": end, "text": " ".join(lines[ts_idx + 1:])})
    return cues


def _ok(r, out: str) -> bool:
    return r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0


def clip_segment(src: str, start: float, end: float, out: str,
                 width: int = 1080, height: int = 1920, vertical: bool = True) -> Optional[str]:
    """Cut [start, end) and (optionally) reframe to vertical via fill+center-crop."""
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    dur = max(0.1, end - start)
    args = ["-ss", f"{start:.3f}", "-i", src, "-t", f"{dur:.3f}"]
    if vertical:
        vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
              f"crop={width}:{height},setsar=1")
        args += ["-vf", vf]
    args += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
             "-movflags", "+faststart", "-y", out]
    return out if _ok(run_ffmpeg(args), out) else None


def _srt_ts(t: float) -> str:
    # Round once to whole milliseconds, then decompose — rounding the fractional
    # second independently could emit an invalid 4-digit ms field (e.g. ",1000").
    total_ms = int(round(max(0.0, t) * 1000))
    h, total_ms = divmod(total_ms, 3_600_000)
    m, total_ms = divmod(total_ms, 60_000)
    s, ms = divmod(total_ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(cues: list[dict[str, Any]], path: str) -> str:
    """Write SRT from [{start, end, text}] cues."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    for i, c in enumerate(cues, 1):
        lines += [str(i), f"{_srt_ts(c['start'])} --> {_srt_ts(c['end'])}", c["text"], ""]
    Path(path).write_text("\n".join(lines), encoding="utf-8")
    return path


# Default caption styling (libass force_style) — big, bottom, readable.
DEFAULT_STYLE = "FontSize=24,Outline=2,Shadow=1,Alignment=2,MarginV=60,Bold=1"


def _ass_ts(t: float) -> str:
    if t < 0:
        t = 0.0
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


# Big, bold, thick-outlined captions sized for vertical 1080×1920 — the punchy
# short-form look (ASS gives pixel-accurate control vs SRT force_style). Colours
# are ASS &HAABBGGRR. Default: white text, black outline, bottom-centre.
ASS_DEFAULTS = {
    "font": "Arial", "fontsize": 92, "primary": "&H00FFFFFF", "secondary": "&H00FFFFFF",
    "outline_colour": "&H00000000", "back_colour": "&H64000000", "bold": -1,
    "border_style": 1, "outline": 6, "shadow": 2, "alignment": 2, "margin_v": 360,
    "uppercase": True, "prefix": "", "kf": False,
}
# Karaoke: unsung words white (secondary), the active/sung word pops bright yellow
# (primary) via ASS \k — the signature TikTok caption effect.
ASS_KARAOKE_DEFAULTS = {**ASS_DEFAULTS, "primary": "&H0000FFFF", "secondary": "&H00FFFFFF"}

# ── Caption skins ────────────────────────────────────────────────────────────
# Recipes harvested from hyperframes / VideoCaptioner / remotion / ShortGPT, then
# adversarially verified for libass correctness (see docs/10). Fonts are mapped to
# guaranteed-present Windows faces (Impact / Arial Black / Segoe UI) so libass never
# silently falls back to an ugly default; the "ideal" web font is noted per skin.
# `prefix` = per-line inline ASS override tags; `kf` = use \kf sweep vs \k snap.
CAPTION_SKINS: dict[str, dict[str, Any]] = {
    # static-style skins ------------------------------------------------------
    "classic": {**ASS_DEFAULTS},                       # plain bold white + black outline
    "opaque_box": {                                    # clean charcoal box (ideal: Montserrat SemiBold)
        **ASS_DEFAULTS, "font": "Segoe UI Semibold", "fontsize": 84, "bold": -1,
        "outline_colour": "&H00000000", "back_colour": "&HC8141414", "border_style": 3,
        "outline": 14, "shadow": 0, "margin_v": 300, "uppercase": False,
        "prefix": r"{\fad(120,80)}",
    },
    "kinetic_pop": {                                   # huge scale-pop hook caps (ideal: Anton)
        **ASS_DEFAULTS, "font": "Impact", "fontsize": 118, "bold": 0,
        "outline_colour": "&H00000000", "back_colour": "&H00000000", "border_style": 1,
        "outline": 9, "shadow": 4, "margin_v": 520, "uppercase": True,
        "prefix": r"{\fad(60,60)\fscx60\fscy60\t(0,220,0.6,\fscx100\fscy100)}",
    },
    "anime_outline": {                                 # warm white + orange ring (ideal: Noto Sans CJK)
        **ASS_DEFAULTS, "font": "Arial", "fontsize": 96, "bold": -1,
        "primary": "&H00F3F5FF", "secondary": "&H00F3F5FF", "outline_colour": "&H000987F5",
        "back_colour": "&HA0000000", "border_style": 1, "outline": 7, "shadow": 4,
        "margin_v": 310, "uppercase": False, "prefix": r"{\fad(100,80)}",
    },
    "sticker": {                                       # chunky gold sticker bounce (ideal: Luckiest Guy)
        **ASS_DEFAULTS, "font": "Arial Black", "fontsize": 108, "bold": 0,
        "primary": "&H0033E5FF", "secondary": "&H0033E5FF", "outline_colour": "&H00000000",
        "back_colour": "&H50000000", "border_style": 1, "outline": 10, "shadow": 6,
        "margin_v": 360, "uppercase": True,
        "prefix": r"{\fscx80\fscy80\t(0,130,\fscx104\fscy104)\t(130,210,\fscx100\fscy100)}",
    },
    # karaoke skins (per-word reveal) -----------------------------------------
    "karaoke_yellow": {**ASS_KARAOKE_DEFAULTS},        # white → yellow word pop (the classic)
    "neon_pop": {                                      # dim teal → electric cyan sweep (ideal: Outfit Black)
        **ASS_KARAOKE_DEFAULTS, "font": "Arial Black", "fontsize": 100, "bold": -1,
        "primary": "&H00F0FF00", "secondary": "&H00B86A1E", "outline_colour": "&H00301800",
        "back_colour": "&H780A0500", "border_style": 1, "outline": 6, "shadow": 5,
        "margin_v": 330, "uppercase": True, "kf": True,
    },
}
# Which skins are karaoke (take pages w/ word timing) vs static (take cues).
KARAOKE_SKINS = {"karaoke_yellow", "neon_pop"}


def skin_style(key: str) -> dict[str, Any]:
    """Return the merged style dict for a caption skin (falls back to classic)."""
    base = ASS_KARAOKE_DEFAULTS if key in KARAOKE_SKINS else ASS_DEFAULTS
    return {**base, **CAPTION_SKINS.get(key, {})}


def _ass_head(width: int, height: int, s: dict[str, Any]) -> str:
    return (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {width}\nPlayResY: {height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{s['font']},{s['fontsize']},{s['primary']},{s['secondary']},"
        f"{s['outline_colour']},{s.get('back_colour', '&H64000000')},{s['bold']},0,0,0,"
        f"100,100,0,0,{s.get('border_style', 1)},"
        f"{s['outline']},{s['shadow']},{s['alignment']},80,80,{s['margin_v']},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


def write_ass(cues: list[dict[str, Any]], path: str, width: int = 1080, height: int = 1920,
              **style: Any) -> str:
    """Write a styled ASS subtitle file (PlayRes = video size) from [{start,end,text}]."""
    s = {**ASS_DEFAULTS, **style}
    prefix = s.get("prefix", "")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    lines = [_ass_head(width, height, s)]
    for c in cues:
        text = (c.get("text") or "").strip()
        if not text:
            continue
        if s["uppercase"]:
            text = text.upper()
        text = text.replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{_ass_ts(c['start'])},{_ass_ts(c['end'])},Default,,0,0,0,,{prefix}{text}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def _karaoke_text(page: dict[str, Any], uppercase: bool, kf: bool = False) -> str:
    """Build an ASS line with \\k (snap) or \\kf (sweep) tags so each token turns the
    highlight colour exactly when it starts being spoken (progressive karaoke fill)."""
    tag = "kf" if kf else "k"
    cursor = int(round(page.get("start", 0.0) * 1000))
    parts: list[str] = []
    for t in page.get("tokens", []):
        word = (t.get("text") or "").strip()
        if not word:
            continue
        from_ms = max(cursor, int(t.get("from_ms", cursor)))
        kdur = max(0, round((from_ms - cursor) / 10))   # centiseconds until this word
        cursor = from_ms
        w = word.upper() if uppercase else word
        parts.append(f"{'' if not parts else ' '}{{\\{tag}{kdur}}}{w}")
    return "".join(parts)


def write_ass_karaoke(pages: list[dict[str, Any]], path: str, width: int = 1080,
                      height: int = 1920, **style: Any) -> str:
    """Write a karaoke ASS from caption pages [{start,end,tokens:[{text,from_ms,to_ms}]}]
    (clip-local). Each word pops to the highlight colour as it's spoken."""
    s = {**ASS_KARAOKE_DEFAULTS, **style}
    prefix = s.get("prefix", "")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    lines = [_ass_head(width, height, s)]
    for p in pages:
        text = _karaoke_text(p, s["uppercase"], kf=bool(s.get("kf")))
        if not text:
            continue
        lines.append(f"Dialogue: 0,{_ass_ts(p['start'])},{_ass_ts(p['end'])},Default,,0,0,0,,{prefix}{text}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def burn_subtitles(src: str, sub_path: str, out: str, style: str = DEFAULT_STYLE) -> Optional[str]:
    """Burn a subtitle file (SRT or ASS) into the video. Runs ffmpeg with cwd = the
    subtitle's dir so the filter references a bare filename (no Windows path
    escaping). For .ass the file's own styles are used; force_style is SRT-only."""
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    sub_dir = str(Path(sub_path).resolve().parent)
    name = Path(sub_path).name
    if name.lower().endswith(".ass"):
        vf = f"subtitles={name}"
    else:
        vf = f"subtitles={name}:force_style='{style}'" if style else f"subtitles={name}"
    args = ["-i", str(Path(src).resolve()), "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "copy", "-y", str(Path(out).resolve())]
    return out if _ok(run_ffmpeg(args, cwd=sub_dir), out) else None


def add_bgm(video: str, bgm_path: str, out: str, volume: float = 0.12) -> Optional[str]:
    """Mix a (looped, low-volume) music bed under the video's existing narration.
    Only ever a user-supplied/cleared track (cleared-music guardrail). Returns
    path/None."""
    if not (Path(video).exists() and Path(bgm_path).exists()):
        return None
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    args = [
        "-i", str(Path(video)), "-stream_loop", "-1", "-i", str(Path(bgm_path)),
        "-filter_complex",
        f"[1:a]volume={volume}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest",
        "-movflags", "+faststart", "-y", str(Path(out)),
    ]
    return out if _ok(run_ffmpeg(args), out) else None


def concat_clips(paths: list[str], out: str) -> Optional[str]:
    """Concatenate clips (re-encoded). Clips with no audio stream get a silent
    track first, so the `concat ... a=1` filter never fails on video-only inputs."""
    from .signals import probe

    paths = [p for p in paths if p and os.path.exists(p)]
    if not paths:
        return None
    Path(out).parent.mkdir(parents=True, exist_ok=True)  # both branches need this
    if len(paths) == 1:
        return out if _ok(run_ffmpeg(["-i", paths[0], "-c", "copy", "-y", out]), out) else None

    # Normalize: every segment must carry audio for concat=a=1. If a silent-audio add
    # fails for any clip, fall back to a VIDEO-ONLY concat (a=0) so the filter never
    # references a missing [i:a] stream (which would make ffmpeg hard-fail).
    norm: list[str] = []
    all_have_audio = True
    for i, p in enumerate(paths):
        if probe(p).has_audio:
            norm.append(p)
            continue
        ap = str(Path(out).parent / f"_concat_a{i}.mp4")
        r = run_ffmpeg(["-i", p, "-f", "lavfi", "-i",
                        "anullsrc=channel_layout=stereo:sample_rate=44100",
                        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac",
                        "-shortest", "-y", ap])
        if _ok(r, ap):
            norm.append(ap)
        else:
            norm.append(p)
            all_have_audio = False     # this clip still has no audio → video-only concat

    args: list[str] = []
    for p in norm:
        args += ["-i", p]
    if all_have_audio:
        streams = "".join(f"[{i}:v][{i}:a]" for i in range(len(norm)))
        filt = f"{streams}concat=n={len(norm)}:v=1:a=1[v][a]"
        args += ["-filter_complex", filt, "-map", "[v]", "-map", "[a]",
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", out]
    else:
        streams = "".join(f"[{i}:v]" for i in range(len(norm)))
        filt = f"{streams}concat=n={len(norm)}:v=1:a=0[v]"
        args += ["-filter_complex", filt, "-map", "[v]",
                 "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", out]
    return out if _ok(run_ffmpeg(args), out) else None
