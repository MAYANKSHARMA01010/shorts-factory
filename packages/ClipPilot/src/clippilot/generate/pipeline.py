"""generate_short(topic) — orchestrate topic → script → TTS → vertical video.

The Section B/C entry path: produces a finished vertical mp4 (+ the script and
narration WAV) that the engine then transcribes, captions, and publishes like any
other clip. Degrades gracefully — returns {"available": False, reason, script}
when SAPI/ffmpeg are missing, so the engine can fall back to a stub without
losing the generated script.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from . import assemble as assemblemod
from . import script as scriptmod
from .script import GenerateFn


def generate_short(topic: str, out_dir: str, generate_fn: Optional[GenerateFn] = None,
                   voice: Optional[str] = None, target_seconds: int = 35,
                   image: Optional[str] = None, bgm_path: Optional[str] = None,
                   bgm_volume: float = 0.12, mode: str = "standard",
                   facts_count: int = 5) -> dict[str, Any]:
    from ..media import signals, tts
    from ..media.ffmpeg import ffmpeg_available

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    sc = scriptmod.generate_script(topic, generate_fn, target_seconds,
                                   mode=mode, facts_count=facts_count)
    base = {"script": sc.get("script"), "title": sc.get("title"),
            "fallback_script": bool(sc.get("_fallback"))}

    if not tts.tts_available():
        return {"available": False, "reason": "TTS unavailable (Chatterbox venv or edge-tts)", **base}
    if not ffmpeg_available():
        return {"available": False, "reason": "ffmpeg unavailable", **base}

    wav = str(Path(out_dir) / "narration.wav")
    tres = tts.synthesize(sc["script"], wav, voice=voice)
    if not tres.get("available"):
        return {"available": False, "reason": f"TTS failed: {tres.get('reason')}", **base}

    duration = signals.probe(wav).duration_s
    mp4 = str(Path(out_dir) / "short.mp4")

    # Source RELEVANT b-roll so the short isn't a flat gradient. Best→fallback:
    #   real motion montage → per-phrase timed images → slideshow / stock video → gradient.
    from . import broll as brollmod
    from .script import _core_subject
    title = sc.get("title", "")
    # B-roll must match the SUBJECT, not the framing: searching "3 facts about octopuses"
    # returns worksheets/infographics, so strip the "N facts about" wrapper first.
    broll_subject = _core_subject(title) or title
    keywords = brollmod.keywords_from_script(broll_subject, sc["script"], generate_fn)
    broll_dir = str(Path(out_dir) / "broll")
    video, visual = None, "gradient"

    # Real-footage montage from free archives — best anti-slop visual; only fires when a
    # (free) PEXELS_API_KEY / PIXABAY_API_KEY is set, else falls through to stills.
    motion = brollmod.fetch_motion_broll(keywords, broll_dir)
    if motion["kind"] == "motion_clips":
        video = assemblemod.assemble_motion_montage(motion["paths"], wav, mp4)
        if video is not None:           # only label it if the montage actually rendered
            visual = "motion_montage"

    # Hosted-API generated cinematic stills (backlog #7) — only when GEN_IMAGE_API_KEY set.
    if video is None:
        gen = brollmod.fetch_gen_broll(keywords, broll_dir)
        if gen["kind"] == "gen_images":
            video = assemblemod.assemble_slideshow(gen["paths"], wav, mp4)
            if video is not None:
                visual = "gen_images"

    if video is None:
        timed = brollmod.fetch_timed_broll(sc["script"], broll_subject, duration, broll_dir, generate_fn)
        if timed["kind"] == "timed_images":
            video = assemblemod.assemble_timed_slideshow(timed["segments"], wav, mp4)
            visual = "timed_broll"
    if video is None:
        assets = brollmod.fetch_broll(keywords, broll_dir)
        if assets["kind"] == "video":
            video = assemblemod.assemble_broll_video(assets["paths"][0], wav, mp4)
            visual = "stock_video"
        elif assets["kind"] == "images":
            video = assemblemod.assemble_slideshow(assets["paths"], wav, mp4)
            visual = "image_slideshow"
    if video is None:  # no b-roll or compose failed → gradient + title card
        video = assemblemod.assemble_short(wav, mp4, image=image, title=title)
        visual = "gradient"
    if not video:
        return {"available": False, "reason": "assemble failed", **base}

    # Optional cleared/royalty-free music bed under the narration (user-supplied only).
    bgm = False
    if bgm_path and Path(bgm_path).exists():
        from ..media import edit
        mixed = edit.add_bgm(video, bgm_path, str(Path(out_dir) / "short_bgm.mp4"), bgm_volume)
        if mixed:
            video, bgm = mixed, True

    return {"available": True, "video_path": video, "audio_path": wav, "duration_s": duration,
            "visual": visual, "keywords": keywords, "bgm": bgm, **base}
