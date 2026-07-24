"""Vision clients: the real Anthropic-SDK client and a mock for tests.

`VisionClient.vision_understand(...)` returns the enrichment dict (validated
against prompt.ENRICHMENT_SCHEMA by the API's structured-output mode). The real
client lazy-imports `anthropic`, so the rest of the package (and the whole test
suite) works without the SDK or an API key installed.
"""
from __future__ import annotations

import os
from typing import Any, Optional, Protocol

from .. import config as cfg
from ..understanding import Understanding
from . import env
from .prompt import build_vision_request

# Anthropic vision pricing (per 1M tokens) — for the cost note (claude-api skill).
PRICING = {
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}

# Provider env var: set CLIPPILOT_BRAIN_PROVIDER=gemini to use the free Gemini alternative
_PROVIDER = (os.environ.get("CLIPPILOT_BRAIN_PROVIDER") or "").lower()


class VisionClient(Protocol):
    def vision_understand(self, u: Understanding, keyframe_paths: list[str]) -> dict[str, Any]:
        ...


class AnthropicVisionClient:
    """Real client. Sends keyframes as image blocks + forces the JSON schema."""

    def __init__(self, model: str = "claude-opus-4-8", api_key: Optional[str] = None):
        self.model = model
        self._api_key = api_key or env.get_api_key()
        self._client = None  # lazy

    def _ensure(self):
        if self._client is None:
            from anthropic import Anthropic  # lazy — keeps the package import-light
            self._client = Anthropic(api_key=self._api_key) if self._api_key else Anthropic()
        return self._client

    def vision_understand(self, u: Understanding, keyframe_paths: list[str]) -> dict[str, Any]:
        client = self._ensure()
        req = build_vision_request(u, keyframe_paths, model=self.model)
        resp = client.messages.parse(**req)
        # messages.parse returns parsed_output validated against the json_schema.
        parsed = getattr(resp, "parsed_output", None)
        if parsed is None:
            raise RuntimeError(f"no parsed_output (stop_reason={getattr(resp, 'stop_reason', '?')})")
        return dict(parsed)


class MockVisionClient:
    """Deterministic stand-in so tests run without the SDK/key. Echoes shape."""

    def __init__(self, identifiable_person: bool = True):
        self.identifiable_person = identifiable_person
        self.calls: list[int] = []

    def vision_understand(self, u: Understanding, keyframe_paths: list[str]) -> dict[str, Any]:
        self.calls.append(len(keyframe_paths))
        return {
            "summary": "(mock) A short clip with one speaker and an energetic payoff.",
            "topics": ["mock-topic"],
            "entities": [],
            "on_screen_text": ["MOCK CAPTION"],
            "scene_descriptions": [{"idx": s.idx, "visual_desc": f"(mock) scene {s.idx}"}
                                   for s in u.scenes],
            "mood_label": "energetic",
            "identifiable_person_likely": self.identifiable_person,
            "highlight_candidates": [
                {"start": 1.0, "end": 4.0, "score": 0.82,
                 "reasons": ["(mock) energy peak", "(mock) quotable line"]},
            ],
        }


def get_client(settings: Optional[cfg.Settings] = None) -> Optional[VisionClient]:
    """Return the best available vision client:
    1. GeminiVisionClient if CLIPPILOT_BRAIN_PROVIDER=gemini + GEMINI_API_KEY is set (FREE)
    2. AnthropicVisionClient if ANTHROPIC_API_KEY is set
    3. None → callers fall back to deterministic Understanding (no enrichment)
    """
    import os
    settings = settings or cfg.Settings.load()
    provider = os.environ.get("CLIPPILOT_BRAIN_PROVIDER", "").lower()

    # ── Gemini (free alternative) ──────────────────────────────────────────
    if provider == "gemini" or (not env.has_api_key() and os.environ.get("GEMINI_API_KEY")):
        from .gemini_client import GeminiVisionClient, has_gemini_key
        if has_gemini_key():
            model = os.environ.get("CLIPPILOT_BRAIN_MODEL", "gemini-2.0-flash")
            return GeminiVisionClient(model=model)

    # ── Anthropic (paid) ──────────────────────────────────────────────────
    if not env.has_api_key():
        return None
    try:
        import anthropic  # noqa: F401 — availability probe
    except ImportError:
        return None
    return AnthropicVisionClient(model=settings.brain_model)


def estimate_cost_usd(model: str, frames: int, avg_frame_tokens: int = 600,
                      text_tokens: int = 10000, output_tokens: int = 4000) -> float:
    """Rough Claude spend for one understanding pass (docs/07 cost model)."""
    in_price, out_price = PRICING.get(model, PRICING["claude-opus-4-8"])
    input_tokens = frames * avg_frame_tokens + text_tokens
    return round(input_tokens / 1_000_000 * in_price + output_tokens / 1_000_000 * out_price, 4)
