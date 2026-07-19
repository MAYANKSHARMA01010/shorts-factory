"""Topic → original short-form voiceover script (Claude text, with fallback).

The LLM call is the caller-supplied `generate_fn(prompt) -> text` (Claude in
prod via publish.metadata.claude_text_generator; a mock in tests), so this is
pure + unit-testable. The transformative-nudge guardrail (docs/04, config
`Guardrails.transformative_nudge`) is baked into the prompt: original wording,
genuine value — never a re-upload.
"""
from __future__ import annotations

import re
from typing import Any, Callable, Optional

from ..publish.metadata import parse_metadata

GenerateFn = Callable[[str], str]

# Strip a leading "N [adjective…] facts/things/reasons/… about/on/of " framing so a
# facts-mode topic like "3 mind-blowing facts about octopuses" reduces to its core
# SUBJECT ("octopuses") — keeps the narration + b-roll on-topic instead of recursive.
_FACTS_LEAD = re.compile(
    r"^\s*\d+\s+(?:[a-z][a-z-]*\s+)*?"
    r"(?:facts?|things?|reasons?|ways?|tips?|secrets?|myths?)\s+(?:about|on|of|behind|to)\s+",
    re.IGNORECASE,
)


def _core_subject(topic: str) -> str:
    """'3 mind-blowing facts about octopuses' → 'octopuses'; plain topics unchanged."""
    t = (topic or "").strip()
    m = _FACTS_LEAD.match(t)
    if m:
        rest = t[m.end():].strip().rstrip(".")
        if rest:
            return rest
    return t

_TRANSFORMATIVE = (
    "Write ORIGINAL narration in your own words — do not copy any source text. "
    "Include a strong hook in the first line, one clear point with real substance, "
    "and a call-to-action at the end."
)


def build_script_prompt(topic: str, target_seconds: int = 35, language: str = "en") -> str:
    approx_words = int(target_seconds * 2.5)  # ~150 wpm spoken
    return (
        f"You are a short-form (YouTube Shorts / Reels) video scriptwriter.\n"
        f"TOPIC: {topic}\n{_TRANSFORMATIVE}\n"
        f"Write a ~{target_seconds}-second vertical-video voiceover (~{approx_words} words) in {language}.\n"
        f"Respond with ONLY a single minified JSON object, no prose, no code fence, with keys:\n"
        f'  "title": a scroll-stopping title (max 100 chars).\n'
        f'  "script": the spoken narration as plain sentences (no stage directions, no emoji).'
    )


# No-key fallback: rotating templates keyed off the topic so scripts aren't
# identical every time. Honest — this is a template, not understanding; a real,
# topic-specific script needs the Claude brain (ANTHROPIC_API_KEY).
_HOOKS = [
    "Here's what most people get wrong about {t}.",
    "Nobody tells you this about {t}.",
    "You've probably been thinking about {t} all wrong.",
    "This is why {t} matters more than you'd expect.",
    "Most people have no idea how {t} really works.",
]
_BODIES = [
    "Once you see the one idea behind it, it's simpler than it looks.",
    "A few small details change the whole picture.",
    "It clicks fast — and then you can't unsee it.",
    "The surprising part is how much it actually affects everyday life.",
]
_CTAS = [
    "Follow for more like this.",
    "Save this so you don't forget it.",
    "Follow if that was new to you.",
]


