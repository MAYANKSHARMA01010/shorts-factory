# -*- coding: utf-8 -*-
"""GeminiVisionClient — drop-in free alternative to AnthropicVisionClient.

Uses Google Gemini API (FREE tier: 15 req/min, 1M tokens/day, no credit card).
Get a free key at: https://aistudio.google.com/apikey  (sign in with Google, click 'Create API key')

Set in ClipPilot/.env:
    GEMINI_API_KEY=AIza...
    CLIPPILOT_BRAIN_PROVIDER=gemini      # tells client.py to use this instead of Anthropic
    CLIPPILOT_BRAIN_MODEL=gemini-3.5-flash   # fastest active free model

Supported models (all free-tier):
    gemini-3.5-flash       — fastest, best for this use case
    gemini-flash-lite-latest — ultra-fast lightweight fallback
    gemini-3.5-flash-lite  — high quota fallback
    gemini-3.6-flash       — advanced reasoning fallback
"""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from ..understanding import Understanding

GEMINI_API_KEY_VAR = "GEMINI_API_KEY"
DEFAULT_MODEL = "gemini-3.5-flash"
FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
]
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_KEY_LAST_CALL: dict[str, float] = {}


def _get_keys() -> list[str]:
    raw = os.environ.get("GEMINI_API_KEYS") or os.environ.get(GEMINI_API_KEY_VAR) or ""
    return [k.strip() for k in raw.replace("\n", ",").split(",") if k.strip()]


def _get_key() -> str | None:
    keys = _get_keys()
    return keys[0] if keys else None


def has_gemini_key() -> bool:
    return len(_get_keys()) > 0


class GeminiVisionClient:
    """Free Gemini drop-in for AnthropicVisionClient with key rotation and multi-model failover.

    Uses the REST API directly (no SDK) so no extra pip install is needed.
    Falls back gracefully across multiple comma-separated keys and active models.
    """

    def __init__(self, model: str = DEFAULT_MODEL):
        self.model = model

    def vision_understand(self, u: Understanding, keyframe_paths: list[str]) -> dict[str, Any]:
        keys = _get_keys()
        if not keys:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Get a free key at https://aistudio.google.com/apikey "
                "then add it to ClipPilot/.env as GEMINI_API_KEY=AIza..."
            )

        # Build parts: text prompt + images
        parts: list[dict] = []

        # System-style text prompt
        prompt = _build_prompt(u)
        parts.append({"text": prompt})

        # Attach up to 16 keyframes as inline base64 images
        for p in keyframe_paths[:16]:
            try:
                data = Path(p).read_bytes()
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(data).decode(),
                    }
                })
            except Exception:
                pass  # skip unreadable frames

        # Add JSON schema instruction at the end
        parts.append({"text": (
            "\n\nRespond ONLY with valid JSON matching this exact schema — no markdown, "
            "no explanation, no extra keys:\n"
            + json.dumps(_JSON_SCHEMA, indent=2)
        )})

        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.3,
                "maxOutputTokens": 4096,
            },
        }

        models_to_try = list(dict.fromkeys([self.model] + FALLBACK_MODELS))
        last_error = None

        for target_model in models_to_try:
            for key_idx, key in enumerate(keys):
                import time
                now = time.time()
                last_used = _KEY_LAST_CALL.get(key, 0)
                if now - last_used < 4.5:
                    time.sleep(4.5 - (now - last_used))
                _KEY_LAST_CALL[key] = time.time()

                url = f"{BASE_URL}/{target_model}:generateContent?key={key}"
                body = json.dumps(payload).encode()
                req = urllib.request.Request(
                    url, data=body,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        raw = json.load(resp)
                        text = raw["candidates"][0]["content"]["parts"][0]["text"]
                        return json.loads(text)
                except urllib.error.HTTPError as e:
                    last_error = f"Gemini API error {e.code} on model {target_model}: {e.read().decode()[:300]}"
                    if e.code in (404, 429):
                        continue
                except (KeyError, IndexError, json.JSONDecodeError) as e:
                    last_error = f"Gemini returned unexpected response on model {target_model}: {str(e)}"

        raise RuntimeError(f"All Gemini models and API keys failed. Last error: {last_error}")


def _build_prompt(u: Understanding) -> str:
    scenes_txt = "\n".join(
        f"  Scene {s.idx} [{s.start_s:.1f}s–{s.end_s:.1f}s]: {getattr(s, 'transcript', '')}"
        for s in u.scenes
    )
    return (
        "You are a YouTube Shorts video analyst. Analyze the video keyframes and transcript below.\n\n"
        f"Title hint: {u.title or 'Unknown'}\n"
        f"Total duration: {u.duration_s:.1f}s\n\n"
        f"Scene transcripts:\n{scenes_txt}\n\n"
        "Analyze the keyframes and return structured JSON about this video."
    )


# Minimal JSON schema for the response (matches AnthropicVisionClient output shape)
_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "topics": {"type": "array", "items": {"type": "string"}},
        "entities": {"type": "array", "items": {"type": "string"}},
        "on_screen_text": {"type": "array", "items": {"type": "string"}},
        "scene_descriptions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "idx": {"type": "integer"},
                    "visual_desc": {"type": "string"},
                },
            },
        },
        "mood_label": {"type": "string"},
        "identifiable_person_likely": {"type": "boolean"},
        "highlight_candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "score": {"type": "number"},
                    "reasons": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
    "required": [
        "summary", "topics", "entities", "on_screen_text",
        "scene_descriptions", "mood_label",
        "identifiable_person_likely", "highlight_candidates",
    ],
}
