#!/usr/bin/env python
"""Generalized narration + word-timing step for the reimagined-transcript shorts.

Reads a transcript .txt, synthesizes the house narrator (edge-tts Andrew), then
times the words off the rendered audio with faster-whisper (edge-tts 7.2.8 only
emits SentenceBoundary). Writes:
    public/<slug>_narration.mp3   (used by the Remotion comp via staticFile)
    src/<slug>_words.json         ({script, words[]}) drives captions + scene timing

Usage:
    python make_narration.py --txt "../../reimagined transcripts/002_pink-paste-inside-hot-dogs.txt" --slug hotdog
"""
import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"
RATE = "-4%"
HERE = Path(__file__).parent


async def synth(script: str, mp3: Path, voice: str = VOICE, rate: str = RATE) -> None:
    communicate = edge_tts.Communicate(script, voice, rate=rate)
    with open(mp3, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])


def time_words(mp3: Path):
    from faster_whisper import WhisperModel

    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(mp3), word_timestamps=True, beam_size=5)
    words = []
    for seg in segments:
        for w in seg.words:
            words.append({"text": w.word.strip(), "start": round(float(w.start), 3), "end": round(float(w.end), 3)})
    return words


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--txt", required=True, help="transcript .txt path")
    ap.add_argument("--slug", required=True, help="output basename (e.g. hotdog)")
    ap.add_argument("--voice", default=VOICE, help="edge-tts voice ShortName (see variation/voices.md)")
    ap.add_argument("--rate", default=RATE, help="edge-tts rate, e.g. -4%% or +6%%")
    args = ap.parse_args()

    script = Path(args.txt).read_text(encoding="utf-8").strip().replace("\n", " ")
    mp3 = HERE / "public" / f"{args.slug}_narration.mp3"
    words_out = HERE / "src" / f"{args.slug}_words.json"
    mp3.parent.mkdir(parents=True, exist_ok=True)
    words_out.parent.mkdir(parents=True, exist_ok=True)

    asyncio.run(synth(script, mp3, args.voice, args.rate))
    words = time_words(mp3)
    words_out.write_text(json.dumps({"script": script, "words": words}, indent=0), encoding="utf-8")

    dur = words[-1]["end"] if words else 0.0
    print(f"OK -> {mp3.name} + {words_out.name}: {len(words)} words, ends {dur:.2f}s ({round(dur*30)} frames @30fps)")
    print("--- sentence ends (scene boundary candidates, frames@30) ---")
    for i, w in enumerate(words):
        if w["text"].endswith((".", "?", "!")):
            print(f"  idx {i:3d}  t={w['end']:6.2f}  frame={round(w['end']*30):4d}  ...{w['text']}")


if __name__ == "__main__":
    main()
