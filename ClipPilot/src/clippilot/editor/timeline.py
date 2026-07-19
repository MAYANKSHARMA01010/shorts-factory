"""Programmatic timeline / EDL editor — palmier-pro feature parity (the data model
+ non-destructive edit operations), re-authored in pure Python (no Swift/AVFoundation).

palmier-pro is a macOS/Swift desktop editor we can't vendor, but its FUNCTIONALITY is
generic: a JSON timeline of tracks→clips with trim/speed/volume/opacity/transform/crop
+ overlap-overwrite, ripple insert/delete, split, and batch property edits. This module
is that model + operations; `editor/render.py` composites it to a video via ffmpeg and
`mcp_server` exposes the operations as tools so Claude can edit a timeline like palmier's
agent does. Frame-based (project fps), matching palmier's schema.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field, replace
from typing import Any, Optional

CLIP_TYPES = ("video", "audio", "image", "text", "adjustment", "shape")


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


@dataclass
class Transform:
    center_x: float = 0.5      # 0–1 normalized canvas
    center_y: float = 0.5
    width: float = 1.0         # 0–1 fraction of canvas
    height: float = 1.0
    rotation: float = 0.0      # degrees, clockwise
    flip_h: bool = False
    flip_v: bool = False


@dataclass
class Crop:
    left: float = 0.0          # 0–1 source insets
    top: float = 0.0
    right: float = 0.0
    bottom: float = 0.0


@dataclass
class TextStyle:
    font: str = "Arial"
    font_size: float = 96.0
    color: str = "#FFFFFF"
    alignment: str = "center"  # left|center|right
    # Essential Graphics: stroke, background box (caption highlight), drop shadow
    border_width: int = 6
    border_color: str = "#000000"
    box: bool = False
    box_color: str = "#000000"
    box_opacity: float = 0.5
    box_border: int = 12       # padding around the text inside the box
    shadow: bool = False
    shadow_color: str = "#000000"
    shadow_x: int = 3
    shadow_y: int = 3


@dataclass
class Clip:
    media_ref: str = ""                     # asset id / file path; "" for text clips
    media_type: str = "video"               # video|audio|image|text
    start_frame: int = 0                    # position on the timeline
    duration_frames: int = 0
    trim_start_frame: int = 0               # source in-point
    trim_end_frame: int = 0                 # source out-point (0 = to end)
    speed: float = 1.0
    volume: float = 1.0                     # 0–1
    opacity: float = 1.0                    # 0–1
    fade_in_frames: int = 0
    fade_out_frames: int = 0
    fade_color: str = "black"               # dip color for this clip's fades (black|white|…)
    transform: Transform = field(default_factory=Transform)
    crop: Crop = field(default_factory=Crop)
    text_content: Optional[str] = None
    text_style: Optional[TextStyle] = None
    keyframes: dict[str, Any] = field(default_factory=dict)  # {prop: {interp, keys:[[frame,*vals]]}}
    chroma_key: Optional[dict[str, Any]] = None  # {color:"0x00FF00", similarity, blend} → green-screen
    transition: Optional[dict[str, Any]] = None  # {type:"fade|slide_*|wipe_*", duration_frames} entrance
    color: Optional[dict[str, Any]] = None       # color grade {brightness,contrast,saturation,gamma,temperature,grain}
    effects: list[dict[str, Any]] = field(default_factory=list)  # Premiere video FX stack [{type,...params}] in order
    audio_fx: list[dict[str, Any]] = field(default_factory=list)  # Premiere Essential-Sound audio FX stack [{type,...}]
    blend_mode: Optional[str] = None             # Premiere opacity blend mode (multiply|screen|overlay|...); None = normal
    shape: Optional[dict[str, Any]] = None       # for media_type=="shape": {type:rect|ellipse, fill, stroke?, stroke_width?}
    track_matte: Optional[dict[str, Any]] = None  # Track Matte Key: {matte_id, type:luma|alpha, invert} — mask this clip by another
    id: str = field(default_factory=_new_id)

    @property
    def end_frame(self) -> int:
        return self.start_frame + self.duration_frames

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Clip":
        d = dict(d)
        if isinstance(d.get("transform"), dict):
            d["transform"] = Transform(**d["transform"])
        if isinstance(d.get("crop"), dict):
            d["crop"] = Crop(**d["crop"])
        if isinstance(d.get("text_style"), dict):
            d["text_style"] = TextStyle(**d["text_style"])
        for fxkey in ("effects", "audio_fx"):     # tolerate malformed FX stacks from JSON
            if fxkey in d:
                d[fxkey] = [e for e in d[fxkey] if isinstance(e, dict)] \
                    if isinstance(d[fxkey], list) else []
        if "shape" in d and not isinstance(d["shape"], dict):
            d["shape"] = None
        if "track_matte" in d and not isinstance(d["track_matte"], dict):
            d["track_matte"] = None
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class Track:
    type: str = "video"                     # video|audio|image|text
    clips: list[Clip] = field(default_factory=list)
    muted: bool = False
    hidden: bool = False
    id: str = field(default_factory=_new_id)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "type": self.type, "muted": self.muted,
                "hidden": self.hidden, "clips": [c.to_dict() for c in self.clips]}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Track":
        return cls(id=d.get("id", _new_id()), type=d.get("type", "video"),
                   muted=bool(d.get("muted", False)), hidden=bool(d.get("hidden", False)),
                   clips=[Clip.from_dict(c) for c in d.get("clips", [])])


@dataclass
class Timeline:
    fps: int = 30
    width: int = 1080
    height: int = 1920
    tracks: list[Track] = field(default_factory=list)
    # Essential-Sound auto-duck: lower a music track under a voice track (sidechain compress).
    auto_duck: Optional[dict[str, Any]] = None   # {music_track, voice_track, threshold?, ratio?, release_ms?}
    markers: list[dict[str, Any]] = field(default_factory=list)  # timeline markers [{frame,name,color,comment,duration_frames}]

    # ── persistence ──
    def to_dict(self) -> dict[str, Any]:
        return {"fps": self.fps, "width": self.width, "height": self.height,
                "total_frames": self.total_frames(), "auto_duck": self.auto_duck,
                "markers": self.markers, "tracks": [t.to_dict() for t in self.tracks]}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Timeline":
        if not isinstance(d, dict):           # tolerate non-dict JSON (123, [..], "x")
            return cls()
        markers = d.get("markers")
        return cls(fps=int(d.get("fps", 30)), width=int(d.get("width", 1080)),
                   height=int(d.get("height", 1920)),
                   auto_duck=d.get("auto_duck") if isinstance(d.get("auto_duck"), dict) else None,
                   markers=[m for m in markers if isinstance(m, dict)] if isinstance(markers, list) else [],
                   tracks=[Track.from_dict(t) for t in d.get("tracks", []) if isinstance(t, dict)])

    def total_frames(self) -> int:
        return max((c.end_frame for t in self.tracks for c in t.clips), default=0)

    # ── lookup ──
    def track(self, index: int) -> Track:
        while index >= len(self.tracks):
            self.tracks.append(Track())
        return self.tracks[index]

    def find_clip(self, clip_id: str) -> Optional[tuple[Track, Clip]]:
        for t in self.tracks:
            for c in t.clips:
                if c.id == clip_id:
                    return t, c
        return None

    def all_clips(self) -> list[Clip]:
        return [c for t in self.tracks for c in t.clips]


# ── edit operations (palmier tool parity) ───────────────────────────────────
def _overwrite_region(track: Track, start: int, end: int, keep_id: str) -> None:
    """Make room in [start, end): trim/split/remove existing clips (overwrite mode)."""
    out: list[Clip] = []
    for c in track.clips:
        if c.id == keep_id or c.end_frame <= start or c.start_frame >= end:
            out.append(c)                                   # untouched
            continue
        if c.start_frame < start and c.end_frame > end:     # new clip splits it → left + right
            left = replace(c, id=_new_id(), duration_frames=start - c.start_frame)
            right = replace(c, id=_new_id(), start_frame=end,
                            duration_frames=c.end_frame - end,
                            trim_start_frame=c.trim_start_frame + (end - c.start_frame))
            out.extend([left, right])
        elif c.start_frame < start:                         # trim its tail
            out.append(replace(c, duration_frames=start - c.start_frame))
        elif c.end_frame > end:                             # trim its head
            out.append(replace(c, start_frame=end, duration_frames=c.end_frame - end,
                               trim_start_frame=c.trim_start_frame + (end - c.start_frame)))
        # else fully covered → dropped
    track.clips = sorted(out, key=lambda c: c.start_frame)


def add_clip(tl: Timeline, track_index: int, clip: Clip) -> Clip:
    """Place a clip; overlapping existing clips on the track are overwritten."""
    track = tl.track(track_index)
    _overwrite_region(track, clip.start_frame, clip.end_frame, clip.id)
    track.clips.append(clip)
    track.clips.sort(key=lambda c: c.start_frame)
    return clip


def insert_clip(tl: Timeline, track_index: int, at_frame: int, clip: Clip) -> Clip:
    """Insert at a frame and RIPPLE everything at/after it right by the clip's duration."""
    track = tl.track(track_index)
    shift = clip.duration_frames
    for c in track.clips:
        if c.start_frame >= at_frame:
            c.start_frame += shift
    clip.start_frame = at_frame
    track.clips.append(clip)
    track.clips.sort(key=lambda c: c.start_frame)
    return clip


