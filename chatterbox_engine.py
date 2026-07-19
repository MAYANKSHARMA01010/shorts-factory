# -*- coding: utf-8 -*-
"""chatterbox_engine.py - local Chatterbox TTS engine for the video pipeline.

Runs inside the dedicated venv at C:\\Dikshant\\Money making\\chatterbox-env.
Exposes synthesize(text, out_wav, ...) which writes a 24kHz mono WAV.

Models:
  - "base"  : ChatterboxTTS (500M) built-in default voice, NO reference needed.
  - "turbo" : ChatterboxTurboTTS (350M, distilled, faster) - REQUIRES a >5s
              reference clip (audio_prompt_path). A consistent narrator clip is
              generated once from the base voice and reused for every short.

Includes a runtime monkeypatch fixing the float64/float32 dtype crash in
s3tokenizer.log_mel_spectrogram (the reference-audio voice-clone path on
torch 2.11 + numpy 2.x). No site-packages edits -> survives reinstalls.
"""
import io, sys, os, time, gc, math, re, argparse
import subprocess as _sp
import tempfile as _tf
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import torch
import numpy as np
import soundfile as sf

import shutil as _shutil
FFMPEG = _shutil.which("ffmpeg") or "ffmpeg"  # must be on PATH (brew install ffmpeg on macOS)


# ---- dtype fix --------------------------------------------------------------
# On numpy 2.x, librosa.load/resample return float64, and that float64 reference
# audio collides with the model's float32 weights (s3tokenizer mel matmul AND the
# s3gen RNN). Root fix: force librosa.load/resample to float32 so the whole
# reference-conditioning path stays float32. (No site-packages edits.)
def _patch_dtype():
    import numpy as np
    import librosa

    _orig_load = librosa.load
    def _load_f32(*a, **k):
        y, sr = _orig_load(*a, **k)
        return np.asarray(y, dtype=np.float32), sr
    librosa.load = _load_f32

    _orig_resample = librosa.resample
    def _resample_f32(*a, **k):
        return np.asarray(_orig_resample(*a, **k), dtype=np.float32)
    librosa.resample = _resample_f32

    # belt-and-suspenders: cast the s3tokenizer mel input too
    from chatterbox.models.s3tokenizer import s3tokenizer as s3
    _orig_mel = s3.S3Tokenizer.log_mel_spectrogram
    def _mel_f32(self, audio, padding=0):
        if not torch.is_tensor(audio):
            audio = torch.from_numpy(audio)
        audio = audio.to(self.device).float()
        return _orig_mel(self, audio, padding)
    s3.S3Tokenizer.log_mel_spectrogram = _mel_f32


_patch_dtype()

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
HERE = os.path.dirname(os.path.abspath(__file__))
REF_VOICE = os.path.join(HERE, "narrator_ref.wav")   # the fixed narrator clip

_BASE = None
_TURBO = None


def _save(wav, sr, out_wav):
    os.makedirs(os.path.dirname(os.path.abspath(out_wav)), exist_ok=True)
    sf.write(out_wav, wav.squeeze(0).cpu().numpy(), sr)


def get_base():
    global _BASE
    if _BASE is None:
        from chatterbox.tts import ChatterboxTTS
        _BASE = ChatterboxTTS.from_pretrained(device=DEVICE)
    return _BASE


def get_turbo():
    global _TURBO
    if _TURBO is None:
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        _TURBO = ChatterboxTurboTTS.from_pretrained(device=DEVICE)
    return _TURBO


def ensure_reference():
    """Create a consistent ~7s narrator reference clip from the base voice once."""
    if os.path.exists(REF_VOICE) and os.path.getsize(REF_VOICE) > 10000:
        return REF_VOICE
    base = get_base()
    ref_text = ("Welcome back to the channel. Today we are looking at one of the "
                "strangest stories you will ever hear, so stick around to the very end.")
    rwav = base.generate(ref_text)
    _save(rwav, base.sr, REF_VOICE)
    return REF_VOICE


def synthesize(text, out_wav, model="turbo", exaggeration=0.5, cfg_weight=0.5):
    """Render `text` -> 24kHz mono WAV at out_wav. Returns out_wav path."""
    if model == "base":
        m = get_base()
        wav = m.generate(text, exaggeration=exaggeration, cfg_weight=cfg_weight)
        _save(wav, m.sr, out_wav)
        return out_wav

    # turbo (default): needs a reference clip
    ref = ensure_reference()
    # free the base model VRAM before turbo if it was only loaded for the ref
    m = get_turbo()
    try:
        wav = m.generate(text, audio_prompt_path=ref, exaggeration=exaggeration)
    except TypeError:
        wav = m.generate(text, audio_prompt_path=ref)
    _save(wav, m.sr, out_wav)
    return out_wav


# ---- voice modulation (expressive narration) --------------------------------
# Turbo IGNORES exaggeration/cfg_weight, so dynamic prosody uses the BASE model:
# vary expressiveness PER SENTENCE (natural intonation + pace), then add a subtle
# rubberband pitch/tempo contour on top for literal "highs and lows / slow-fast".

