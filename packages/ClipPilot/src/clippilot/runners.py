"""Stage runners: the registry that maps each pipeline Stage to the code that
executes it.

Phase 0 ships **stubs** so the orchestration loop (claim -> run -> advance ->
gate -> publish) can be tested end-to-end before any media/ML dependency exists.
Phase 1 replaces these with real implementations:

    INGEST          -> yt-dlp / local copy (rights-tagged)
    TRANSCRIBE      -> faster-whisper
    FIND_HIGHLIGHTS -> Claude (the brain) over the transcript
    CLIP            -> FFmpeg cut + vertical reframe
    CAPTION         -> VideoCaptioner / ffsubsync burn-in
    COMPOSE         -> moviepy / hyperframes assemble
    PUBLISH         -> YouTube Data API v3 / IG Content Publishing

Each runner takes (job, queue) and returns a JSON-serializable dict stored under
job.payload[stage]. Raising an exception fails the stage (the engine retries).
"""
from __future__ import annotations

from typing import Any, Callable

from .models import Job, Stage

# A runner: (job, queue) -> result dict
Runner = Callable[[Job, Any], dict[str, Any]]


# ── Phase 0 stub runners ─────────────────────────────────────────────────────
def _stub(stage: Stage) -> Runner:
    def run(job: Job, queue: Any) -> dict[str, Any]:
        return {"stub": True, "stage": stage.value, "source_ref": job.source_ref}
    run.__name__ = f"stub_{stage.value}"
    return run


def _media_path(job: Job) -> str:
    """The working media for downstream stages: the ingest stage's `media_path`
    (a generated short for Section B/C) or the original source_ref (Section A)."""
    return (job.payload.get("ingest") or {}).get("media_path") or job.source_ref


def _ingest(job: Job, queue: Any) -> dict[str, Any]:
    # Section A: the source file IS the working media. Section B/C: GENERATE an
    # original short from the topic (source_ref) and use that as the working media
    # (the rest of the pipeline — transcribe/caption/publish — is identical).
    from .models import Section

    if job.section in (Section.FACELESS_FUNNEL, Section.AD_SHARE):
        from .media.ffmpeg import ffmpeg_available
        from .media.tts import tts_available
        if ffmpeg_available() and tts_available():
            from . import config as cfg
            from .generate.pipeline import generate_short
            from .publish.metadata import claude_text_generator
            gen = claude_text_generator(queue.settings)  # None unless a key is set
            out_dir = str(cfg.media_dir() / "generated" / f"job{job.id}")
            prof = job.payload.get("profile") or {}  # DFY template overrides (profiles.py)
            res = generate_short(
                job.source_ref, out_dir, generate_fn=gen,
                voice=prof.get("voice"),
                target_seconds=int(prof.get("target_seconds", 35)),
                bgm_path=(prof.get("bgm_path") or getattr(queue.settings, "bgm_path", "") or None),
                bgm_volume=getattr(queue.settings, "bgm_volume", 0.12),
                mode=str(prof.get("mode", "standard")),
                facts_count=int(prof.get("facts_count", 5)),
            )
            if res.get("available"):
                return {"stage": Stage.INGEST.value, "media_path": res["video_path"],
                        "generated": True, "title": res.get("title"),
                        "script": res.get("script"), "duration_s": res.get("duration_s"),
                        "visual": res.get("visual"), "bgm": res.get("bgm", False)}
            return {"stage": Stage.INGEST.value, "media_path": job.source_ref,
                    "generated": False, "available": False,
                    "reason": res.get("reason"), "script": res.get("script")}
        return {"stage": Stage.INGEST.value, "media_path": job.source_ref,
                "generated": False, "stub": True, "reason": "generation needs ffmpeg + SAPI"}

    # Section A — owned/authorized long-form source.
    return {"stage": Stage.INGEST.value, "media_path": job.source_ref, "generated": False}


def _extract_signals(job: Job, queue: Any) -> dict[str, Any]:
    # REAL ffmpeg signals (probe + scenes + silence + loudness). Returns
    # {"available": False, ...} for a missing file / no ffmpeg instead of raising,
    # so the pipeline keeps moving in stub mode when there's no real media.
    from .media import signals
    return signals.extract_signals(_media_path(job))