def remove_clips(tl: Timeline, clip_ids: list[str]) -> int:
    ids = set(clip_ids)
    n = 0
    for t in tl.tracks:
        before = len(t.clips)
        t.clips = [c for c in t.clips if c.id not in ids]
        n += before - len(t.clips)
    return n


def move_clip(tl: Timeline, clip_id: str, to_track: Optional[int] = None,
              to_frame: Optional[int] = None) -> bool:
    found = tl.find_clip(clip_id)
    if not found:
        return False
    track, clip = found
    to_track = int(to_track) if to_track is not None else None       # tolerate MCP strings
    to_frame = int(to_frame) if to_frame is not None else None
    if to_frame is not None:
        clip.start_frame = max(0, to_frame)
    if to_track is not None and tl.tracks.index(track) != to_track:
        track.clips.remove(clip)
        dest = tl.track(to_track)
        _overwrite_region(dest, clip.start_frame, clip.end_frame, clip.id)
        dest.clips.append(clip)
        dest.clips.sort(key=lambda c: c.start_frame)
    else:
        track.clips.sort(key=lambda c: c.start_frame)
    return True


def split_clip(tl: Timeline, clip_id: str, at_frame: int) -> Optional[tuple[Clip, Clip]]:
    """Split a clip at a timeline frame strictly between its start and end."""
    found = tl.find_clip(clip_id)
    if not found:
        return None
    track, clip = found
    if not (clip.start_frame < at_frame < clip.end_frame):
        return None
    left_dur = at_frame - clip.start_frame
    left = replace(clip, duration_frames=left_dur)
    right = replace(clip, id=_new_id(), start_frame=at_frame,
                    duration_frames=clip.end_frame - at_frame,
                    trim_start_frame=clip.trim_start_frame + left_dur)
    i = track.clips.index(clip)
    track.clips[i:i + 1] = [left, right]
    return left, right


