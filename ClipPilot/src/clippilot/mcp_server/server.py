"""ClipPilot's MCP tool surface (JSON-RPC 2.0) — the API Claude drives.

Two transports share one dispatcher (`handle_rpc`):
  • HTTP on 127.0.0.1 (this file) — for the in-app brain / local clients.
  • stdio (`stdio.py`) — what the **Claude Desktop app** launches so Claude can
    perform the task. Wire it up with `python -m clippilot.mcp_server`.

HTTP is bound to 127.0.0.1 only (never 0.0.0.0 — the SSRF footgun, docs/02b §4).

Tools split into two groups:
  • read/understand (stateless, take {path}): probe, extract_signals,
    understand_meta, understand_video.
  • pipeline control (drive the money pipeline against the real SQLite job
    store): enqueue, list_jobs, job_detail, job_counts, run_engine, approve,
    reject, requeue, record_strike.

The control tools are how Claude actually *operates* ClipPilot end-to-end:
enqueue a source → run_engine → inspect at the approval gate → approve/reject →
run_engine again to publish. The human approval gate still applies (default ON);
`approve` is exposed so an explicitly-unattended setup can let Claude close the
loop — with eyes open (docs/06, VISION §7).
"""
from __future__ import annotations

import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Iterator

from .. import __version__
from ..media import signals
from ..understand import understand_video, understanding_meta

MCP_PROTOCOL_VERSION = "2025-06-18"


# ── pipeline-control helpers ─────────────────────────────────────────────────
@contextmanager
def _queue() -> Iterator[Any]:
    """A JobQueue over the real (or CLIPPILOT_DATA-overridden) SQLite store.

    Opens a fresh connection per call and CLOSES it on exit — safe under the
    threading HTTP server, cheap under WAL, and (importantly on Windows) it
    releases the DB file lock so nothing leaks between calls. Reads CLIPPILOT_DATA
    at call time so tests can point at a temp dir without re-importing config.
    """
    from .. import config as cfg
    from ..db import connect
    from ..queue import JobQueue

    conn = connect(cfg.db_path())
    try:
        yield JobQueue(conn, cfg.Settings.load(cfg.settings_path()))
    finally:
        conn.close()


def _job_summary(job) -> dict[str, Any]:
    return {
        "id": job.id,
        "section": job.section.value,
        "status": job.status.value,
        "stage": job.stage.value,
        "rights": job.rights_tag.value,
        "channel": job.channel,
        "source_ref": job.source_ref,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "error": job.error,
        "updated_at": job.updated_at,
    }


def _h_enqueue(a: dict[str, Any]) -> dict[str, Any]:
    from ..models import RightsTag, Section
    with _queue() as q:
        job = q.enqueue(
            source_ref=a["source_ref"],
            section=Section(a.get("section", "A")),
            rights_tag=RightsTag(a.get("rights_tag", "owned")),
            channel=a.get("channel"),
            idempotency_key=a.get("idempotency_key"),
        )
        return {"job": _job_summary(job)}


def _h_enqueue_folder(a: dict[str, Any]) -> dict[str, Any]:
    from ..batch import enqueue_folder
    with _queue() as q:
        return enqueue_folder(q, a["folder"], section=a.get("section", "A"),
                              rights=a.get("rights_tag", "owned"),
                              channel=a.get("channel"), recursive=a.get("recursive", True))


def _h_list_profiles(a: dict[str, Any]) -> dict[str, Any]:
    from ..profiles import load_profiles
    return {"profiles": [p.to_dict() for p in load_profiles().values()]}


def _h_save_profile(a: dict[str, Any]) -> dict[str, Any]:
    from ..profiles import Profile, save_profile
    p = save_profile(Profile(
        name=a["name"], section=a.get("section", "A"), rights=a.get("rights", "owned"),
        channel=a.get("channel"), voice=a.get("voice"), bgm_path=a.get("bgm_path"),
        target_seconds=int(a.get("target_seconds", 35)),
    ))
    return {"profile": p.to_dict()}


def _h_delete_profile(a: dict[str, Any]) -> dict[str, Any]:
    from ..profiles import delete_profile
    return {"deleted": delete_profile(a["name"])}


def _h_enqueue_with_profile(a: dict[str, Any]) -> dict[str, Any]:
    from ..profiles import enqueue_with_profile, get_profile
    prof = get_profile(a["profile"])
    if not prof:
        return {"error": f"no profile named {a['profile']!r}"}
    with _queue() as q:
        return {"job": _job_summary(enqueue_with_profile(q, a["source_ref"], prof))}


def _h_resync_subtitles(a: dict[str, Any]) -> dict[str, Any]:
    from ..media.subsync import sync_subtitles
    res = sync_subtitles(a["srt_path"], a["audio_path"], out_path=a.get("out_path"))
    return res or {"error": "could not resync (need ffmpeg + an existing SRT + media)"}


def _h_download_source(a: dict[str, Any]) -> dict[str, Any]:
    from .. import config as cfg
    from ..media.download import download_source
    out = a.get("out_dir") or str(cfg.media_dir() / "downloads")
    return download_source(a["url"], out, max_height=int(a.get("max_height", 1080)))


# ── timeline editor tools (palmier-pro parity; stateful over a project JSON) ──
def _ed_load(a: dict[str, Any]):
    from ..editor.project import load_project
    return load_project(a["project"])


