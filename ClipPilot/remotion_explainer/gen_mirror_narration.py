#!/usr/bin/env python
"""Generate mirror_narration.mp3 + mirror_words.json via edge-tts.

Same house narrator as the Black Hole / SkyBlue explainers
(en-US-AndrewMultilingualNeural). edge-tts emits WordBoundary events, giving
perfectly-aligned per-word timestamps that drive BOTH the karaoke captions and
the scene timing in Mirror.tsx -- no whisper pass needed.

Run with SYSTEM python:  python gen_mirror_narration.py
"""
import asyncio
import json
from pathlib import Path

import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"  # warm, confident male narrator
RATE = "-4%"                              # slight slow-down = weightier delivery
OUT_DIR = Path(__file__).parent / "public"
MP3 = OUT_DIR / "mirror_narration.mp3"
WORDS = Path(__file__).parent / "src" / "mirror_words.json"

# Transcript #001 verbatim (the hook line is already scroll-stopping).
SCRIPT = (
    "Your reflection isn't really in the glass at all. "
    "A mirror starts as a sheet of perfectly flat glass, "
    "scrubbed until not a single speck remains. "
    "Then workers spray on a thin layer of liquid silver, "
    "so thin it's just a few atoms thick. "
    "And this silver is what actually bounces your image back at you. "
    "Next, a coat of copper and paint seals it, "
    "stopping the metal from scratching away. "
    "So when you stare into a mirror, you're really looking at a wall of "
    "microscopic silver, hiding behind the glass the whole time."
)


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(SCRIPT, VOICE, rate=RATE)
    words = []
    with open(MP3, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                dur = chunk["duration"] / 1e7
                words.append(
                    {"text": chunk["text"], "start": round(start, 3), "end": round(start + dur, 3)}
                )
    WORDS.parent.mkdir(parents=True, exist_ok=True)
    WORDS.write_text(json.dumps({"script": SCRIPT, "words": words}, indent=0), encoding="utf-8")
    dur = words[-1]["end"] if words else 0.0
    print(f"OK edge-tts -> {MP3.name} ({len(words)} words, audio ends {dur:.2f}s)")
    print(f"   words -> {WORDS}")
    print("--- sentence ends (for scene boundaries) ---")
    for i, w in enumerate(words):
        if w["text"].rstrip().endswith((".", "?", "!")):
            print(f"  idx {i:3d}  t={w['end']:6.2f}  ...{w['text']}")


if __name__ == "__main__":
    asyncio.run(main())