_CLIMAX_WORDS = {
    "suddenly", "snapped", "died", "dead", "killed", "exploded", "shocking",
    "screamed", "crash", "crashed", "blood", "horror", "terrifying", "never",
    "forever", "finally", "secret", "discovered", "realized", "gone", "vanished",
    "trapped", "escaped", "survived", "warning", "danger", "mistake",
}


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _modulation_profile(i, n, sentence, intensity=1.0):
    """Per-sentence (exaggeration, cfg_weight, temperature, pitch, tempo).
    Slow oscillation guarantees highs/lows + slow/fast; content cues
    (punctuation + climax words + length) add storytelling emphasis."""
    frac = i / max(1, n - 1)                       # 0..1 across the narration
    osc  = math.sin(2 * math.pi * (1.5 * frac))    # energy/pace wave   -1..1
    osc2 = math.sin(2 * math.pi * (1.0 * frac) + 1.1)  # pitch wave (offset phase)

    s = sentence.lower()
    excited   = sentence.rstrip().endswith("!")
    question  = sentence.rstrip().endswith("?")
    climactic = any(w in s for w in _CLIMAX_WORDS)
    words = len(sentence.split())

    exag  = 0.50 + 0.14 * osc  * intensity
    cfg   = 0.50 - 0.12 * osc  * intensity         # anti-correlate: emphasis => looser
    temp  = 0.80 + 0.05 * osc2
    pitch = 1.00 + 0.030 * osc2 * intensity        # gentle +/-3%
    tempo = 1.00 + 0.060 * osc  * intensity        # +/-6%

    if excited or climactic:
        exag += 0.12; cfg -= 0.06; pitch += 0.015; tempo += 0.02
    if question:
        pitch += 0.020; tempo -= 0.03
    if climactic:
        tempo -= 0.06                              # slow down for gravity
    if words <= 6:
        tempo += 0.05                              # punchy short lines
    elif words >= 22:
        tempo -= 0.04                              # long lines breathe

    exag  = max(0.30, min(0.85, exag))
    cfg   = max(0.25, min(0.65, cfg))
    temp  = max(0.60, min(0.95, temp))
    pitch = max(0.95, min(1.05, pitch))            # +/-5% hard cap (slight)
    tempo = max(0.86, min(1.14, tempo))            # +/-14% hard cap
    return dict(exaggeration=exag, cfg_weight=cfg, temperature=temp,
                pitch=round(pitch, 4), tempo=round(tempo, 4))


def _apply_pitch_tempo(audio, sr, pitch, tempo):
    """Mono float32 array -> ffmpeg rubberband (independent pitch + tempo)."""
    if abs(pitch - 1.0) < 1e-3 and abs(tempo - 1.0) < 1e-3:
        return audio
    with _tf.TemporaryDirectory() as td:
        ip = os.path.join(td, "in.wav")
        op = os.path.join(td, "out.wav")
        sf.write(ip, audio, sr)
        af = "rubberband=pitch={:.4f}:tempo={:.4f}".format(pitch, tempo)
        _sp.run([FFMPEG, "-y", "-i", ip, "-af", af, op], capture_output=True)
        if os.path.exists(op) and os.path.getsize(op) > 100:
            out, _sr = sf.read(op, dtype="float32")
            return out
    return audio


def synthesize_modulated(text, out_wav, intensity=1.0, gap_ms=110):
    """Expressive narration: base model + per-sentence prosody + pitch/tempo contour."""
    m = get_base()
    sr = m.sr
    sentences = split_sentences(text) or [text]
    gap = np.zeros(int(sr * gap_ms / 1000.0), dtype="float32")
    chunks = []
    for i, s in enumerate(sentences):
        p = _modulation_profile(i, len(sentences), s, intensity)
        wav = m.generate(s, exaggeration=p["exaggeration"],
                         cfg_weight=p["cfg_weight"], temperature=p["temperature"])
        a = wav.squeeze(0).cpu().numpy().astype("float32")
        a = _apply_pitch_tempo(a, sr, p["pitch"], p["tempo"])
        chunks.append(a)
        if i < len(sentences) - 1:
            chunks.append(gap)
        print("  [{}/{}] exag={:.2f} cfg={:.2f} pitch={:.3f} tempo={:.3f} :: {}".format(
            i + 1, len(sentences), p["exaggeration"], p["cfg_weight"],
            p["pitch"], p["tempo"], s[:46]))
    audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    os.makedirs(os.path.dirname(os.path.abspath(out_wav)), exist_ok=True)
    sf.write(out_wav, audio, sr)
    return out_wav


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", default="The speeding car smashed right into the tree, "
                    "breaking his neck and back, and putting him into a coma.")
    ap.add_argument("--text-file", default=None, help="read narration text from this UTF-8 file")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="turbo", choices=["base", "turbo"])
    ap.add_argument("--modulate", action="store_true",
                    help="expressive per-sentence pitch/pace modulation (forces base model)")
    ap.add_argument("--intensity", type=float, default=1.0,
                    help="modulation strength (0=flat .. 1=default .. 1.5=dramatic)")
    args = ap.parse_args()

    if args.text_file:
        with open(args.text_file, encoding="utf-8") as fh:
            args.text = fh.read().strip()

    mode = "modulated(base)" if args.modulate else args.model
    print("device:", DEVICE, "| mode:", mode)
    if DEVICE == "cuda":
        torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    if args.modulate:
        synthesize_modulated(args.text, args.out, intensity=args.intensity)
    else:
        synthesize(args.text, args.out, model=args.model)
    dt = time.time() - t0
    import soundfile as _sf
    info = _sf.info(args.out)
    print("Wrote {} | {:.1f}s audio in {:.1f}s (RTF={:.2f})".format(
        args.out, info.duration, dt, dt / max(info.duration, 0.01)))
    if DEVICE == "cuda":
        print("Peak VRAM: {:.0f} MB".format(torch.cuda.max_memory_allocated() / 1e6))
