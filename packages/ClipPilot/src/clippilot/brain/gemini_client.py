# -*- coding: utf-8 -*-
"""GeminiVisionClient — drop-in free alternative to AnthropicVisionClient.

Uses Google Gemini API (FREE tier: 15 req/min, 1M tokens/day, no credit card).
Get a free key at: https://aistudio.google.com/apikey  (sign in with Google, click 'Create API key')

Set in ClipPilot/.env:
    GEMINI_API_KEY=AIza...
    CLIPPILOT_BRAIN_PROVIDER=gemini      # tells client.py to use this instead of Anthropic
    CLIPPILOT_BRAIN_MODEL=gemini-2.0-flash   # fastest free model

Supported models (all free-tier):
    gemini-2.0-flash       — fastest, best for this use case
    gemini-1.5-flash       — fallback
    gemini-1.5-pro         — slower but smarter (50 req/day on free tier)
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
DEFAULT_MODEL = "gemini-2.0-flash"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def _get_key() -> str | None:
    return os.environ.get(GEMINI_API_KEY_VAR)


def has_gemini_key() -> bool:
    return bool(_get_key())


class GeminiVisionClient:
    """Free Gemini drop-in for AnthropicVisionClient.

    Uses the REST API directly (no SDK) so no extra pip install is needed.
    Falls back gracefully if the key is missing.
    """

    def __init__(self, model: str = DEFAULT_MODEL):
        self.model = model

    def vision_understand(self, u: Understanding, keyframe_paths: list[str]) -> dict[str, Any]:
        key = _get_key()
        if not key:
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

        url = f"{BASE_URL}/{self.model}:generateContent?key={key}"
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = json.load(resp)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Gemini API error {e.code}: {e.read().decode()[:300]}") from e

        # Extract the generated text
        try:
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise RuntimeError(f"Gemini returned unexpected response: {str(raw)[:300]}") from e


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