_INT_FIELDS = {"duration_frames", "trim_start_frame", "trim_end_frame",
               "fade_in_frames", "fade_out_frames"}
_FLOAT_FIELDS = {"speed", "volume", "opacity"}
_PROP_FIELDS = _INT_FIELDS | _FLOAT_FIELDS | {"text_content", "fade_color"}


def _coerce(field: str, v: Any) -> Any:
    """Coerce externally-supplied (MCP/JSON) values to the field's type so frame math
    stays integer and avoids str/float type errors."""
    try:
        if field in _INT_FIELDS:
            return int(v)
        if field in _FLOAT_FIELDS:
            return float(v)
    except (TypeError, ValueError):
        return v
    return v


def set_clip_properties(tl: Timeline, clip_ids: list[str], **props: Any) -> int:
    """Batch-apply scalar/text/transform/crop properties to clips. Returns count updated."""
    ids = set(clip_ids)
    transform = props.pop("transform", None)
    crop = props.pop("crop", None)
    text_style = props.pop("text_style", None)
    chroma = props.pop("chroma_key", "__keep__")        # dict to set, None to clear
    trans = props.pop("transition", "__keep__")
    color = props.pop("color", "__keep__")
    effects = props.pop("effects", "__keep__")          # list to replace whole video FX stack, None to clear
    audio_fx = props.pop("audio_fx", "__keep__")        # list to replace whole audio FX stack, None to clear
    blend = props.pop("blend_mode", "__keep__")         # str to set, None/"" to clear (→ normal overlay)
    shape = props.pop("shape", "__keep__")              # dict to set, None to clear
    n = 0
    for c in tl.all_clips():
        if c.id not in ids:
            continue
        for k, v in props.items():
            if k in _PROP_FIELDS:
                setattr(c, k, _coerce(k, v))
        if isinstance(transform, dict):
            c.transform = replace(c.transform, **{k: v for k, v in transform.items()
                                                  if k in Transform.__dataclass_fields__})
        if isinstance(crop, dict):
            c.crop = replace(c.crop, **{k: v for k, v in crop.items()
                                        if k in Crop.__dataclass_fields__})
        if isinstance(text_style, dict):
            base = c.text_style or TextStyle()
            c.text_style = replace(base, **{k: v for k, v in text_style.items()
                                            if k in TextStyle.__dataclass_fields__})
        if chroma != "__keep__":
            c.chroma_key = chroma if isinstance(chroma, dict) else None
        if trans != "__keep__":
            c.transition = trans if isinstance(trans, dict) else None
        if color != "__keep__":
            c.color = color if isinstance(color, dict) else None
        if effects != "__keep__":
            c.effects = [e for e in effects if isinstance(e, dict)] if isinstance(effects, list) else []
        if audio_fx != "__keep__":
            c.audio_fx = [e for e in audio_fx if isinstance(e, dict)] if isinstance(audio_fx, list) else []
        if blend != "__keep__":
            c.blend_mode = blend if isinstance(blend, str) and blend else None
        if shape != "__keep__":
            c.shape = shape if isinstance(shape, dict) else None
        n += 1
    return n