def _transcribe(job: Job, queue: Any) -> dict[str, Any]:
    # REAL faster-whisper transcription when a real source + whisper are present;
    # else stub (engine tests use placeholder paths → no model download).
    from pathlib import Path

    import os

    from .media import transcribe as tr

    path = _media_path(job)
    if Path(path).exists() and tr.whisper_available():
        model = os.environ.get("CLIPPILOT_WHISPER_MODEL", "base")  # "tiny" for fast/CI
        result = tr.transcribe(path, model_size=model)
        result["stage"] = Stage.TRANSCRIBE.value
        return result
    return {"stub": True, "stage": Stage.TRANSCRIBE.value, "available": False}


def _understand(job: Job, queue: Any) -> dict[str, Any]:
    # REAL Video Understanding Engine when a media file + ffmpeg are present:
    # ffmpeg signals + scene-aware keyframe sampling → Understanding (the ML
    # extractors and Claude's vision pass slot in later). When there's no real
    # media (e.g. tests with a placeholder path), fall back to a demo
    # Understanding that still carries a likeness flag so the guardrail wiring is
    # exercised end-to-end.
    from pathlib import Path

    from .media.ffmpeg import ffmpeg_available

    path = _media_path(job)
    if Path(path).exists() and ffmpeg_available():
        from .brain.client import get_client
        from .config import Settings
        from .understand import understand_video
        client = get_client(Settings.load())  # None unless ANTHROPIC_API_KEY is set
        segs = (job.payload.get("transcribe") or {}).get("segments") or []
        u = understand_video(path, client=client, transcript_segments=segs)
        return {
            "available": True,
            "stage": Stage.UNDERSTAND.value,
            "brain": "claude" if client is not None else "deterministic-only (no API key)",
            "understanding": u.to_dict(),
        }

    from .understanding import Faces, HighlightCandidate, SourceMeta, Understanding
    u = Understanding(
        source=SourceMeta(duration_s=600.0, fps=30.0, resolution="1920x1080", has_audio=True),
        summary="(demo) no real media — Understanding pending real source + Claude vision",
        topics=["(demo) topic"],
        faces=Faces(present=True, max_count=1, identifiable_person_likely=True),
        highlight_candidates=[
            HighlightCandidate(start=41.2, end=58.0, score=0.88,
                               reasons=["(demo) energy peak", "(demo) quotable line"]),
        ],
        flags={"likeness": ["identifiable_person"]},
    )
    return {"available": False, "stage": Stage.UNDERSTAND.value, "understanding": u.to_dict()}


def _find_highlights(job: Job, queue: Any) -> dict[str, Any]:
    # Refine the brain's highlight_candidates into a short-form clip plan: ranked,
    # non-overlapping, duration-bounded, top-N (see clippilot/highlights.py).
    from .highlights import plan_highlights, signal_highlights

    u = (job.payload.get("understand") or {}).get("understanding") or {}
    cands = u.get("highlight_candidates") or []
    duration = (u.get("source") or {}).get("duration_s")

    # A generated Section-B/C short is the whole highlight.
    if (job.payload.get("ingest") or {}).get("generated") and duration:
        d = float(duration)
        return {"stage": Stage.FIND_HIGHLIGHTS.value, "source": "generated",
                "highlights": [{"start": 0.0, "end": d, "score": 1.0,
                                "reasons": ["generated short — whole video"], "duration": d}]}

    plan = plan_highlights(cands, duration=duration)
    if plan:
        return {"stage": Stage.FIND_HIGHLIGHTS.value, "source": "understanding",
                "count": len(plan), "highlights": plan}

    # No Claude candidates (e.g. no API key): derive picks from the cheap signals.
    sig = job.payload.get("extract_signals") or {}
    if sig.get("available") and duration:
        plan2 = plan_highlights(signal_highlights(sig, float(duration)), duration=duration)
        if plan2:
            return {"stage": Stage.FIND_HIGHLIGHTS.value, "source": "signals",
                    "count": len(plan2), "highlights": plan2}

    # Last resort: take an early span if we know the duration, else a stub.
    if duration:
        end = min(45.0, float(duration))
        return {"stage": Stage.FIND_HIGHLIGHTS.value, "source": "fallback",
                "highlights": [{"start": 0.0, "end": end, "score": 0.1,
                                "reasons": ["fallback: no highlight candidates"], "duration": end}]}
    return {"stub": True, "stage": Stage.FIND_HIGHLIGHTS.value,
            "highlights": [{"start": 30.0, "end": 68.0, "score": 0.0,
                            "reasons": ["(stub) no understanding"], "duration": 38.0}]}


