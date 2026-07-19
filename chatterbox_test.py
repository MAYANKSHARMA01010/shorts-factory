"""
Minimal Chatterbox TTS smoke test -> writes one WAV.

Run with the venv python:
# Usage (macOS / Linux):
#   cd /path/to/shorts-factory
#   chatterbox-env/bin/python chatterbox_test.py

Verifies CUDA, loads a model, synthesizes one sentence, saves out.wav at model.sr (24000 Hz).
First run downloads ~1-2 GB of weights from HuggingFace.
"""
import torch
import torchaudio as ta

print("torch:", torch.__version__, "| cuda available:", torch.cuda.is_available())
device = "cuda" if torch.cuda.is_available() else "cpu"
if device == "cpu":
    print("WARNING: CUDA not available -> running on CPU (slow). Reinstall torch from the cu128 index.")
else:
    print("GPU:", torch.cuda.get_device_name(0))

TEXT = "This is Chatterbox running locally on my own GPU. It sounds far better than Windows speech."

# --- Path A: BASE model (500M). Has a built-in default voice (conds.pt ships in the repo),
#     so audio_prompt_path=None WORKS with no reference clip. Safest first test. ---
from chatterbox.tts import ChatterboxTTS
model = ChatterboxTTS.from_pretrained(device=device)
wav = model.generate(TEXT)                      # built-in voice, no reference needed
ta.save("out.wav", wav, model.sr)               # model.sr == 24000
print("Wrote out.wav (base model) at", model.sr, "Hz")

# --- Path B: TURBO model (350M, lighter VRAM, faster). Uncomment to use. ---
# Turbo REQUIRES a reference voice clip > 5 seconds (unless the turbo repo ships conds.pt;
# do NOT assume audio_prompt_path=None works for Turbo). Pass the SAME ref clip on every
# call to keep a consistent narrator voice.
#
# from chatterbox.tts_turbo import ChatterboxTurboTTS
# tmodel = ChatterboxTurboTTS.from_pretrained(device=device)
# twav = tmodel.generate(TEXT, audio_prompt_path=r"C:\Dikshant\Money making\ref_voice.wav")
# ta.save("out_turbo.wav", twav, tmodel.sr)
# print("Wrote out_turbo.wav (turbo) at", tmodel.sr, "Hz")