def _append_fx(tl: Timeline, clip_ids: list[str], effect: dict[str, Any], attr: str) -> int:
    """Append one effect dict to a clip-FX list attribute (`effects` or `audio_fx`) on each
    named clip. Returns clips updated; a no-op if the effect has no `type`."""
    ids = set(clip_ids)
    if not isinstance(effect, dict) or not effect.get("type"):
        return 0
    n = 0
    for c in tl.all_clips():
        if c.id in ids:
            setattr(c, attr, list(getattr(c, attr)) + [dict(effect)])
            n += 1
    return n


def add_effect(tl: Timeline, clip_ids: list[str], effect: dict[str, Any]) -> int:
    """Append one video effect to each named clip's FX stack (Premiere 'add effect')."""
    return _append_fx(tl, clip_ids, effect, "effects")


def add_audio_effect(tl: Timeline, clip_ids: list[str], effect: dict[str, Any]) -> int:
    """Append one audio effect to each named clip's Essential-Sound audio FX stack."""
    return _append_fx(tl, clip_ids, effect, "audio_fx")


def set_track_matte(tl: Timeline, fill_clip_id: str, matte_clip_id: Optional[str],
                    matte_type: str = "luma", invert: bool = False) -> bool:
    """Track Matte Key: mask `fill_clip_id` by `matte_clip_id` (an image/video clip whose
    luma or alpha becomes the fill's transparency). matte_clip_id=None clears it."""
    found = tl.find_clip(fill_clip_id)
    if not found:
        return False
    if not matte_clip_id:
        found[1].track_matte = None
        return True
    if not tl.find_clip(matte_clip_id):
        return False
    found[1].track_matte = {"matte_id": matte_clip_id,
                            "type": matte_type if matte_type in ("luma", "alpha") else "luma",
                            "invert": bool(invert)}
    return True


