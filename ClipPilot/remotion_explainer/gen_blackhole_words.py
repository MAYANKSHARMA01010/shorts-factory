#!/usr/bin/env python
"""Transcribe the Chatterbox narration WAV with faster-whisper to get per-word
timestamps, then write blackhole_words.json in the format the Remotion
composition expects: {"script": "...", "words": [{text,start,end}, ...]}.

Run with SYSTEM python (faster-whisper lives there):
  python gen_blackhole_words.py
"""
import json
from pathlib import Path

from faster_whisper import WhisperModel

HERE = Path(__file__).parent
WAV = HERE / "public" / "blackhole_narration.wav"
OUT = HERE / "public" / "blackhole_words.json"
SCRIPT = (HERE / "blackhole_script.txt").read_text(encoding="utf-8").strip()

model = WhisperModel("small.en", device="cpu", compute_type="int8")
segments, info = model.transcribe(str(WAV), word_timestamps=True, beam_size=5)

words = []
for seg in segments:
    for w in seg.words:
        words.append(
            {
                "text": w.word.strip(),
                "start": round(float(w.start), 3),
                "end": round(float(w.end), 3),
            }
        )

OUT.write_text(json.dumps({"script": SCRIPT, "words": words}, indent=0), encoding="utf-8")
print(f"OK -> {OUT.name}: {len(words)} words, audio ends {words[-1]['end']:.2f}s")
# print scene-break candidates (sentence boundaries) to help set scene timing
print("--- sentence-end word times ---")
for i, w in enumerate(words):
    if w["text"].endswith((".", "?", "!")):
        print(f"  idx {i:3d}  t={w['end']:6.2f}s  ...{w['text']}")