def _ed_save(tl, a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.project import push_undo, save_project
    push_undo(a["project"])          # snapshot the pre-edit state for editor_undo
    save_project(tl, a["project"])
    return tl.to_dict()


def _h_editor_new(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import Timeline
    tl = Timeline(fps=int(a.get("fps", 30)), width=int(a.get("width", 1080)),
                  height=int(a.get("height", 1920)))
    return _ed_save(tl, a)


def _h_editor_get(a: dict[str, Any]) -> dict[str, Any]:
    return _ed_load(a).to_dict()


def _h_editor_add_clip(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import Clip, add_clip
    tl = _ed_load(a)
    clip = add_clip(tl, int(a.get("track_index", 0)),
                    Clip(media_ref=a["media_ref"], media_type=a.get("media_type", "video"),
                         start_frame=int(a["start_frame"]), duration_frames=int(a["duration_frames"]),
                         trim_start_frame=int(a.get("trim_start_frame", 0))))
    return {**_ed_save(tl, a), "added_clip_id": clip.id}


def _h_editor_add_text(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import TextStyle, add_text
    tl = _ed_load(a)
    style = TextStyle(
        font=a.get("font", "Arial"), font_size=float(a.get("font_size", 96)),
        color=a.get("color", "#FFFFFF"), alignment=a.get("alignment", "center"),
        border_width=int(a.get("border_width", 6)), border_color=a.get("border_color", "#000000"),
        box=bool(a.get("box", False)), box_color=a.get("box_color", "#000000"),
        box_opacity=float(a.get("box_opacity", 0.5)), box_border=int(a.get("box_border", 12)),
        shadow=bool(a.get("shadow", False)), shadow_color=a.get("shadow_color", "#000000"),
        shadow_x=int(a.get("shadow_x", 3)), shadow_y=int(a.get("shadow_y", 3)))
    clip = add_text(tl, int(a.get("track_index", 0)), int(a["start_frame"]),
                    int(a["duration_frames"]), a["content"], style=style)
    return {**_ed_save(tl, a), "added_clip_id": clip.id}


def _h_editor_add_shape(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import Transform, add_shape
    tl = _ed_load(a)
    t = a.get("transform") if isinstance(a.get("transform"), dict) else {}
    transform = Transform(**{k: v for k, v in t.items() if k in Transform.__dataclass_fields__})
    clip = add_shape(tl, int(a.get("track_index", 1)), int(a["start_frame"]),
                     int(a["duration_frames"]), shape_type=a.get("shape_type", "rect"),
                     fill=a.get("fill", "#FFFFFF"), opacity=float(a.get("opacity", 1.0)),
                     transform=transform)
    return {**_ed_save(tl, a), "added_clip_id": clip.id}


def _h_editor_set_properties(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import set_clip_properties
    tl = _ed_load(a)
    props = {k: a[k] for k in ("duration_frames", "trim_start_frame", "trim_end_frame", "speed",
                               "volume", "opacity", "fade_in_frames", "fade_out_frames", "fade_color",
                               "text_content", "transform", "crop", "text_style", "chroma_key",
                               "transition", "color", "effects", "audio_fx", "blend_mode", "shape")
             if k in a}
    n = set_clip_properties(tl, list(a["clip_ids"]), **props)
    return {**_ed_save(tl, a), "updated": n}


def _collect_effect(a: dict[str, Any], param_keys: tuple[str, ...]) -> dict[str, Any]:
    """Build an effect dict from either a nested `effect` object or flat type+params."""
    effect = dict(a["effect"]) if isinstance(a.get("effect"), dict) else {}
    if a.get("type") and "type" not in effect:
        effect["type"] = a["type"]
    for k in param_keys:
        if k in a and k not in effect:
            effect[k] = a[k]
    return effect


def _h_editor_add_effect(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import add_effect
    tl = _ed_load(a)
    effect = _collect_effect(a, ("amount", "angle", "degrees", "size"))
    n = add_effect(tl, list(a["clip_ids"]), effect)
    if n <= 0:
        return {"error": "no effect added (clip not found or missing effect type)"}
    return {**_ed_save(tl, a), "effects_added": n}


def _h_editor_add_audio_effect(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import add_audio_effect
    tl = _ed_load(a)
    effect = _collect_effect(a, ("db", "target_lufs", "amount", "freq", "threshold",
                                 "ratio", "limit", "low", "mid", "high"))
    n = add_audio_effect(tl, list(a["clip_ids"]), effect)
    if n <= 0:
        return {"error": "no audio effect added (clip not found or missing effect type)"}
    return {**_ed_save(tl, a), "audio_effects_added": n}


def _h_media_scope(a: dict[str, Any]) -> dict[str, Any]:
    from ..media.scopes import generate_scope
    out = generate_scope(a["input"], a["out"], scope_type=a.get("scope_type", "waveform"),
                         at_time=float(a.get("at_time", 0.0)))
    return {"scope": out} if out else {"error": "scope generation failed (check input path)"}


def _h_editor_speed_ramp(a: dict[str, Any]) -> dict[str, Any]:
    from pathlib import Path
    from ..editor.timeline import _new_id
    from ..media.speed_ramp import ramp_output_frames, speed_ramp
    tl = _ed_load(a)
    found = tl.find_clip(a["clip_id"])
    if not found:
        return {"error": "clip not found"}
    clip = found[1]
    if clip.media_type != "video":
        return {"error": "only video clips can be speed-ramped"}
    segs: list[dict[str, Any]] = []           # sequential {speed, frames} → source-frame ranges
    cursor = clip.trim_start_frame
    for seg in (a.get("segments") or []):
        if not isinstance(seg, dict):
            continue
        n = int(seg.get("frames", 0))
        if n <= 0:
            continue
        segs.append({"start_frame": cursor, "end_frame": cursor + n,
                     "speed": float(seg.get("speed", 1.0))})
        cursor += n
    if not segs:
        return {"error": "no valid segments (each needs frames>0 and a speed)"}
    md = Path(a["project"]).resolve().parent / "media"
    md.mkdir(parents=True, exist_ok=True)
    out = str(md / f"ramp_{_new_id()}.mp4")
    res = speed_ramp(clip.media_ref, out, segs, tl.fps)
    if not res:
        return {"error": "speed ramp failed"}
    clip.media_ref = res                       # the ramped file IS the clip now
    clip.trim_start_frame = 0
    clip.speed = 1.0
    clip.duration_frames = ramp_output_frames(segs, tl.fps)
    return {**_ed_save(tl, a), "ramped": res, "output_frames": clip.duration_frames}


def _h_editor_set_track_matte(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import set_track_matte
    tl = _ed_load(a)
    ok = set_track_matte(tl, a["fill_clip_id"], a.get("matte_clip_id"),
                         matte_type=a.get("matte_type", "luma"), invert=bool(a.get("invert", False)))
    if not ok:
        return {"error": "set_track_matte failed (fill or matte clip not found)"}
    return {**_ed_save(tl, a), "applied": True}


def _h_editor_stabilize_clip(a: dict[str, Any]) -> dict[str, Any]:
    from pathlib import Path
    from ..editor.timeline import _new_id
    from ..media.stabilize import stabilize_video, vidstab_available
    if not vidstab_available():
        return {"error": "stabilization unavailable (this ffmpeg build lacks libvidstab)"}
    tl = _ed_load(a)
    found = tl.find_clip(a["clip_id"])
    if not found:
        return {"error": "clip not found"}
    clip = found[1]
    if clip.media_type != "video":
        return {"error": "only video clips can be stabilized"}
    md = Path(a["project"]).resolve().parent / "media"
    md.mkdir(parents=True, exist_ok=True)
    out = str(md / f"stab_{_new_id()}.mp4")
    res = stabilize_video(clip.media_ref, out, smoothing=int(a.get("smoothing", 10)),
                          shakiness=int(a.get("shakiness", 5)))
    if not res:
        return {"error": "stabilization failed"}
    clip.media_ref = res                            # swap to the stabilized media (frame-aligned with source)
    return {**_ed_save(tl, a), "stabilized": res, "clip_id": clip.id}


def _h_editor_blur_region(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import add_effect
    tl = _ed_load(a)
    typ = "region_pixelate" if a.get("mode") == "pixelate" else "region_blur"
    eff: dict[str, Any] = {"type": typ, "x": float(a.get("x", 0.0)), "y": float(a.get("y", 0.0)),
                           "w": float(a.get("w", 0.3)), "h": float(a.get("h", 0.3)),
                           "shape": "ellipse" if a.get("shape") == "ellipse" else "rect"}
    if "amount" in a:
        eff["amount"] = a["amount"]
    n = add_effect(tl, list(a["clip_ids"]), eff)
    if n <= 0:
        return {"error": "no region mask added (clip not found)"}
    return {**_ed_save(tl, a), "effects_added": n}


def _h_editor_dip_transition(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import dip_transition
    tl = _ed_load(a)
    ok = dip_transition(tl, a["out_clip_id"], a["in_clip_id"], int(a.get("frames", 15)),
                        color=a.get("color", "black"))
    if not ok:
        return {"error": "dip_transition failed (a clip id was not found)"}
    return {**_ed_save(tl, a), "applied": True}


def _h_editor_add_marker(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import add_marker
    tl = _ed_load(a)
    m = add_marker(tl, int(a["frame"]), name=a.get("name", ""), color=a.get("color", "green"),
                   comment=a.get("comment", ""), duration_frames=int(a.get("duration_frames", 0)))
    return {**_ed_save(tl, a), "marker": m}


def _h_editor_remove_markers(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import clear_markers, remove_markers
    tl = _ed_load(a)
    n = clear_markers(tl) if a.get("all") else remove_markers(tl, [int(f) for f in a.get("frames", [])])
    return {**_ed_save(tl, a), "removed": n}


def _h_editor_export_chapters(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.project import export_chapters, load_project
    out = export_chapters(load_project(a["project"]), a["out"], fmt=a.get("format", "youtube"))
    return {"chapters": out}


def _h_editor_add_adjustment_layer(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import add_adjustment_layer
    tl = _ed_load(a)
    clip = add_adjustment_layer(
        tl, int(a.get("track_index", 1)), int(a["start_frame"]), int(a["duration_frames"]),
        color=a.get("color") if isinstance(a.get("color"), dict) else None,
        effects=a.get("effects") if isinstance(a.get("effects"), list) else None,
        lut=a.get("lut"))
    return {**_ed_save(tl, a), "added_clip_id": clip.id}


def _h_editor_selective_color(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import selective_color
    tl = _ed_load(a)
    vals = a.get("values")
    if not isinstance(vals, list):                 # accept flat cyan/magenta/yellow/black too
        vals = [float(a.get("cyan", 0.0)), float(a.get("magenta", 0.0)),
                float(a.get("yellow", 0.0)), float(a.get("black", 0.0))]
    n = selective_color(tl, list(a["clip_ids"]), a["family"], vals)
    if n <= 0:
        return {"error": "no clips updated (check clip_ids / values)"}
    return {**_ed_save(tl, a), "updated": n}


def _h_editor_apply_lut(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import apply_lut
    tl = _ed_load(a)
    n = apply_lut(tl, list(a["clip_ids"]), a.get("lut"))
    return {**_ed_save(tl, a), "updated": n}


def _h_editor_set_auto_duck(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import set_auto_duck
    tl = _ed_load(a)
    cfg = set_auto_duck(tl, a.get("music_track"), a.get("voice_track"),
                        threshold=float(a.get("threshold", 0.03)),
                        ratio=float(a.get("ratio", 8.0)),
                        release_ms=int(a.get("release_ms", 250)))
    return {**_ed_save(tl, a), "auto_duck": cfg}


def _h_editor_split(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import split_clip
    tl = _ed_load(a)
    res = split_clip(tl, a["clip_id"], int(a["at_frame"]))
    if not res:
        return {"error": "split failed (clip not found or at_frame out of bounds)"}
    return {**_ed_save(tl, a), "split_ids": [res[0].id, res[1].id]}


def _h_editor_remove(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import remove_clips
    tl = _ed_load(a)
    n = remove_clips(tl, list(a["clip_ids"]))
    return {**_ed_save(tl, a), "removed": n}


def _h_editor_move(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import move_clip
    tl = _ed_load(a)
    ok = move_clip(tl, a["clip_id"], to_track=a.get("to_track"), to_frame=a.get("to_frame"))
    return {**_ed_save(tl, a), "moved": ok}


def _h_editor_ripple_delete(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import ripple_delete_range
    tl = _ed_load(a)
    removed = ripple_delete_range(tl, int(a["track_index"]), int(a["start"]), int(a["end"]))
    return {**_ed_save(tl, a), "frames_removed": removed}


def _h_editor_slip_clip(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import slip_clip
    tl = _ed_load(a)
    ok = slip_clip(tl, a["clip_id"], int(a["frames"]))
    return {**_ed_save(tl, a), "slipped": ok} if ok else {"error": "slip failed (clip not found)"}


def _h_editor_roll_edit(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import roll_edit
    tl = _ed_load(a)
    ok = roll_edit(tl, a["clip_id"], int(a["frames"]))
    return {**_ed_save(tl, a), "rolled": ok} if ok else {"error": "roll failed (no adjacent next clip)"}


def _h_editor_slide_clip(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import slide_clip
    tl = _ed_load(a)
    ok = slide_clip(tl, a["clip_id"], int(a["frames"]))
    return {**_ed_save(tl, a), "slid": ok} if ok else {"error": "slide failed (needs adjacent clips both sides)"}


def _h_editor_set_keyframes(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.timeline import set_keyframes
    tl = _ed_load(a)
    ok = set_keyframes(tl, a["clip_id"], a["property"], list(a["keys"]),
                       interp=a.get("interp", "smooth"))
    if not ok:
        return {"error": "set_keyframes failed (clip not found or bad property)"}
    return _ed_save(tl, a)


def _ed_media_path(a: dict[str, Any], ext: str) -> str:
    from pathlib import Path
    from ..editor.timeline import _new_id
    md = Path(a["project"]).resolve().parent / "media"
    md.mkdir(parents=True, exist_ok=True)
    return str(md / f"gen_{_new_id()}.{ext}")


def _ed_add_generated(a: dict[str, Any], media: str, media_type: str) -> dict[str, Any]:
    from ..editor.timeline import Clip, add_clip
    tl = _ed_load(a)
    clip = add_clip(tl, int(a.get("track_index", 0)),
                    Clip(media_ref=media, media_type=media_type,
                         start_frame=int(a.get("start_frame", 0)),
                         duration_frames=int(a.get("duration_frames", 90))))
    return {**_ed_save(tl, a), "added_clip_id": clip.id, "media": media}


def _h_editor_generate_image(a: dict[str, Any]) -> dict[str, Any]:
    from ..generate.cinematic import build_visual_prompt
    from ..generate.gen_image import gen_available, generate_image
    if not gen_available():
        return {"error": "image generation not configured (set GEN_IMAGE_API_KEY)"}
    prompt = build_visual_prompt(a["prompt"]) if a.get("cinematic", True) else a["prompt"]
    img = generate_image(prompt, _ed_media_path(a, "png"))
    return _ed_add_generated(a, img, "image") if img else {"error": "image generation failed"}


def _h_editor_generate_video(a: dict[str, Any]) -> dict[str, Any]:
    from ..generate.cinematic import build_visual_prompt
    from ..generate.gen_video import gen_video_available, generate_video
    if not gen_video_available():
        return {"error": "video generation not configured (set GEN_VIDEO_API_KEY)"}
    prompt = build_visual_prompt(a["prompt"]) if a.get("cinematic", True) else a["prompt"]
    vid = generate_video(prompt, _ed_media_path(a, "mp4"),
                         duration=int(a.get("duration", 5)), aspect_ratio=a.get("aspect_ratio", "9:16"))
    return _ed_add_generated(a, vid, "video") if vid else {"error": "video generation failed"}


def _h_editor_render(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.project import load_project
    from ..editor.render import render_timeline
    out = render_timeline(load_project(a["project"]), a["out"], codec=a.get("codec", "h264"))
    return {"rendered": out} if out else {"error": "render failed"}


def _h_editor_undo(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.project import undo
    tl = undo(a["project"])
    return tl.to_dict() if tl else {"error": "nothing to undo"}


def _h_editor_export_edl(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.project import export_edl, load_project
    return {"edl": export_edl(load_project(a["project"]), a["out"])}


def _h_editor_add_captions(a: dict[str, Any]) -> dict[str, Any]:
    from ..editor.captions import captions_to_timeline
    tl = _ed_load(a)
    n = captions_to_timeline(tl, a["media_ref"], track_index=int(a.get("track_index", 2)),
                             start_frame=int(a.get("start_frame", 0)))
    if n <= 0:
        return {"error": "no captions added (needs faster-whisper + audible speech)"}
    return {**_ed_save(tl, a), "caption_clips": n}


def _h_publish_reel(a: dict[str, Any]) -> dict[str, Any]:
    from ..publish.instagram import publisher_from_env
    pub = publisher_from_env()
    if not pub:
        return {"error": "Instagram not configured (set INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN)"}
    return pub.upload_reel(a["video_url"], caption=a.get("caption", ""))


def _h_list_jobs(a: dict[str, Any]) -> dict[str, Any]:
    from ..models import JobStatus
    with _queue() as q:
        status = JobStatus(a["status"]) if a.get("status") else None
        jobs = q.list(status, int(a.get("limit", 50)))
        return {"count": len(jobs), "jobs": [_job_summary(j) for j in jobs]}


def _h_job_detail(a: dict[str, Any]) -> dict[str, Any]:
    with _queue() as q:
        job = q.get(int(a["id"]))
        if not job:
            return {"found": False, "id": a.get("id")}
        u = (job.payload.get("understand") or {}).get("understanding") or {}
        meta = (job.payload.get("publish") or {}).get("metadata") or {}
        clips = (job.payload.get("clip") or {}).get("clips") or []
        likeness = (u.get("flags") or {}).get("likeness") or []
        events = [dict(e) for e in q.events(job.id)][-25:]
        return {
            "found": True,
            "job": _job_summary(job),
            "payload_stages": list(job.payload.keys()),
            "understanding": {
                "summary": u.get("summary"),
                "topics": u.get("topics") or [],
                "likeness_flag": "identifiable_person" in likeness,
                "highlight_candidates": u.get("highlight_candidates") or [],
            },
            "metadata": meta,
            "clips": clips,
            "events": events,
        }


def _h_counts(a: dict[str, Any]) -> dict[str, Any]:
    with _queue() as q:
        return q.counts()


def _h_run_engine(a: dict[str, Any]) -> dict[str, Any]:
    from ..engine import Engine
    from ..models import JobStatus
    with _queue() as q:
        steps = Engine(q).drain(max_steps=int(a.get("max_steps", 50)))
        return {
            "steps": steps,
            "counts": q.counts(),
            "awaiting_approval": [j.id for j in q.list(JobStatus.BLOCKED_APPROVAL)],
            "needs_attention": [j.id for j in q.list(JobStatus.NEEDS_ATTENTION)],
        }


def _h_approve(a: dict[str, Any]) -> dict[str, Any]:
    with _queue() as q:
        return {"job": _job_summary(q.approve(int(a["id"])))}


def _h_reject(a: dict[str, Any]) -> dict[str, Any]:
    with _queue() as q:
        return {"job": _job_summary(q.reject(int(a["id"]), a.get("reason", "")))}


def _h_requeue(a: dict[str, Any]) -> dict[str, Any]:
    with _queue() as q:
        return {"job": _job_summary(q.requeue(int(a["id"])))}


def _h_record_strike(a: dict[str, Any]) -> dict[str, Any]:
    with _queue() as q:
        ch = q.record_strike(a["channel"], a.get("platform", "youtube"))
        return {"channel": ch.channel, "strikes": ch.strikes, "paused": ch.paused}


def _h_doctor(a: dict[str, Any]) -> dict[str, Any]:
    from ..doctor import check_readiness
    return check_readiness()


def _h_get_settings(a: dict[str, Any]) -> dict[str, Any]:
    from .. import config as cfg
    return cfg.Settings.load(cfg.settings_path()).to_dict()


def _h_set_settings(a: dict[str, Any]) -> dict[str, Any]:
    from .. import config as cfg
    current = cfg.Settings.load(cfg.settings_path()).to_dict()
    merged = cfg.merge_settings(current, a)
    s = cfg.Settings.from_dict(merged)
    s.save(cfg.settings_path())  # save() creates the parent dir
    return {"settings": s.to_dict()}


# ── tool registry ────────────────────────────────────────────────────────────
# Each tool: description, schema (JSON-Schema properties), required arg names,
# handler(arguments) -> json-serializable result.
_STR = {"type": "string"}
_INT = {"type": "integer"}

TOOLS: dict[str, dict[str, Any]] = {
    # read / understand (stateless)
    "probe": {
        "description": "Return source metadata (duration, fps, resolution, codec, audio).",
        "schema": {"path": _STR},
        "required": ["path"],
        "handler": lambda a: vars(signals.probe(a["path"])),
    },
    "extract_signals": {
        "description": "Cheap ffmpeg signals: scene cuts, silence, loudness, shots/min.",
        "schema": {"path": _STR},
        "required": ["path"],
        "handler": lambda a: signals.extract_signals(a["path"]),
    },
    "understand_meta": {
        "description": "Preview the cost/shape of an understanding pass (no Claude call).",
        "schema": {"path": _STR},
        "required": ["path"],
        "handler": lambda a: understanding_meta(a["path"]),
    },
    "understand_video": {
        "description": "Holistic Understanding object + keyframe paths for a video.",
        "schema": {"path": _STR},
        "required": ["path"],
        "handler": lambda a: understand_video(a["path"]).to_dict(),
    },
    # pipeline control (drive the real job store)
    "enqueue": {
        "description": "Add a long-form source to the pipeline. section A=paid-clipping/DFY, "
                       "B=faceless funnel, C=ad-share. rights_tag owned|licensed|cc|third_party.",
        "schema": {"source_ref": _STR, "section": _STR, "rights_tag": _STR,
                   "channel": _STR, "idempotency_key": _STR},
        "required": ["source_ref"],
        "handler": _h_enqueue,
    },
    "enqueue_folder": {
        "description": "Batch-enqueue every video in a folder (done-for-you throughput). "
                       "Idempotent per file path, so it's safe to re-scan as new files arrive.",
        "schema": {"folder": _STR, "section": _STR, "rights_tag": _STR,
                   "channel": _STR, "recursive": {"type": "boolean"}},
        "required": ["folder"],
        "handler": _h_enqueue_folder,
    },
    "list_profiles": {
        "description": "List saved DFY templates (per-client presets: section, rights, channel, "
                       "voice, music, length).",
        "schema": {},
        "required": [],
        "handler": _h_list_profiles,
    },
    "save_profile": {
        "description": "Create/update a DFY template. section A/B/C, rights owned|licensed|cc|"
                       "third_party; voice/bgm_path/target_seconds apply to generated Section B/C.",
        "schema": {"name": _STR, "section": _STR, "rights": _STR, "channel": _STR,
                   "voice": _STR, "bgm_path": _STR, "target_seconds": _INT},
        "required": ["name"],
        "handler": _h_save_profile,
    },
    "delete_profile": {
        "description": "Delete a saved DFY template by name.",
        "schema": {"name": _STR},
        "required": ["name"],
        "handler": _h_delete_profile,
    },
    "enqueue_with_profile": {
        "description": "Enqueue a source/topic using a saved DFY template's settings (section, "
                       "rights, channel + voice/music/length for generated sections).",
        "schema": {"source_ref": _STR, "profile": _STR},
        "required": ["source_ref", "profile"],
        "handler": _h_enqueue_with_profile,
    },
    "list_jobs": {
        "description": "List jobs (optionally filter by status), newest first.",
        "schema": {"status": _STR, "limit": _INT},
        "required": [],
        "handler": _h_list_jobs,
    },
    "job_detail": {
        "description": "Full detail for one job: status, understanding summary, likeness flag, "
                       "generated title/caption/hashtags, clip paths, and recent events.",
        "schema": {"id": _INT},
        "required": ["id"],
        "handler": _h_job_detail,
    },
    "job_counts": {
        "description": "Count of jobs by status (pending/running/blocked_approval/...).",
        "schema": {},
        "required": [],
        "handler": _h_counts,
    },
    "run_engine": {
        "description": "Drive pending jobs through the pipeline until they park (approval gate / "
                       "done / needs-attention). Returns steps run + which jobs await approval.",
        "schema": {"max_steps": _INT},
        "required": [],
        "handler": _h_run_engine,
    },
    "approve": {
        "description": "Approve a job waiting at the human gate → it proceeds to publish. "
                       "Use only when the operator has authorized unattended approval.",
        "schema": {"id": _INT},
        "required": ["id"],
        "handler": _h_approve,
    },
    "reject": {
        "description": "Reject a job at the approval gate (it will not publish).",
        "schema": {"id": _INT, "reason": _STR},
        "required": ["id"],
        "handler": _h_reject,
    },
    "requeue": {
        "description": "Reset a needs-attention/paused job to retry its current stage.",
        "schema": {"id": _INT},
        "required": ["id"],
        "handler": _h_requeue,
    },
    "record_strike": {
        "description": "Record a copyright strike on a channel; auto-pauses it at the threshold "
                       "(termination = 3 strikes / 90 days).",
        "schema": {"channel": _STR, "platform": _STR},
        "required": ["channel"],
        "handler": _h_record_strike,
    },
    "resync_subtitles": {
        "description": "Auto-align an SRT subtitle file to a media file's audio (FFT cross-"
                       "correlation, ffsubsync technique). Writes the shifted SRT.",
        "schema": {"srt_path": _STR, "audio_path": _STR, "out_path": _STR},
        "required": ["srt_path", "audio_path"],
        "handler": _h_resync_subtitles,
    },
    "download_source": {
        "description": "Download a source video from a URL (yt-dlp) into the media dir so it "
                       "can be clipped (Section A). RIGHTS: only for content you own or are "
                       "authorized to repurpose. Returns {available, path, title, duration_s}.",
        "schema": {"url": _STR, "out_dir": _STR, "max_height": _INT},
        "required": ["url"],
        "handler": _h_download_source,
    },
    # ── timeline editor (palmier-pro parity) — stateful over a project JSON ──
    "editor_new": {
        "description": "Create a new timeline-editor project (JSON) — palmier-style multi-track "
                       "editor. Returns the empty timeline.",
        "schema": {"project": _STR, "fps": _INT, "width": _INT, "height": _INT},
        "required": ["project"], "handler": _h_editor_new,
    },
    "editor_get_timeline": {
        "description": "Read the editor project's timeline (fps, size, tracks, clips with frames "
                       "+ properties).",
        "schema": {"project": _STR}, "required": ["project"], "handler": _h_editor_get,
    },
    "editor_add_clip": {
        "description": "Place a media file on the timeline at a frame for a duration (overwrites "
                       "overlaps). Returns added_clip_id.",
        "schema": {"project": _STR, "media_ref": _STR, "media_type": _STR, "track_index": _INT,
                   "start_frame": _INT, "duration_frames": _INT, "trim_start_frame": _INT},
        "required": ["project", "media_ref", "start_frame", "duration_frames"],
        "handler": _h_editor_add_clip,
    },
    "editor_add_text": {
        "description": "Add a styled text/title/caption clip — Essential Graphics. Supports a "
                       "stroke (border_width/border_color), a background BOX behind the text "
                       "(box=true, box_color, box_opacity, box_border = the caption-highlight style) "
                       "and a drop shadow (shadow=true, shadow_color, shadow_x/shadow_y).",
        "schema": {"project": _STR, "content": _STR, "track_index": _INT, "start_frame": _INT,
                   "duration_frames": _INT, "font": _STR, "font_size": _INT, "color": _STR,
                   "alignment": _STR, "border_width": _INT, "border_color": _STR,
                   "box": {"type": "boolean"}, "box_color": _STR, "box_opacity": {"type": "number"},
                   "box_border": _INT, "shadow": {"type": "boolean"}, "shadow_color": _STR,
                   "shadow_x": _INT, "shadow_y": _INT},
        "required": ["project", "content", "start_frame", "duration_frames"],
        "handler": _h_editor_add_text,
    },
    "editor_add_shape": {
        "description": "Add an Essential-Graphics shape clip (rect|ellipse) — banners, lower-thirds, "
                       "callout boxes. Position/size via transform{center_x,center_y,width,height} "
                       "(normalized 0..1), color via fill, opacity 0..1. Put it on its own track. "
                       "Refine with set_clip_properties (fades/blend_mode/effects) on the returned id.",
        "schema": {"project": _STR, "track_index": _INT, "start_frame": _INT, "duration_frames": _INT,
                   "shape_type": _STR, "fill": _STR, "opacity": {"type": "number"},
                   "transform": {"type": "object"}},
        "required": ["project", "start_frame", "duration_frames"],
        "handler": _h_editor_add_shape,
    },
    "editor_set_clip_properties": {
        "description": "Batch-apply properties to clips: duration_frames, trim_*, speed, volume, "
                       "opacity, fade_*, text_content, transform{center_x,center_y,width,height,"
                       "rotation,flip_h,flip_v}, crop, text_style, chroma_key, transition, "
                       "color (Lumetri grade {brightness,contrast,saturation,gamma,temperature,grain, "
                       "curves:{master|red|green|blue:'x/y x/y'}, lift/gamma_rgb/gain:[r,g,b]}), "
                       "effects (replace video FX stack), audio_fx (replace audio FX stack), "
                       "blend_mode (multiply|screen|overlay|darken|lighten|color_dodge|color_burn|"
                       "hard_light|soft_light|difference|exclusion|add|subtract|... ; '' clears).",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR},
                   "speed": {"type": "number"}, "volume": {"type": "number"},
                   "opacity": {"type": "number"}, "transform": {"type": "object"},
                   "effects": {"type": "array", "items": {"type": "object"}},
                   "audio_fx": {"type": "array", "items": {"type": "object"}}, "blend_mode": _STR},
        "required": ["project", "clip_ids"], "handler": _h_editor_set_properties,
    },
    "editor_add_effect": {
        "description": "Append a Premiere-style video effect to clips' FX stack (applied in order). "
                       "type ∈ gaussian_blur(amount=sigma)|box_blur(amount)|sharpen(amount)|"
                       "vignette(angle)|hflip|vflip|invert|grayscale|sepia|hue(degrees)|"
                       "vibrance(amount)|pixelate(size)|edges|noise(amount). Pass `effect`:{type,...} "
                       "or flat `type`+params. Returns effects_added.",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR},
                   "effect": {"type": "object"}, "type": _STR, "amount": {"type": "number"},
                   "angle": {"type": "number"}, "degrees": {"type": "number"}, "size": {"type": "number"}},
        "required": ["project", "clip_ids"], "handler": _h_editor_add_effect,
    },
    "editor_add_audio_effect": {
        "description": "Append a Premiere Essential-Sound audio effect to clips' audio FX stack "
                       "(applied in order). type ∈ gain(db)|normalize(target_lufs)|denoise(amount)|"
                       "highpass(freq)|lowpass(freq)|bass(db)|treble(db)|eq(low,mid,high dB)|"
                       "compressor(threshold,ratio)|limiter(limit)|deesser|reverb(amount). Pass "
                       "`effect`:{type,...} or flat type+params. Returns audio_effects_added.",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR},
                   "effect": {"type": "object"}, "type": _STR, "db": {"type": "number"},
                   "target_lufs": {"type": "number"}, "amount": {"type": "number"},
                   "freq": {"type": "number"}, "threshold": {"type": "number"},
                   "ratio": {"type": "number"}, "limit": {"type": "number"},
                   "low": {"type": "number"}, "mid": {"type": "number"}, "high": {"type": "number"}},
        "required": ["project", "clip_ids"], "handler": _h_editor_add_audio_effect,
    },
    "generate_scope": {
        "description": "Lumetri Scopes: render a scope image of a video frame so you can inspect its "
                       "luma/colour distribution (spot crushed blacks, colour casts, clipping) — then "
                       "Read the image. scope_type=waveform|rgbparade|vectorscope|histogram|levels; "
                       "at_time = seconds into the file. Returns {scope: path}.",
        "schema": {"input": _STR, "out": _STR, "scope_type": _STR, "at_time": {"type": "number"}},
        "required": ["input", "out"], "handler": _h_media_scope,
    },
    "editor_speed_ramp": {
        "description": "Speed ramp / time remap a VIDEO clip: play its source through a sequence of "
                       "constant-speed segments (slow-mo + speed-up) baked into a new file. "
                       "segments=[{speed, frames}] where frames = SOURCE frames at that speed "
                       "(speed>1 faster, <1 slow-mo) e.g. [{speed:1,frames:30},{speed:0.3,frames:15},"
                       "{speed:1,frames:30}]. Updates the clip's duration. Returns output_frames.",
        "schema": {"project": _STR, "clip_id": _STR,
                   "segments": {"type": "array", "items": {"type": "object"}}},
        "required": ["project", "clip_id", "segments"], "handler": _h_editor_speed_ramp,
    },
    "editor_set_track_matte": {
        "description": "Track Matte Key: mask a fill clip by another clip (an image/video matte) — "
                       "the matte's luma (bright=visible) or alpha becomes the fill's transparency. "
                       "Use for reveal-through-shape / video-in-graphic. matte_type=luma|alpha, "
                       "invert flips it; omit matte_clip_id to clear. The matte clip is consumed "
                       "(not shown). Returns applied.",
        "schema": {"project": _STR, "fill_clip_id": _STR, "matte_clip_id": _STR,
                   "matte_type": _STR, "invert": {"type": "boolean"}},
        "required": ["project", "fill_clip_id"], "handler": _h_editor_set_track_matte,
    },
    "editor_stabilize_clip": {
        "description": "Warp Stabilizer: stabilize a shaky VIDEO clip's source (ffmpeg vidstab "
                       "two-pass detect→transform), swapping the clip to the stabilized file. "
                       "smoothing (frames to average, higher=steadier+more crop, default 10), "
                       "shakiness 1-10 (default 5). One-time pre-process; re-render to see it.",
        "schema": {"project": _STR, "clip_id": _STR, "smoothing": _INT, "shakiness": _INT},
        "required": ["project", "clip_id"], "handler": _h_editor_stabilize_clip,
    },
    "editor_blur_region": {
        "description": "Mask & blur (or pixelate) a rectangular OR elliptical region of clips — "
                       "face/logo privacy blur. x,y,w,h are normalized 0..1 of the clip frame. "
                       "mode=blur|pixelate; shape=rect|ellipse (ellipse feathers — best for faces); "
                       "amount = blur sigma or pixel-block size. Appends to the clip FX stack (add "
                       "more calls to mask multiple regions). Returns effects_added.",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR},
                   "x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"},
                   "h": {"type": "number"}, "amount": {"type": "number"}, "mode": _STR, "shape": _STR},
        "required": ["project", "clip_ids", "x", "y", "w", "h"], "handler": _h_editor_blur_region,
    },
    "editor_dip_transition": {
        "description": "Premiere 'Dip to Black/White' at a cut: the outgoing clip fades out to `color` "
                       "and the incoming clip fades in from it, over `frames` each. color=black|white|"
                       "any ffmpeg color (default black). (Crossfade/slide/wipe between clips → set the "
                       "incoming clip's `transition` instead.)",
        "schema": {"project": _STR, "out_clip_id": _STR, "in_clip_id": _STR, "frames": _INT,
                   "color": _STR},
        "required": ["project", "out_clip_id", "in_clip_id"], "handler": _h_editor_dip_transition,
    },
    "editor_add_marker": {
        "description": "Add a timeline marker at a frame (point or range via duration_frames) — for "
                       "chapters/comments/segmentation. name+color+comment optional. Export with "
                       "editor_export_chapters.",
        "schema": {"project": _STR, "frame": _INT, "name": _STR, "color": _STR, "comment": _STR,
                   "duration_frames": _INT},
        "required": ["project", "frame"], "handler": _h_editor_add_marker,
    },
    "editor_remove_markers": {
        "description": "Remove timeline markers at the given frames, or all of them with all=true.",
        "schema": {"project": _STR, "frames": {"type": "array", "items": _INT},
                   "all": {"type": "boolean"}},
        "required": ["project"], "handler": _h_editor_remove_markers,
    },
    "editor_export_chapters": {
        "description": "Export timeline markers as chapters. format='youtube' → a '0:00 Title' "
                       "description block (paste into a YouTube description); format='ffmetadata' → "
                       "an FFMETADATA file to embed chapter markers in the video. Returns {chapters: path}.",
        "schema": {"project": _STR, "out": _STR, "format": _STR},
        "required": ["project", "out"], "handler": _h_editor_export_chapters,
    },
    "editor_add_adjustment_layer": {
        "description": "Add a Premiere adjustment layer — a media-less clip whose color grade / FX "
                       "stack / LUT apply to EVERYTHING BELOW it on the timeline, within its window. "
                       "Pass color{...Lumetri}, effects[{type,...}], and/or lut. Put it on its own "
                       "upper track_index (default 1). Returns added_clip_id; refine with "
                       "set_clip_properties / add_effect / apply_lut on that id.",
        "schema": {"project": _STR, "track_index": _INT, "start_frame": _INT,
                   "duration_frames": _INT, "color": {"type": "object"},
                   "effects": {"type": "array", "items": {"type": "object"}}, "lut": _STR},
        "required": ["project", "start_frame", "duration_frames"],
        "handler": _h_editor_add_adjustment_layer,
    },
    "editor_selective_color": {
        "description": "Lumetri HSL Secondary: adjust only one colour family (qualifier). "
                       "family ∈ reds|yellows|greens|cyans|blues|magentas|whites|neutrals|blacks; "
                       "values=[cyan,magenta,yellow,black] each -1..1 (or flat cyan/magenta/yellow/"
                       "black args). E.g. push the sky's blues toward cyan, or darken reds. Merges "
                       "into the clip color grade. Returns updated.",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR}, "family": _STR,
                   "values": {"type": "array", "items": {"type": "number"}},
                   "cyan": {"type": "number"}, "magenta": {"type": "number"},
                   "yellow": {"type": "number"}, "black": {"type": "number"}},
        "required": ["project", "clip_ids", "family"], "handler": _h_editor_selective_color,
    },
    "editor_apply_lut": {
        "description": "Apply a Lumetri Creative LUT/'Look' to clips (merged into their color grade). "
                       "lut = a built-in look (warm|cool|teal_orange|vintage|bw) OR a path to a .cube "
                       "file; omit lut to clear. Returns updated count.",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR}, "lut": _STR},
        "required": ["project", "clip_ids"], "handler": _h_editor_apply_lut,
    },
    "editor_set_auto_duck": {
        "description": "Auto-duck (Essential Sound): sidechain-compress a music track by a voice "
                       "track so the music dips while the voiceover speaks. Pass music_track + "
                       "voice_track (must differ); omit them to clear. Optional threshold(0–0.9, "
                       "default 0.03), ratio(1–20, default 8), release_ms(default 250).",
        "schema": {"project": _STR, "music_track": _INT, "voice_track": _INT,
                   "threshold": {"type": "number"}, "ratio": {"type": "number"},
                   "release_ms": _INT},
        "required": ["project"], "handler": _h_editor_set_auto_duck,
    },
    "editor_split_clip": {
        "description": "Split a clip into two at a timeline frame (strictly between its bounds).",
        "schema": {"project": _STR, "clip_id": _STR, "at_frame": _INT},
        "required": ["project", "clip_id", "at_frame"], "handler": _h_editor_split,
    },
    "editor_slip_clip": {
        "description": "Slip edit: shift a clip's SOURCE in-point by `frames` (show a different part "
                       "of the source) without moving it on the timeline or changing its duration.",
        "schema": {"project": _STR, "clip_id": _STR, "frames": _INT},
        "required": ["project", "clip_id", "frames"], "handler": _h_editor_slip_clip,
    },
    "editor_roll_edit": {
        "description": "Roll edit: move the cut between this clip and the next (adjacent) clip by "
                       "`frames` — extends one, shortens the other; total span unchanged.",
        "schema": {"project": _STR, "clip_id": _STR, "frames": _INT},
        "required": ["project", "clip_id", "frames"], "handler": _h_editor_roll_edit,
    },
    "editor_slide_clip": {
        "description": "Slide edit: move a clip by `frames` keeping its content; the previous clip's "
                       "tail and next clip's head are trimmed to follow it (needs adjacent clips both "
                       "sides).",
        "schema": {"project": _STR, "clip_id": _STR, "frames": _INT},
        "required": ["project", "clip_id", "frames"], "handler": _h_editor_slide_clip,
    },
    "editor_remove_clips": {
        "description": "Remove clips by id.",
        "schema": {"project": _STR, "clip_ids": {"type": "array", "items": _STR}},
        "required": ["project", "clip_ids"], "handler": _h_editor_remove,
    },
    "editor_move_clip": {
        "description": "Move a clip to a new track and/or start frame.",
        "schema": {"project": _STR, "clip_id": _STR, "to_track": _INT, "to_frame": _INT},
        "required": ["project", "clip_id"], "handler": _h_editor_move,
    },
    "editor_ripple_delete": {
        "description": "Cut a frame range on a track and close the gap (ripple) — fast filler-word "
                       "removal.",
        "schema": {"project": _STR, "track_index": _INT, "start": _INT, "end": _INT},
        "required": ["project", "track_index", "start", "end"], "handler": _h_editor_ripple_delete,
    },
    "editor_set_keyframes": {
        "description": "Animate one clip property over time (palmier setKeyframes). property ∈ "
                       "opacity|volume|rotation|position|scale|crop; keys=[[clip_local_frame,*values]] "
                       "(opacity/volume/rotation→[f,v]; position/scale→[f,a,b]); interp linear|hold|smooth.",
        "schema": {"project": _STR, "clip_id": _STR, "property": _STR,
                   "keys": {"type": "array"}, "interp": _STR},
        "required": ["project", "clip_id", "property", "keys"], "handler": _h_editor_set_keyframes,
    },
    "editor_generate_image": {
        "description": "Generate an AI image (hosted, cinematic prompt) and add it to the timeline "
                       "as an image clip. Needs GEN_IMAGE_API_KEY. palmier generateImage parity.",
        "schema": {"project": _STR, "prompt": _STR, "track_index": _INT, "start_frame": _INT,
                   "duration_frames": _INT, "cinematic": {"type": "boolean"}},
        "required": ["project", "prompt"], "handler": _h_editor_generate_image,
    },
    "editor_generate_video": {
        "description": "Generate an AI video (hosted text-to-video) and add it to the timeline as a "
                       "clip. Needs GEN_VIDEO_API_KEY. palmier generateVideo parity (CPU stand-in for "
                       "the GPU models).",
        "schema": {"project": _STR, "prompt": _STR, "duration": _INT, "aspect_ratio": _STR,
                   "track_index": _INT, "start_frame": _INT, "duration_frames": _INT,
                   "cinematic": {"type": "boolean"}},
        "required": ["project", "prompt"], "handler": _h_editor_generate_video,
    },
    "editor_render": {
        "description": "Composite the editor project's timeline to a video (multi-track overlay, "
                       "audio mix, text). codec ∈ h264|hevc|prores. Returns {rendered: path}.",
        "schema": {"project": _STR, "out": _STR, "codec": _STR},
        "required": ["project", "out"], "handler": _h_editor_render,
    },
    "editor_undo": {
        "description": "Revert the most recent editor edit (palmier undo) — restores the "
                       "pre-edit timeline snapshot.",
        "schema": {"project": _STR}, "required": ["project"], "handler": _h_editor_undo,
    },
    "editor_export_edl": {
        "description": "Export a JSON edit-decision-list (interchange) of the timeline — every "
                       "clip's source + in/out + placement. Returns {edl: path}.",
        "schema": {"project": _STR, "out": _STR},
        "required": ["project", "out"], "handler": _h_editor_export_edl,
    },
    "editor_add_captions": {
        "description": "Transcribe a media file (whisper) and add the transcript to the timeline "
                       "as timed, editable TEXT clips (palmier addCaptions). Returns caption_clips.",
        "schema": {"project": _STR, "media_ref": _STR, "track_index": _INT, "start_frame": _INT},
        "required": ["project", "media_ref"], "handler": _h_editor_add_captions,
    },
    "publish_reel": {
        "description": "Publish a Reel to Instagram from a PUBLIC video URL (Meta Graph API). "
                       "Needs INSTAGRAM_USER_ID/ACCESS_TOKEN and the clip hosted at a public URL "
                       "(the Graph API can't take a local file).",
        "schema": {"video_url": _STR, "caption": _STR},
        "required": ["video_url"],
        "handler": _h_publish_reel,
    },
    "doctor": {
        "description": "Readiness report: what's configured (ffmpeg/whisper/SAPI/Anthropic key/"
                       "YouTube/Upload-Post), what each unlocks, and the next steps to first dollar.",
        "schema": {},
        "required": [],
        "handler": _h_doctor,
    },
    "get_settings": {
        "description": "Read the current app settings (auto_approve, guardrails, brain_model, ...).",
        "schema": {},
        "required": [],
        "handler": _h_get_settings,
    },
    "set_settings": {
        "description": "Update + persist app settings. auto_approve=true lets the pipeline publish "
                       "WITHOUT the human gate — enable only for trusted owned-source lanes "
                       "(docs/09 §5). 'guardrails' is an object of per-toggle booleans.",
        "schema": {"auto_approve": {"type": "boolean"}, "default_section": _STR,
                   "brain_model": _STR, "max_attempts": _INT,
                   "guardrails": {"type": "object"}},
        "required": [],
        "handler": _h_set_settings,
    },
}


def _input_schema(spec: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": spec.get("schema", {}),
        "required": spec.get("required", []),
    }


# ── JSON-RPC dispatch (transport-agnostic) ───────────────────────────────────
def _rpc_error(rid: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def handle_rpc(payload: dict[str, Any]) -> dict[str, Any]:
    # Guard non-object payloads (valid JSON like a batch array, scalar, or null)
    # so neither transport raises AttributeError on payload.get(...).
    if not isinstance(payload, dict):
        return _rpc_error(None, -32600, "invalid request: expected a JSON-RPC object")
    rid = payload.get("id")
    method = payload.get("method")
    params = payload.get("params") or {}

    if method == "initialize":
        return {"jsonrpc": "2.0", "id": rid, "result": {
            "protocolVersion": params.get("protocolVersion") or MCP_PROTOCOL_VERSION,
            "serverInfo": {"name": "clippilot", "version": __version__},
            "capabilities": {"tools": {"listChanged": False}},
        }}

    if method == "ping":
        return {"jsonrpc": "2.0", "id": rid, "result": {}}

    if method == "tools/list":
        tools = [{
            "name": name,
            "description": spec["description"],
            "inputSchema": _input_schema(spec),
        } for name, spec in TOOLS.items()]
        return {"jsonrpc": "2.0", "id": rid, "result": {"tools": tools}}

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        spec = TOOLS.get(name)
        if spec is None:
            return _rpc_error(rid, -32602, f"unknown tool: {name}")
        missing = [r for r in spec.get("required", []) if r not in args]
        if missing:
            return _rpc_error(rid, -32602, f"missing required argument(s): {', '.join(missing)}")
        try:
            result = spec["handler"](args)
        except Exception as exc:  # noqa: BLE001 — surface as an MCP tool error
            return {"jsonrpc": "2.0", "id": rid, "result": {
                "content": [{"type": "text", "text": f"{type(exc).__name__}: {exc}"}],
                "isError": True,
            }}
        return {"jsonrpc": "2.0", "id": rid, "result": {
            "content": [{"type": "text", "text": json.dumps(result)}],
            "isError": False,
        }}

    return _rpc_error(rid, -32601, f"method not found: {method}")


# ── HTTP transport (127.0.0.1) ───────────────────────────────────────────────
class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # silence default stderr logging
        pass

    def _send(self, obj: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802 — http.server API
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(_rpc_error(None, -32700, "parse error"), status=400)
            return
        self._send(handle_rpc(payload))

    def do_GET(self):  # noqa: N802 — simple health check
        self._send({"ok": True, "service": "clippilot-mcp", "version": __version__})


def make_server(host: str = "127.0.0.1", port: int = 19789) -> ThreadingHTTPServer:
    """Create (but don't start) the HTTP server. host is forced to loopback."""
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("refusing to bind a non-loopback host for the MCP server")
    return ThreadingHTTPServer((host, port), _Handler)


def serve(host: str = "127.0.0.1", port: int = 19789) -> None:
    srv = make_server(host, port)
    print(f"ClipPilot MCP (HTTP) on http://{host}:{port}/  (Ctrl-C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


def serve_in_thread(host: str = "127.0.0.1", port: int = 0) -> tuple[ThreadingHTTPServer, threading.Thread]:
    """Start the HTTP server on a background thread; returns (server, thread).
    port=0 picks a free port (read it from server.server_address)."""
    srv = make_server(host, port)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, t


if __name__ == "__main__":
    serve()
