"""Build the Claude vision request for the understanding pass.

Returns kwargs for `client.messages.parse(**kwargs)` — system prompt, a user
turn interleaving a context text block with the sampled keyframes as base64
image blocks, and an `output_config.format` json_schema that forces the
enrichment JSON. Pure/deterministic and SDK-free, so it's unit-testable without
the `anthropic` package or an API key.
"""
from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from ..understanding import Understanding

# Anthropic vision allows up to 100 images per request; we also cap by frame budget.
MAX_IMAGES = 100

# Enrichment schema (structured outputs: additionalProperties:false, no length/
# numeric constraints — see claude-api skill). All properties required.
ENRICHMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "summary", "topics", "entities", "on_screen_text", "scene_descriptions",
        "mood_label", "identifiable_person_likely", "highlight_candidates",
    ],
    "properties": {
        "summary": {"type": "string"},
        "topics": {"type": "array", "items": {"type": "string"}},
        "entities": {"type": "array", "items": {"type": "string"}},
        "on_screen_text": {"type": "array", "items": {"type": "string"}},
        "scene_descriptions": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["idx", "visual_desc"],
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
                "type": "object", "additionalProperties": False,
                "required": ["start", "end", "score", "reasons"],
                "properties": {
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "score": {"type": "number"},
                    "reasons": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}

SYSTEM = (
    "You are ClipPilot's video-understanding analyst. You are given a video's "
    "extracted signals (shot timecodes, transcript excerpts, loudness/energy) and a "
    "set of sampled keyframes. Watch like a human: read on-screen text off the frames, "
    "describe what each scene shows, judge the mood/energy, identify topics and named "
    "entities, and propose the most clip-worthy moments with concrete reasons and a 0-1 "
    "score. IMPORTANT: if a real, identifiable person appears (not a synthetic/cartoon "
    "face), set identifiable_person_likely=true — this triggers a likeness/consent check "
    "before publishing. Ground every claim in the frames or transcript; do not invent."
)


def _mmss(t: float) -> str:
    t = int(t)
    return f"{t // 60:02d}:{t % 60:02d}"


def _context_text(u: Understanding) -> str:
    lines = [
        f"SOURCE: {u.source.resolution} @ {u.source.fps}fps, "
        f"{_mmss(u.source.duration_s)} long, audio={u.source.has_audio}",
        f"SCENES ({len(u.scenes)} shots):",
    ]
    for s in u.scenes[:60]:
        excerpt = (s.transcript_excerpt or "").strip()
        if len(excerpt) > 160:
            excerpt = excerpt[:157] + "..."
        lines.append(f"  shot {s.idx}: {_mmss(s.start)}-{_mmss(s.end)}"
                     + (f"  \"{excerpt}\"" if excerpt else ""))
    if u.mood_energy_timeline:
        lufs = u.mood_energy_timeline[0].get("integrated_lufs")
        if lufs is not None:
            lines.append(f"AUDIO: integrated loudness {lufs} LUFS")
    lines.append(
        "\nReturn the structured understanding. scene_descriptions[].idx must match the "
        "shot indices above. highlight_candidates start/end are seconds."
    )
    return "\n".join(lines)


def _image_block(path: str) -> dict[str, Any]:
    data = base64.b64encode(Path(path).read_bytes()).decode("ascii")
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}


def build_vision_request(u: Understanding, keyframe_paths: list[str],
                         model: str = "claude-opus-4-8", max_tokens: int = 8000,
                         max_images: int = MAX_IMAGES) -> dict[str, Any]:
    """kwargs for client.messages.parse(...). Interleaves a context text block
    with up to `max_images` keyframes (each captioned with its timecode/shot)."""
    content: list[dict[str, Any]] = [{"type": "text", "text": _context_text(u)}]

    # Map keyframe path -> its scene (for the caption), best-effort.
    path_to_scene = {s.keyframe_path: s for s in u.scenes if s.keyframe_path}
    for path in keyframe_paths[:max_images]:
        sc = path_to_scene.get(path)
        cap = f"[frame {Path(path).name}]"
        if sc is not None:
            cap = f"[frame @ {_mmss(sc.start)} — shot {sc.idx}]"
        content.append({"type": "text", "text": cap})
        content.append(_image_block(path))

    return {
        "model": model,
        "max_tokens": max_tokens,
        "thinking": {"type": "adaptive"},
        "system": SYSTEM,
        "messages": [{"role": "user", "content": content}],
        "output_config": {"format": {"type": "json_schema", "schema": ENRICHMENT_SCHEMA}},
    }