def dip_transition(tl: Timeline, out_clip_id: str, in_clip_id: str, frames: int,
                   color: str = "black") -> bool:
    """Set up a Premiere "Dip to Black/White" at a cut: the outgoing clip fades out to
    `color` and the incoming clip fades in from `color` over `frames` frames each."""
    out_f = tl.find_clip(out_clip_id)
    in_f = tl.find_clip(in_clip_id)
    if not out_f or not in_f:
        return False
    frames = max(1, int(frames))
    out_f[1].fade_out_frames = frames
    out_f[1].fade_color = color
    in_f[1].fade_in_frames = frames
    in_f[1].fade_color = color
    return True


def add_marker(tl: Timeline, frame: int, name: str = "", color: str = "green",
               comment: str = "", duration_frames: int = 0) -> dict[str, Any]:
    """Add a timeline marker (point or range) — used for chapters/comments/segmentation."""
    m = {"frame": max(0, int(frame)), "name": str(name), "color": str(color),
         "comment": str(comment), "duration_frames": max(0, int(duration_frames))}
    tl.markers.append(m)
    tl.markers.sort(key=lambda x: x.get("frame", 0))
    return m


def remove_markers(tl: Timeline, frames: list[int]) -> int:
    """Remove markers located at any of the given frames. Returns the count removed."""
    fs = {int(f) for f in frames}
    before = len(tl.markers)
    tl.markers = [m for m in tl.markers if m.get("frame") not in fs]
    return before - len(tl.markers)


def clear_markers(tl: Timeline) -> int:
    n = len(tl.markers)
    tl.markers = []
    return n


def add_adjustment_layer(tl: Timeline, track_index: int, start_frame: int,
                         duration_frames: int, color: Optional[dict[str, Any]] = None,
                         effects: Optional[list[dict[str, Any]]] = None,
                         lut: Optional[str] = None) -> Clip:
    """Add a Premiere adjustment layer — a media-less clip whose color grade / FX / LUT apply
    to everything below it on the timeline, within its window. Put it on its own upper track."""
    col = dict(color) if isinstance(color, dict) else {}
    if isinstance(lut, str) and lut:
        col["lut"] = lut
    clip = Clip(media_type="adjustment", media_ref="", start_frame=int(start_frame),
                duration_frames=int(duration_frames), color=col or None,
                effects=[e for e in (effects or []) if isinstance(e, dict)])
    return add_clip(tl, track_index, clip)


def selective_color(tl: Timeline, clip_ids: list[str], family: str,
                    values: list[float]) -> int:
    """Lumetri HSL Secondary: merge a per-colour-family adjustment into clips' color grade.
    family ∈ reds|yellows|greens|cyans|blues|magentas|whites|neutrals|blacks; values =
    [cyan, magenta, yellow, (black)] each -1..1. Returns clips updated."""
    ids = set(clip_ids)
    if not isinstance(values, (list, tuple)) or len(values) < 3:
        return 0
    n = 0
    for c in tl.all_clips():
        if c.id not in ids:
            continue
        col = dict(c.color) if isinstance(c.color, dict) else {}
        sel = dict(col.get("selective")) if isinstance(col.get("selective"), dict) else {}
        sel[str(family).lower()] = [float(v) for v in values[:4]]
        col["selective"] = sel
        c.color = col
        n += 1
    return n


