#!/usr/bin/env python
"""Word timings for the processed (deep + 1.2x) cinematic narration."""
import json
from pathlib import Path
from faster_whisper import WhisperModel

HERE = Path(__file__).parent
WAV = HERE / "public" / "v2_narration.wav"
OUT = HERE / "src" / "v2_words.json"
SCRIPT = (HERE / "public" / "v2_script.txt").read_text(encoding="utf-8").strip()

model = WhisperModel("small.en", device="cpu", compute_type="int8")
segments, _ = model.transcribe(str(WAV), word_timestamps=True, beam_size=5)
words = []
for seg in segments:
    for w in seg.words:
        words.append({"text": w.word.strip(), "start": round(float(w.start), 3), "end": round(float(w.end), 3)})

OUT.write_text(json.dumps({"script": SCRIPT, "words": words}, indent=0), encoding="utf-8")
print(f"OK -> {OUT.name}: {len(words)} words, ends {words[-1]['end']:.2f}s")
print("--- sentence ends ---")
for i, w in enumerate(words):
    if w["text"].endswith((".", "?", "!")):
        print(f"  idx {i:3d}  t={w['end']:6.2f}  ...{w['text']}")