def _clip(job: Job, queue: Any) -> dict[str, Any]:
    # REAL vertical clips from the highlight spans (clamped to the source
    # duration) when a real source + ffmpeg are present; else stub.
    from pathlib import Path

    from . import config as cfg
    from .media.ffmpeg import ffmpeg_available

    path = _media_path(job)
    if Path(path).exists() and ffmpeg_available():
        from .media import edit, signals
        u = (job.payload.get("understand") or {}).get("understanding") or {}
        # Prefer the refined find_highlights plan; fall back to raw candidates.
        spans = (job.payload.get("find_highlights") or {}).get("highlights") or \
            u.get("highlight_candidates") or []
        duration = (u.get("source") or {}).get("duration_s") or signals.probe(path).duration_s
        # A generated Section-B/C short IS the final clip — use the whole thing
        # as a single span instead of hunting for highlights.
        if (job.payload.get("ingest") or {}).get("generated") and duration:
            spans = [{"start": 0.0, "end": float(duration)}]
        cfg.ensure_dirs()
        clips: list[str] = []
        segments: list[dict[str, Any]] = []
        for i, h in enumerate(spans[:3]):
            start = max(0.0, float(h.get("start", 0.0)))
            end = float(h.get("end", start + 15.0))
            if duration:
                end = min(end, float(duration))
            if end - start < 0.3:
                continue
            out = str(cfg.media_dir() / "clips" / f"job{job.id}_{i:02d}.mp4")  # env-aware
            if edit.clip_segment(path, start, end, out):
                clips.append(out)
                # Record the source span so the caption stage can offset
                # word-timings to clip-local time.
                segments.append({"path": out, "start": start, "end": end})
        if clips:
            return {"available": True, "stage": Stage.CLIP.value, "clips": clips,
                    "segments": segments}
    return {"stub": True, "stage": Stage.CLIP.value, "source_ref": path}


def _caption(job: Job, queue: Any) -> dict[str, Any]:
    # REAL karaoke captions burned into each clip: faster-whisper word timings →
    # remotion-port TikTok pages → clip-local cues → libass burn-in. Falls back to
    # a passthrough stub when there are no real clips / word timings / ffmpeg, so
    # the pipeline keeps moving. Output clips (captioned where possible) become the
    # clips that compose/publish use.
    from pathlib import Path

    from .media.ffmpeg import ffmpeg_available

    clip_payload = job.payload.get("clip") or {}
    segments = clip_payload.get("segments") or []
    words = (job.payload.get("transcribe") or {}).get("words") or []
    if not segments or not words or not ffmpeg_available():
        return {"stub": True, "stage": Stage.CAPTION.value, "available": False,
                "reason": "no real clips / word timings / ffmpeg",
                "clips": clip_payload.get("clips") or []}

    from . import config as cfg
    from .media import captions as cap, edit

    # Caption skin: profile override → settings → karaoke_yellow default (docs/10).
    prof = job.payload.get("profile") or {}
    settings = getattr(queue, "settings", None)
    skin = str(prof.get("caption_skin") or getattr(settings, "caption_skin", "")
               or "karaoke_yellow")
    style = edit.skin_style(skin)
    is_karaoke = skin in edit.KARAOKE_SKINS

    clips_dir = cfg.media_dir() / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)
    out_clips: list[str] = []
    captioned: list[str] = []
    for i, seg in enumerate(segments):
        src = seg.get("path")
        if not src or not Path(src).exists():
            continue
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start))
        # Per-word timed caption pages (clip-local); rendered in the chosen skin.
        pages = cap.pages_for_clip(words, start, end)
        if not pages:
            out_clips.append(src)  # no speech in this span — keep the bare clip
            continue
        ass = str(clips_dir / f"job{job.id}_{i:02d}.ass")
        if is_karaoke:
            edit.write_ass_karaoke(pages, ass, width=1080, height=1920, **style)
        else:
            cues = [{"start": p["start"], "end": p["end"],
                     "text": " ".join((t.get("text") or "") for t in p.get("tokens", []))}
                    for p in pages]
            edit.write_ass(cues, ass, width=1080, height=1920, **style)
        out = str(clips_dir / f"job{job.id}_{i:02d}_cap.mp4")
        burned = edit.burn_subtitles(src, ass, out)
        if burned:
            out_clips.append(burned)
            captioned.append(burned)
        else:
            out_clips.append(src)
    return {"available": True, "stage": Stage.CAPTION.value,
            "clips": out_clips, "captioned": captioned}


