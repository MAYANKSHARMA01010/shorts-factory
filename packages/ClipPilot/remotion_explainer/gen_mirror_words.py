#!/usr/bin/env python
"""Word-level timings for mirror_narration.mp3 via faster-whisper.

edge-tts 7.2.8 stopped emitting per-WordBoundary events (SentenceBoundary only),
so we time the words off the rendered audio the same way gen_v2_words.py does.
Output drives both the karaoke captions and scene boundaries in Mirror.tsx.

Run:  python gen_mirror_words.py
"""
import json
from pathlib import Path
from faster_whisper import WhisperModel

HERE = Path(__file__).parent
MP3 = HERE / "public" / "mirror_narration.mp3"
OUT = HERE / "src" / "mirror_words.json"
SCRIPT = json.loads(OUT.read_text(encoding="utf-8"))["script"] if OUT.exists() else ""

model = WhisperModel("small.en", device="cpu", compute_type="int8")
segments, _ = model.transcribe(str(MP3), word_timestamps=True, beam_size=5)
words = []
for seg in segments:
    for w in seg.words:
        words.append({"text": w.word.strip(), "start": round(float(w.start), 3), "end": round(float(w.end), 3)})

OUT.write_text(json.dumps({"script": SCRIPT, "words": words}, indent=0), encoding="utf-8")
print(f"OK -> {OUT.name}: {len(words)} words, ends {words[-1]['end']:.2f}s")
print("--- sentence ends (scene boundary candidates) ---")
for i, w in enumerate(words):
    if w["text"].endswith((".", "?", "!")):
        print(f"  idx {i:3d}  t={w['end']:6.2f}  ...{w['text']}")
