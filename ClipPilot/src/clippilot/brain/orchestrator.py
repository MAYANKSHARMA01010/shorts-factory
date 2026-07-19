"""Merge the Claude vision pass back into the Understanding object.

Takes the deterministic Understanding (from understand.py) + its keyframes, asks
the VisionClient to look at the frames, and fills the semantic fields: summary,
per-scene visual_desc, mood label, on-screen text, topics/entities, and
highlight candidates with reasons. Wires the likeness guardrail (docs/04, /07).
"""
from __future__ import annotations

from typing import Optional

from ..understanding import HighlightCandidate, Understanding
from .client import VisionClient


def enrich_understanding(u: Understanding, keyframe_paths: Optional[list[str]] = None,
                         client: Optional[VisionClient] = None) -> Understanding:
    """Fill `u`'s semantic fields from a Claude vision pass. If `client` is None
    or there are no keyframes, returns `u` unchanged (deterministic-only)."""
    paths = keyframe_paths if keyframe_paths is not None else list(u.keyframe_paths)
    if client is None or not paths:
        u.flags.setdefault("brain", []).append("skipped: no client or no keyframes")
        return u

    data = client.vision_understand(u, paths)

    u.summary = data.get("summary", u.summary)
    u.topics = data.get("topics", u.topics)
    u.entities = data.get("entities", u.entities)
    u.on_screen_text = [{"text": t} for t in data.get("on_screen_text", [])]

    # per-scene visual descriptions
    desc_by_idx = {d["idx"]: d["visual_desc"] for d in data.get("scene_descriptions", [])}
    for s in u.scenes:
        if s.idx in desc_by_idx:
            s.visual_desc = desc_by_idx[s.idx]

    # mood label onto the energy timeline
    if u.mood_energy_timeline and data.get("mood_label"):
        u.mood_energy_timeline[0]["label"] = data["mood_label"]

    # likeness guardrail (docs/04 §, docs/07 §5)
    if data.get("identifiable_person_likely"):
        u.faces.present = True
        u.faces.identifiable_person_likely = True
        likeness = u.flags.setdefault("likeness", [])
        if "identifiable_person" not in likeness:
            likeness.append("identifiable_person")

    # highlight candidates with reasons (never bare timestamps)
    u.highlight_candidates = [
        HighlightCandidate(start=h["start"], end=h["end"],
                           score=h.get("score", 0.0), reasons=h.get("reasons", []))
        for h in data.get("highlight_candidates", [])
    ]
    return u
