"""Optional hosted text-to-speech / music generation hook — palmier `generateAudio`
parity (the upgrade path beyond the built-in SAPI TTS).

Vendor-neutral: point it at any endpoint that returns either raw audio bytes (ElevenLabs
TTS/music style) or a JSON body with an audio URL. No key → no-op (callers fall back to
SAPI TTS for narration; music is simply skipped).

Env: GEN_AUDIO_API_KEY (required), GEN_AUDIO_ENDPOINT, GEN_AUDIO_MODEL, GEN_AUDIO_VOICE.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional


def gen_audio_available() -> bool:
    return bool(os.environ.get("GEN_AUDIO_API_KEY"))


def _parse_audio_url(data: dict[str, Any]) -> Optional[str]:
    if not isinstance(data, dict):
        return None
    for key in ("audio_url", "url"):
        if isinstance(data.get(key), str) and data[key].startswith("http"):
            return data[key]
    aud = data.get("audio")
    if isinstance(aud, dict) and isinstance(aud.get("url"), str):
        return aud["url"]
    items = data.get("data")
    if isinstance(items, list) and items and isinstance(items[0], dict) and items[0].get("url"):
        return items[0]["url"]
    return None


def generate_audio(prompt: str, out_path: str, voice: Optional[str] = None,
                   kind: str = "speech") -> Optional[str]:
    """Generate speech (kind='speech') or music (kind='music') for `prompt` → `out_path`.
    Returns the path or None. Handles raw-audio-bytes or JSON-with-URL responses."""
    key = os.environ.get("GEN_AUDIO_API_KEY")
    if not key:
        return None
    endpoint = os.environ.get("GEN_AUDIO_ENDPOINT", "https://api.elevenlabs.io/v1/text-to-speech")
    model = os.environ.get("GEN_AUDIO_MODEL", "")
    voice = voice or os.environ.get("GEN_AUDIO_VOICE", "")
    body: dict[str, Any] = {"text": prompt, "prompt": prompt, "kind": kind}
    if model:
        body["model"] = model
    if voice:
        body["voice"] = voice
    try:
        import httpx
        r = httpx.post(endpoint, headers={"Authorization": f"Bearer {key}",
                                          "xi-api-key": key}, json=body, timeout=300)
        if r.status_code != 200:
            return None
        ctype = r.headers.get("content-type", "")
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        if ctype.startswith("audio") or "octet-stream" in ctype:
            if r.content:
                Path(out_path).write_bytes(r.content)
                return out_path
            return None
        url = _parse_audio_url(r.json())
        if not url:
            return None
        rr = httpx.get(url, timeout=300, follow_redirects=True)
        if rr.status_code == 200 and rr.content:
            Path(out_path).write_bytes(rr.content)
            return out_path
    except Exception:  # noqa: BLE001
        return None
    return None
