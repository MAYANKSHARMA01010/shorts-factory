#!/usr/bin/env python
"""Generate narration.mp3 + words.json for the Black Hole explainer via edge-tts.

edge-tts emits WordBoundary events (offset+duration in 100ns units) as it
synthesizes, giving us perfectly-aligned per-word timestamps to drive both the
karaoke captions and the scene timing in the Remotion composition.

Run with SYSTEM python (edge-tts lives there):
  python gen_blackhole_narration.py
"""
import asyncio
import json
from pathlib import Path

import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"  # warm, confident male narrator
OUT_DIR = Path(__file__).parent / "public"
MP3 = OUT_DIR / "blackhole_narration.mp3"
WORDS = OUT_DIR / "blackhole_words.json"

SCRIPT = (
    "What if there was a place where gravity is so strong, "
    "that not even light could escape? That's a black hole. "
    "It's born when a giant star runs out of fuel and collapses "
    "under its own crushing weight, squeezing into an unimaginably dense point. "
    "Around it lies the event horizon, the point of no return. "
    "Cross that line, and nothing comes back, not even light itself. "
    "Drift too close, and gravity stretches you into a long, thin strand. "
    "We can't see a black hole directly. "
    "But we watch superheated gas glow as it spirals in. "
    "So a black hole isn't really a hole at all. "
    "It's the most extreme object in the entire universe."
)


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # slight slow-down gives the science a more deliberate, weighty feel
    communicate = edge_tts.Communicate(SCRIPT, VOICE, rate="-4%")
    words = []
    with open(MP3, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                dur = chunk["duration"] / 1e7
                words.append(
                    {
                        "text": chunk["text"],
                        "start": round(start, 3),
                        "end": round(start + dur, 3),
                    }
                )
    WORDS.write_text(
        json.dumps({"script": SCRIPT, "words": words}, indent=0),
        encoding="utf-8",
    )
    dur = words[-1]["end"] if words else 0.0
    print(f"OK edge-tts -> {MP3.name} ({len(words)} words, audio ends {dur:.2f}s)")
    print(f"   words -> {WORDS.name}")


if __name__ == "__main__":
    asyncio.run(main())
