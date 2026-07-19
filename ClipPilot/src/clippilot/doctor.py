"""Readiness check — what's configured, what it unlocks, and the path to first $.

Used by `python -m clippilot doctor` (CLI) and the `doctor` MCP tool, so both you
and Claude (from the desktop app) can see exactly what's ready and what to set up
next. Pure inspection — no side effects.
"""
from __future__ import annotations

import os
from typing import Any


def _check(name: str, ok: bool, detail: str, unlocks: str, required: bool = False) -> dict[str, Any]:
    return {"name": name, "ok": bool(ok), "detail": detail, "unlocks": unlocks, "required": required}


def check_readiness() -> dict[str, Any]:
    """Inspect the environment and return {ready, checks, next_steps}."""
    from .brain import env as benv
    from .media.download import ytdlp_available
    from .media.ffmpeg import ffmpeg_available
    from .media.transcribe import whisper_available
    from .media.tts import tts_available

    benv.load_dotenv()
    ffmpeg = ffmpeg_available()
    whisper = whisper_available()
    tts_ok = tts_available()
    ytdlp = ytdlp_available()
    has_key = benv.has_api_key()
    yt = all(os.environ.get(k) for k in
             ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"))
    yt_partial = bool(os.environ.get("YOUTUBE_CLIENT_ID") and os.environ.get("YOUTUBE_CLIENT_SECRET"))
    up = bool(os.environ.get("UPLOAD_POST_API_KEY") and os.environ.get("UPLOAD_POST_USERNAME"))
    try:
        import PySide6  # noqa: F401
        pyside = True
    except ImportError:
        pyside = False

    checks = [
        _check("ffmpeg", ffmpeg, "bundled via imageio-ffmpeg" if ffmpeg else "missing",
               "signals, clipping, captions, compose", required=True),
        _check("faster-whisper", whisper, "installed" if whisper else "pip install faster-whisper",
               "transcription + word-timed karaoke captions"),
        _check("TTS (Chatterbox / edge-tts)", tts_ok,
               "ready" if tts_ok else "no engine (Chatterbox venv or edge-tts)",
               "Section B/C narration"),
        _check("yt-dlp", ytdlp, "installed" if ytdlp else "pip install yt-dlp",
               "download a source video from a URL for Section-A clipping"),
        _check("Anthropic API key", has_key, "set" if has_key else "add ANTHROPIC_API_KEY to .env",
               "Claude vision understanding, smart highlight picks, script/metadata (deterministic fallback otherwise)"),
        _check("YouTube publishing (free)", yt,
               "configured" if yt else ("client set — run youtube_auth for a refresh token"
                                        if yt_partial else "not configured"),
               "FREE first-party publish to YouTube"),
        _check("Upload-Post (paid)", up, "configured" if up else "not configured",
               "paid cross-post: YouTube + IG/FB + TikTok"),
        _check("Hosted image-gen (paid, optional)", bool(os.environ.get("GEN_IMAGE_API_KEY")),
               "configured" if os.environ.get("GEN_IMAGE_API_KEY") else "not configured (uses stock b-roll)",
               "AI-generated cinematic Section-B stills (GEN_IMAGE_API_KEY)"),
        _check("PySide6 GUI", pyside, "installed" if pyside else "pip install PySide6",
               "the native Windows app (run.bat)"),
    ]

    ready = {
        "clip_sectionA": ffmpeg,
        "captions": ffmpeg and whisper,
        "generate_sectionB": ffmpeg and tts_ok,
        "brain": has_key,
        "publish_free": ffmpeg and yt,
        "publish_paid": ffmpeg and up,
        "can_publish": ffmpeg and (yt or up),
    }

    steps: list[str] = []
    if ready["clip_sectionA"] and ready["can_publish"]:
        steps.append("READY to clip AND publish. Add a Section-A job (owned/authorized source), run the "
                     "engine, and enable auto-approve on a trusted lane for unattended runs.")
    elif ready["clip_sectionA"]:
        steps.append("READY to clip (output saved locally). Configure a publisher to post automatically.")
    if not ffmpeg:
        steps.append("Install deps so ffmpeg is available: pip install -r src/requirements.txt.")
    if not (yt or up):
        steps.append("Set up FREE publishing: create a Google OAuth *Desktop* client (enable YouTube Data API "
                     "v3), put YOUTUBE_CLIENT_ID/SECRET in .env, then run "
                     "`python -m clippilot.publish.youtube_auth --write-env` (docs/09 step 7).")
    elif yt_partial and not yt:
        steps.append("Finish YouTube auth: run `python -m clippilot.publish.youtube_auth --write-env` "
                     "to obtain YOUTUBE_REFRESH_TOKEN.")
    if not has_key:
        steps.append("Optional: add ANTHROPIC_API_KEY to .env for human-like understanding + smart clip picks "
                     "(works without it via deterministic fallback).")
    if not whisper:
        steps.append("Install captions support: pip install faster-whisper.")

    return {"ready": ready, "checks": checks, "next_steps": steps}


def format_report(report: dict[str, Any]) -> str:
    """Human-readable rendering for the CLI."""
    lines = ["ClipPilot readiness", "=" * 40]
    for c in report["checks"]:
        mark = "[OK]" if c["ok"] else ("[!!]" if c["required"] else "[--]")
        req = " (required)" if c["required"] and not c["ok"] else ""
        lines.append(f"  {mark} {c['name']}: {c['detail']}{req}")
        lines.append(f"        unlocks: {c['unlocks']}")
    r = report["ready"]
    lines += ["", "Capabilities:",
              f"  clip Section A : {'yes' if r['clip_sectionA'] else 'no'}",
              f"  captions       : {'yes' if r['captions'] else 'no'}",
              f"  generate Sec B : {'yes' if r['generate_sectionB'] else 'no'}",
              f"  Claude brain   : {'yes' if r['brain'] else 'no (deterministic fallback)'}",
              f"  publish (free) : {'yes' if r['publish_free'] else 'no'}",
              f"  publish (paid) : {'yes' if r['publish_paid'] else 'no'}"]
    if report["next_steps"]:
        lines += ["", "Next steps:"]
        lines += [f"  {i}. {s}" for i, s in enumerate(report["next_steps"], 1)]
    return "\n".join(lines)