def apply_lut(tl: Timeline, clip_ids: list[str], lut: Optional[str]) -> int:
    """Set (or clear) a Creative LUT on clips by merging `lut` into each clip's `color`
    grade (so other color settings are preserved). `lut` = a built-in look name or a
    .cube path; None/'' clears it. Returns clips updated."""
    ids = set(clip_ids)
    n = 0
    for c in tl.all_clips():
        if c.id not in ids:
            continue
        col = dict(c.color) if isinstance(c.color, dict) else {}
        if isinstance(lut, str) and lut:
            col["lut"] = lut
        else:
            col.pop("lut", None)
        c.color = col or None
        n += 1
    return n


def set_auto_duck(tl: Timeline, music_track: Optional[int], voice_track: Optional[int],
                  threshold: float = 0.03, ratio: float = 8.0,
                  release_ms: int = 250) -> Optional[dict[str, Any]]:
    """Configure (or clear) Essential-Sound auto-duck — the music track is sidechain-
    compressed by the voice track so music dips while the voiceover speaks. Pass either
    track as None to clear. music_track must differ from voice_track."""
    if music_track is None or voice_track is None or int(music_track) == int(voice_track):
        tl.auto_duck = None
        return None
    tl.auto_duck = {"music_track": int(music_track), "voice_track": int(voice_track),
                    "threshold": max(0.001, min(0.9, float(threshold))),
                    "ratio": max(1.0, min(20.0, float(ratio))),
                    "release_ms": max(10, min(3000, int(release_ms)))}
    return tl.auto_duck


def ripple_delete_range(tl: Timeline, track_index: int, start: int, end: int) -> int:
    """Cut [start, end) on a track and close the gap (pull later clips left). Clips
    straddling the cut are trimmed. Returns frames removed."""
    if end <= start or track_index >= len(tl.tracks):
        return 0
    track = tl.tracks[track_index]
    gap = end - start
    out: list[Clip] = []
    for c in track.clips:
        if c.end_frame <= start:
            out.append(c)
        elif c.start_frame >= end:
            out.append(replace(c, start_frame=c.start_frame - gap))
        elif c.start_frame < start and c.end_frame > end:        # straddles → shrink
            out.append(replace(c, duration_frames=c.duration_frames - gap))
        elif c.start_frame < start:                              # trim tail
            out.append(replace(c, duration_frames=start - c.start_frame))
        elif c.end_frame > end:                                  # trim head + pull left
            keep = c.end_frame - end
            out.append(replace(c, start_frame=start, duration_frames=keep,
                               trim_start_frame=c.trim_start_frame + (end - c.start_frame)))
        # else fully inside cut → dropped
    track.clips = sorted(out, key=lambda c: c.start_frame)
    return gap


def slip_clip(tl: Timeline, clip_id: str, frames: int) -> bool:
    """Slip edit: shift the clip's SOURCE in-point by `frames` (show a different part of the
    source) without moving the clip on the timeline or changing its duration."""
    found = tl.find_clip(clip_id)
    if not found:
        return False
    found[1].trim_start_frame = max(0, found[1].trim_start_frame + int(frames))
    return True


def _adjacent_after(track: Track, clip: Clip) -> Optional[Clip]:
    clips = sorted(track.clips, key=lambda c: c.start_frame)
    i = clips.index(clip)
    nxt = clips[i + 1] if i + 1 < len(clips) else None
    return nxt if (nxt and nxt.start_frame == clip.end_frame) else None