def _compose(job: Job, queue: Any) -> dict[str, Any]:
    # Finalize deliverables. Default: passthrough — each captioned clip is its own
    # short (the norm for Shorts/Reels). If settings.compose_concat and there are
    # ≥2 real clips + ffmpeg, stitch them into one compilation instead.
    from pathlib import Path

    clips = ((job.payload.get("caption") or {}).get("clips")
             or (job.payload.get("clip") or {}).get("clips") or [])
    if not clips:
        return {"stub": True, "stage": Stage.COMPOSE.value, "available": False, "clips": []}

    want_concat = bool(getattr(getattr(queue, "settings", None), "compose_concat", False))
    real = [c for c in clips if c and Path(c).exists()]
    if want_concat and len(real) >= 2:
        from .media.ffmpeg import ffmpeg_available
        if ffmpeg_available():
            from . import config as cfg
            from .media import edit
            out = str(cfg.media_dir() / "clips" / f"job{job.id}_compilation.mp4")
            stitched = edit.concat_clips(real, out)
            if stitched:
                return {"available": True, "stage": Stage.COMPOSE.value, "mode": "concat",
                        "clips": [stitched], "source_clips": real}

    return {"available": True, "stage": Stage.COMPOSE.value, "mode": "passthrough",
            "clips": clips, "count": len(clips)}


def _publish(job: Job, queue: Any) -> dict[str, Any]:
    # Generate social metadata (Claude when a real understanding + key exist, else
    # heuristic fallback), then publish: prefer the FREE first-party YouTube Data
    # API uploader, fall back to the paid Upload-Post cross-poster, else export
    # metadata for manual publish. AI-disclosure is forced on at this stage.
    from .publish import metadata as md
    from .publish.upload_post import publisher_from_env
    from .publish.youtube import publisher_from_env as youtube_from_env

    s = queue.settings
    u = (job.payload.get("understand") or {}).get("understanding") or {}
    has_real = bool((u.get("source") or {}).get("duration_s"))
    gen = md.claude_text_generator(s) if has_real else None
    meta = md.from_understanding(u, platform="youtube_shorts", generate_fn=gen)

    result: dict[str, Any] = {
        "stage": Stage.PUBLISH.value,
        # Disclosure is FORCED on by both publishers (YouTube appends it, Upload-Post
        # sets containsSyntheticMedia/is_aigc), so the audit flag is unconditionally true.
        "ai_disclosure_applied": True,
        "channel": job.channel,
        "metadata": meta,
    }
    # Prefer the finalized compose output, then captioned clips, then bare cuts.
    clips = ((job.payload.get("compose") or {}).get("clips")
             or (job.payload.get("caption") or {}).get("clips")
             or (job.payload.get("clip") or {}).get("clips") or [])

    yt = youtube_from_env()      # free first-party — YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN
    up = publisher_from_env()    # paid gateway — UPLOAD_POST_API_KEY + USERNAME
    if clips and yt:
        res = yt.upload_video(clips[0], title=meta["title"], description=meta["caption"],
                              tags=meta["hashtags"], privacy="public")
        result["upload"] = res
        result["publisher"] = "youtube_data_api"
        result["published"] = bool(res.get("success"))
    elif clips and up:
        res = up.upload_video(clips[0], title=meta["title"], description=meta["caption"],
                              tags=meta["hashtags"], platforms=["youtube"])
        result["upload"] = res
        result["publisher"] = "upload_post"
        result["published"] = bool(res.get("success"))
    else:
        result["published"] = False
        result["note"] = "metadata ready; no publisher configured or no clip → manual publish"
    return result


def default_registry() -> dict[Stage, Runner]:
    """A full set of Phase-0 stub runners for every executable stage.

    APPROVAL is intentionally absent — it's a human gate handled by the queue,
    not a runner. The engine never 'runs' an APPROVAL stage.
    """
    reg: dict[Stage, Runner] = {
        Stage.INGEST: _ingest,                      # sets media_path; generates Section B/C
        Stage.EXTRACT_SIGNALS: _extract_signals,   # REAL ffmpeg signals
        Stage.TRANSCRIBE: _transcribe,              # REAL faster-whisper

        Stage.UNDERSTAND: _understand,
        Stage.FIND_HIGHLIGHTS: _find_highlights,    # rank/bound/dedupe → clip plan
        Stage.CLIP: _clip,                          # REAL vertical clips

        Stage.CAPTION: _caption,                    # REAL karaoke caption burn-in
        Stage.COMPOSE: _compose,                    # finalize: passthrough / optional concat
        Stage.PUBLISH: _publish,                    # metadata (MoneyPrinterTurbo port) + Upload-Post
    }
    return reg
