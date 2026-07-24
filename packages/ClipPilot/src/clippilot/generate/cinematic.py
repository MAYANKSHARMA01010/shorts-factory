"""Cinematic prompt-builder — CAMERA/LENS/LIGHT vocabulary harvested from
Open-Generative-AI's prompt recipes (the free portable part; its MuAPI backend is
paid and excluded). Two uses:

  • build_visual_prompt(subject, mood) → a rich cinematic prompt for an image/video
    GENERATOR (backlog #7 hosted-API hooks).
  • enrich_term(term) → a LIGHT cinematic booster appended to a STOCK-SEARCH query
    (Bing/Pexels) so results skew more polished — used with a bare-query fallback so
    it never returns fewer results than the plain term.

All picks are deterministic (hash of the text) — no RNG — so a given subject always
maps to the same look, which keeps a video visually coherent and tests stable.
"""
from __future__ import annotations

from typing import Optional

# Rich vocab for GENERATION prompts (heavy descriptors help diffusion models).
COMPOSITION = ["cinematic composition", "wide establishing shot", "intimate close-up",
               "sweeping aerial drone shot", "dramatic low-angle shot", "macro detail shot"]
LENS = ["shallow depth of field", "creamy bokeh background", "85mm portrait lens",
        "anamorphic lens flare", "wide-angle perspective"]
LIGHTING = ["cinematic lighting", "golden-hour glow", "dramatic high contrast",
            "soft rim light", "volumetric fog", "moody neon glow"]
QUALITY = ["ultra-detailed", "photorealistic", "high dynamic range", "8k", "film grain"]

# Map the brain's mood → a fitting lighting choice (else fall back to a hashed pick).
MOOD_LIGHTING = {
    "calm": "soft natural light", "peaceful": "soft natural light",
    "happy": "bright golden-hour glow", "uplifting": "warm sunrise light",
    "epic": "dramatic high contrast", "intense": "dramatic high contrast",
    "serious": "moody low-key light", "mysterious": "volumetric fog",
    "energetic": "vibrant neon glow", "exciting": "vibrant neon glow",
    "sad": "muted overcast light", "inspirational": "warm sunrise light",
}

# Light boosters that genuinely help a STOCK SEARCH (not gen-only jargon).
SEARCH_BOOST = ["cinematic", "4k", "aerial view", "close up", "scenic", "slow motion"]


def _idx(s: str, salt: int = 0) -> int:
    return sum(ord(c) for c in (s or "x")) + salt


def build_visual_prompt(subject: str, mood: Optional[str] = None, seed: int = 0) -> str:
    """A rich, deterministic cinematic prompt for an image/video generator."""
    subj = (subject or "abstract background").strip().rstrip(".")
    i = _idx(subj, seed)
    comp = COMPOSITION[i % len(COMPOSITION)]
    light = MOOD_LIGHTING.get((mood or "").strip().lower()) or LIGHTING[i % len(LIGHTING)]
    lens = LENS[i % len(LENS)]
    qual = QUALITY[i % len(QUALITY)]
    return f"{subj}, {comp}, {light}, {lens}, {qual}, cinematic"


def enrich_term(term: str, seed: int = 0) -> str:
    """Append ONE deterministic cinematic booster to a stock-search term."""
    t = (term or "").strip()
    if not t:
        return t
    return f"{t} {SEARCH_BOOST[_idx(t, seed) % len(SEARCH_BOOST)]}"


def enrich_terms(terms: list[str]) -> list[str]:
    return [enrich_term(t, i) for i, t in enumerate(terms)]