def _adjacent_before(track: Track, clip: Clip) -> Optional[Clip]:
    clips = sorted(track.clips, key=lambda c: c.start_frame)
    i = clips.index(clip)
    prev = clips[i - 1] if i > 0 else None
    return prev if (prev and prev.end_frame == clip.start_frame) else None


def roll_edit(tl: Timeline, clip_id: str, frames: int) -> bool:
    """Roll edit: move the cut between this clip and the NEXT (adjacent) clip by `frames` —
    this clip's out-point and the next clip's in-point move together; total span unchanged."""
    found = tl.find_clip(clip_id)
    if not found:
        return False
    track, clip = found
    nxt = _adjacent_after(track, clip)
    if not nxt:
        return False
    lo = max(1 - clip.duration_frames, -nxt.trim_start_frame)
    hi = nxt.duration_frames - 1
    if hi < lo:
        return False
    f = max(lo, min(int(frames), hi))
    clip.duration_frames += f
    nxt.start_frame += f
    nxt.duration_frames -= f
    nxt.trim_start_frame += f
    return True


def slide_clip(tl: Timeline, clip_id: str, frames: int) -> bool:
    """Slide edit: move the clip by `frames` while keeping its content/duration; the previous
    clip's tail and the next clip's head are trimmed to follow it (neighbors' outer edges fixed)."""
    found = tl.find_clip(clip_id)
    if not found:
        return False
    track, clip = found
    prev, nxt = _adjacent_before(track, clip), _adjacent_after(track, clip)
    if not prev or not nxt:
        return False
    lo = max(1 - prev.duration_frames, -nxt.trim_start_frame)
    hi = nxt.duration_frames - 1
    if hi < lo:
        return False
    f = max(lo, min(int(frames), hi))
    clip.start_frame += f
    prev.duration_frames += f
    nxt.start_frame += f
    nxt.duration_frames -= f
    nxt.trim_start_frame += f
    return True


def set_keyframes(tl: Timeline, clip_id: str, prop: str, keys: list[list[float]],
                  interp: str = "smooth") -> bool:
    """Set/replace the animated keyframe track for one clip property (palmier setKeyframes).
    prop ∈ opacity|volume|rotation|position|scale|crop; keys = [[clip_local_frame, *values]]."""
    from .keyframes import INTERP, PROP_ARITY
    found = tl.find_clip(clip_id)
    if not found or prop not in PROP_ARITY:
        return False
    arity = PROP_ARITY[prop]                  # each row must be [frame, *arity values]
    rows = [list(k) for k in keys if k and len(k) >= 1 + arity]
    if not rows:
        return False                          # reject malformed/empty keyframe data
    interp = interp if interp in INTERP else "smooth"
    found[1].keyframes[prop] = {"interp": interp, "keys": rows}
    return True


def add_shape(tl: Timeline, track_index: int, start_frame: int, duration_frames: int,
              shape_type: str = "rect", fill: str = "#FFFFFF", opacity: float = 1.0,
              transform: Optional[Transform] = None) -> Clip:
    """Add an Essential-Graphics shape clip (rect|ellipse) — banners, lower-thirds, callout
    boxes. Size/position via its transform; color via `fill`."""
    clip = Clip(media_type="shape", start_frame=int(start_frame), duration_frames=int(duration_frames),
                opacity=float(opacity), transform=transform or Transform(),
                shape={"type": shape_type if shape_type in ("rect", "ellipse") else "rect",
                       "fill": fill})
    return add_clip(tl, track_index, clip)


def add_text(tl: Timeline, track_index: int, start_frame: int, duration_frames: int,
             content: str, style: Optional[TextStyle] = None,
             transform: Optional[Transform] = None) -> Clip:
    clip = Clip(media_type="text", start_frame=start_frame, duration_frames=duration_frames,
                text_content=content, text_style=style or TextStyle(),
                transform=transform or Transform())
    track = tl.track(track_index)
    track.clips.append(clip)
    track.clips.sort(key=lambda c: c.start_frame)
    return clip