def _fallback(topic: str) -> dict[str, Any]:
    t = (topic or "this topic").strip()
    i = sum(ord(c) for c in t) or 1
    script = " ".join([
        _HOOKS[i % len(_HOOKS)].format(t=t),
        _BODIES[(i // 3) % len(_BODIES)],
        "Stick around — the last part is the bit that sticks.",
        _CTAS[(i // 7) % len(_CTAS)],
    ])
    return {"title": t[:100], "script": script, "_fallback": True}


# ── facts mode (ShortGPT FactsShortEngine technique) ─────────────────────────
def build_facts_prompt(topic: str, facts_count: int = 5, language: str = "en") -> str:
    return (
        f"You write a punchy 'list of facts' short-form video voiceover.\n"
        f"TOPIC: {topic}\n{_TRANSFORMATIVE}\n"
        f"Open with a hook, then state exactly {facts_count} SURPRISING, TRUE facts "
        f"(one sentence each, no numbering words spelled out oddly), then a call-to-action. "
        f"Write in {language}.\n"
        f"Respond with ONLY a single minified JSON object: "
        f'{{"title": a scroll-stopping title (max 100 chars), "script": the full spoken narration}}.'
    )


def _facts_fallback(topic: str, facts_count: int) -> dict[str, Any]:
    t = (topic or "this topic").strip()
    parts = [f"{facts_count} things you probably didn't know about {t}."]
    for i in range(1, facts_count + 1):
        parts.append(f"Number {i}: there's more to {t} than most people realise.")
    parts.append("Follow for more facts like these.")
    return {"title": f"{facts_count} facts about {t}"[:100], "script": " ".join(parts),
            "_fallback": True}


# ── multi-intent script router (ViMax script_planner: narrative/motion/montage) ──
INTENT_MODES = ("narrative", "motion", "montage")
_INTENT_GUIDE = {
    "narrative": "Write a STORY-DRIVEN short: a strong hook, then a clear narrative arc "
                 "(setup → turning point → payoff) with a relatable human angle, ending on a CTA.",
    "motion": "Write a FAST, KINETIC short: a punchy hook, then rapid-fire short sentences with "
              "action verbs and quick value hits — high energy, built for fast cuts — ending on a CTA.",
    "montage": "Write an EVOCATIVE, atmospheric short: a hook, then vivid sensory language and "
               "emotional beats with a poetic rhythm suited to a visual montage, ending on a CTA.",
}


def build_intent_prompt(topic: str, intent: str, target_seconds: int = 35,
                        language: str = "en") -> str:
    guide = _INTENT_GUIDE.get(intent, _INTENT_GUIDE["montage"])
    return (f"{guide}\nTOPIC: {topic}\n{_TRANSFORMATIVE}\n"
            f"Aim for about {target_seconds} seconds of narration, in {language}.\n"
            f'Respond with ONLY a minified JSON object: {{"title": ..., "script": the full narration}}.')


def classify_intent(topic: str, generate_fn: Optional[GenerateFn] = None) -> str:
    """Pick a script intent (narrative|motion|montage). Claude classifies when available,
    else a keyword heuristic (default montage — the faceless-aesthetic norm)."""
    if generate_fn is not None:
        try:
            raw = generate_fn(
                f"Classify this short-video topic into exactly one of: narrative, motion, montage.\n"
                f"narrative = story/people/character; motion = action/how-to/fast/instructional; "
                f"montage = emotional/aesthetic/list/atmospheric.\nTOPIC: {topic}\n"
                f"Respond with ONLY the one word.").strip().lower()
            for m in INTENT_MODES:
                if m in raw:
                    return m
        except Exception:  # noqa: BLE001
            pass
    t = (topic or "").lower()
    if any(w in t for w in ("how to", "how-to", "steps", "ways to", "tutorial", "tips", "hack")):
        return "motion"
    if any(w in t for w in ("story", "man ", "woman", "who ", "the boy", "the girl", "journey", "life of")):
        return "narrative"
    return "montage"


def generate_script(topic: str, generate_fn: Optional[GenerateFn] = None,
                    target_seconds: int = 35, language: str = "en",
                    mode: str = "standard", facts_count: int = 5) -> dict[str, Any]:
    """Return {title, script[, _fallback]}. `mode='facts'` → 'N facts about X' (ShortGPT);
    mode ∈ narrative|motion|montage → genre script (ViMax router); mode='auto' classifies
    the intent first. Falls back to a template when there's no generator / unparsable output."""
    if mode == "auto":
        mode = classify_intent(topic, generate_fn)
    is_facts = mode == "facts"
    is_intent = mode in INTENT_MODES
    subject = _core_subject(topic) if is_facts else topic
    if is_facts:
        prompt_fn = lambda: build_facts_prompt(subject, facts_count, language)  # noqa: E731
    elif is_intent:
        prompt_fn = lambda: build_intent_prompt(topic, mode, target_seconds, language)  # noqa: E731
    else:
        prompt_fn = lambda: build_script_prompt(topic, target_seconds, language)  # noqa: E731
    fallback = (lambda: _facts_fallback(subject, facts_count)) if is_facts else (lambda: _fallback(topic))

    if generate_fn is None:
        return fallback()
    try:
        raw = generate_fn(prompt_fn())
    except Exception:  # noqa: BLE001 — LLM/network failure → template
        return fallback()
    data = parse_metadata(raw)
    if not isinstance(data, dict) or not str(data.get("script", "")).strip():
        return fallback()
    return {"title": str(data.get("title", topic))[:100], "script": str(data["script"]).strip()}
