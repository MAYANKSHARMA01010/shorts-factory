"""Local text-to-speech for Section B/C narration — Chatterbox (best, MIT) with an
edge-tts fallback. **No Windows SAPI** (removed: robotic quality is the "slop" the
owner rejected; the old GPL-edge note is moot now that Chatterbox — MIT code+weights
— is the primary engine).

Chatterbox needs torch+CUDA, which live in a dedicated venv, so we drive it as an
arms-length SUBPROCESS via `chatterbox_engine.py` (one model load per call; ~3.3 GB
VRAM on a 6 GB card; ~1x realtime). edge-tts (cloud, no GPU) is the fallback when the
GPU/venv is unavailable; it's transcoded to the requested WAV via ffmpeg.

Engine selection — env `CLIPPILOT_TTS`: "auto" (default: Chatterbox→edge), "chatterbox", "edge".
Paths — env `CHATTERBOX_PYTHON`, `CHATTERBOX_ENGINE`, `CHATTERBOX_MODEL` (base|turbo, default base).
Edge voice — env `EDGE_TTS_VOICE` or the `voice=` arg (default en-US-AndrewMultilingualNeural).

Word timing is estimated proportionally (length-weighted) for captions; for exact
timing run faster-whisper over the generated WAV (media/transcribe.py).
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[4]  # shorts-factory root
_DEFAULT_CB_PYTHON = str(_PROJECT_ROOT / "chatterbox-env" / "bin" / "python")
_DEFAULT_CB_ENGINE = str(_PROJECT_ROOT / "chatterbox_engine.py")
_DEFAULT_EDGE_VOICE = "en-US-AndrewMultilingualNeural"


def _cb_python() -> str:
    return os.environ.get("CHATTERBOX_PYTHON", _DEFAULT_CB_PYTHON)


def _cb_engine() -> str:
    return os.environ.get("CHATTERBOX_ENGINE", _DEFAULT_CB_ENGINE)


def chatterbox_available() -> bool:
    """True when the Chatterbox venv python + engine script are both present."""
    return Path(_cb_python()).exists() and Path(_cb_engine()).exists()


def edge_available() -> bool:
    """True when edge-tts can be invoked (importable here or on PATH)."""
    try:
        import edge_tts  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return shutil.which("edge-tts") is not None


def tts_available() -> bool:
    """True when ANY narration engine is usable (Chatterbox or edge-tts). No SAPI."""
    return chatterbox_available() or edge_available()


def _synth_chatterbox(text: str, out_wav: str, timeout: int = 900) -> dict[str, Any]:
    model = os.environ.get("CHATTERBOX_MODEL", "base")
    Path(out_wav).parent.mkdir(parents=True, exist_ok=True)
    # Strip any SSML tags if SSML text was passed
    clean_text = re.sub(r'<[^>]+>', '', text).strip()
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
        tf.write(clean_text)
        textfile = tf.name
    try:
        proc = subprocess.run(
            [_cb_python(), _cb_engine(), "--text-file", textfile,
             "--out", str(Path(out_wav).resolve()), "--model", model],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        return {"available": False, "reason": f"chatterbox: {exc}"}
    finally:
        try:
            os.unlink(textfile)
        except OSError:
            pass
    if Path(out_wav).exists() and Path(out_wav).stat().st_size > 0:
        return {"available": True, "path": out_wav, "engine": "chatterbox"}
    return {"available": False, "reason": (proc.stderr or proc.stdout or "no output")[-400:]}


EMOTION_PROSODY: dict[str, dict[str, str]] = {
    # High energy & comedy
    "excited":    {"rate": "+18%", "pitch": "+16Hz", "volume": "+20%"},
    "hype":       {"rate": "+22%", "pitch": "+18Hz", "volume": "+25%"},
    "funny":      {"rate": "+12%", "pitch": "+12Hz", "volume": "+5%"},
    "playful":    {"rate": "+12%", "pitch": "+12Hz", "volume": "+5%"},
    "happy":      {"rate": "+10%", "pitch": "+10Hz", "volume": "+8%"},
    "cheerful":   {"rate": "+10%", "pitch": "+10Hz", "volume": "+8%"},
    
    # Serious & dramatic
    "serious":    {"rate": "-6%",  "pitch": "-8Hz",  "volume": "+10%"},
    "solemn":     {"rate": "-8%",  "pitch": "-10Hz", "volume": "+8%"},
    "dramatic":   {"rate": "-14%", "pitch": "-10Hz", "volume": "+20%"},
    "suspense":   {"rate": "-14%", "pitch": "-10Hz", "volume": "+20%"},
    "shocked":    {"rate": "+10%", "pitch": "+16Hz", "volume": "+15%"},
    "surprised":  {"rate": "+12%", "pitch": "+14Hz", "volume": "+12%"},
    
    # Whisper & quiet
    "whispering": {"rate": "-10%", "pitch": "-4Hz",  "volume": "-45%"},
    "whisper":    {"rate": "-10%", "pitch": "-4Hz",  "volume": "-45%"},
    "quiet":      {"rate": "-8%",  "pitch": "-4Hz",  "volume": "-35%"},
    "secret":     {"rate": "-10%", "pitch": "-4Hz",  "volume": "-40%"},
    
    # Sad & angry
    "sad":        {"rate": "-15%", "pitch": "-12Hz", "volume": "-15%"},
    "crying":     {"rate": "-18%", "pitch": "-10Hz", "volume": "-20%"},
    "angry":      {"rate": "+15%", "pitch": "+10Hz", "volume": "+30%"},
    "furious":    {"rate": "+20%", "pitch": "+12Hz", "volume": "+35%"},
    "annoyed":    {"rate": "+5%",  "pitch": "+6Hz",  "volume": "+15%"},
    
    # Sarcastic & inquisitive
    "sarcastic":  {"rate": "-5%",  "pitch": "+6Hz",  "volume": "+0%"},
    "confused":   {"rate": "-5%",  "pitch": "+10Hz", "volume": "+0%"},
    "bored":      {"rate": "-12%", "pitch": "-6Hz",  "volume": "-10%"},
    "calm":       {"rate": "-5%",  "pitch": "-4Hz",  "volume": "-5%"},
    "normal":     {"rate": "+0%",  "pitch": "+0Hz",  "volume": "+0%"},
}


def _synth_edge(text: str, out_wav: str, voice: Optional[str] = None, timeout: int = 180) -> dict[str, Any]:
    voice = voice or os.environ.get("EDGE_TTS_VOICE", _DEFAULT_EDGE_VOICE)
    Path(out_wav).parent.mkdir(parents=True, exist_ok=True)

    # Strip XML/HTML and SFX [tag] markers, but keep (emotion) tags for segment parsing
    text_no_sfx = re.sub(r'<[^>]+>', '', text)
    text_no_sfx = re.sub(r'\[[a-zA-Z0-9_]+\]', '', text_no_sfx)

    emotion_pattern = re.compile(r'\(([a-zA-Z][a-zA-Z0-9_]*)\)')
    has_emotions = bool(emotion_pattern.search(text_no_sfx))

    # ── Multi-Emotion Segmented Synthesis ────────────────────────────────────
    if has_emotions:
        segments = []
        last_pos = 0
        current_emotion = "normal"

        for m in emotion_pattern.finditer(text_no_sfx):
            chunk = text_no_sfx[last_pos:m.start()].strip()
            if chunk:
                segments.append({"emotion": current_emotion, "text": chunk})
            current_emotion = m.group(1).lower()
            last_pos = m.end()

        remaining = text_no_sfx[last_pos:].strip()
        if remaining:
            segments.append({"emotion": current_emotion, "text": remaining})

        if segments:
            tmp_dir = Path(tempfile.mkdtemp(prefix="edge_emotion_"))
            wav_files: list[Path] = []
            try:
                import asyncio
                import edge_tts

                async def _synth_all_segments():
                    tasks = []
                    for i, seg in enumerate(segments):
                        em_cfg = EMOTION_PROSODY.get(seg["emotion"], EMOTION_PROSODY["normal"])
                        seg_mp3 = tmp_dir / f"seg_{i:03d}.mp3"
                        seg_wav = tmp_dir / f"seg_{i:03d}.wav"
                        wav_files.append(seg_wav)

                        async def _synth_one(t_text: str, cfg: dict, mp3_p: Path, wav_p: Path):
                            comm = edge_tts.Communicate(
                                t_text,
                                voice,
                                rate=cfg.get("rate", "+0%"),
                                pitch=cfg.get("pitch", "+0Hz"),
                                volume=cfg.get("volume", "+0%"),
                            )
                            await comm.save(str(mp3_p))
                            if mp3_p.exists() and mp3_p.stat().st_size > 0:
                                from .ffmpeg import run_ffmpeg
                                run_ffmpeg([
                                    "-y", "-i", str(mp3_p),
                                    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le",
                                    str(wav_p)
                                ], timeout=60)

                        tasks.append(_synth_one(seg["text"], em_cfg, seg_mp3, seg_wav))
                    await asyncio.gather(*tasks)

                asyncio.run(_synth_all_segments())

                # Validate segments
                valid_wavs = [w for w in wav_files if w.exists() and w.stat().st_size > 0]
                if valid_wavs:
                    concat_list = tmp_dir / "concat.txt"
                    with open(concat_list, "w", encoding="utf-8") as f:
                        for w in valid_wavs:
                            f.write(f"file '{w.resolve()}'\n")

                    from .ffmpeg import run_ffmpeg
                    run_ffmpeg([
                        "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
                        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
                        str(Path(out_wav).resolve())
                    ], timeout=120)

                    if Path(out_wav).exists() and Path(out_wav).stat().st_size > 0:
                        return {"available": True, "path": out_wav, "engine": "edge_emotional", "segments": len(valid_wavs)}
            except Exception as exc:
                print(f"[tts] Segmented emotion synthesis failed, falling back to standard: {exc}")
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)

    # ── Standard Single-Pass Synthesis (Fallback or No Emotions) ──────────────
    clean_text = emotion_pattern.sub('', text_no_sfx)
    clean_text = re.sub(r' {2,}', ' ', clean_text).strip()
    tmp_mp3 = str(Path(out_wav).with_suffix(".edge.mp3"))

    try:
        import asyncio
        import edge_tts
        async def _save():
            comm = edge_tts.Communicate(clean_text, voice)
            await comm.save(tmp_mp3)
        asyncio.run(_save())
    except Exception:
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "edge_tts", "--voice", voice, "--text", clean_text, "--write-media", tmp_mp3],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            return {"available": False, "reason": f"edge-tts: {exc}"}

    if not (Path(tmp_mp3).exists() and Path(tmp_mp3).stat().st_size > 0):
        return {"available": False, "reason": "edge-tts produced no output"}

    if str(out_wav).lower().endswith(".mp3"):
        shutil.move(tmp_mp3, out_wav)
    else:
        from .ffmpeg import run_ffmpeg
        try:
            run_ffmpeg(["-y", "-i", tmp_mp3, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(Path(out_wav).resolve())], timeout=120)
        except Exception as exc:
            return {"available": False, "reason": f"edge transcode: {exc}"}
        finally:
            try:
                os.unlink(tmp_mp3)
            except OSError:
                pass

    if Path(out_wav).exists() and Path(out_wav).stat().st_size > 0:
        return {"available": True, "path": out_wav, "engine": "edge"}
    return {"available": False, "reason": "edge transcode produced no output"}


def synthesize(text: str, out_wav: str, rate: int = 0, voice: Optional[str] = None,
               timeout: int = 900) -> dict[str, Any]:
    """Render `text` → WAV. Chatterbox by default, edge-tts fallback. Returns
    {available, path, engine, ...}. `rate` is accepted for back-compat (ignored).
    `voice` selects the edge-tts voice when the edge engine is used."""
    engine = os.environ.get("CLIPPILOT_TTS", "auto").lower()

    if engine == "edge":
        if edge_available():
            return _synth_edge(text, out_wav, voice, timeout=min(timeout, 300))
        return {"available": False, "reason": "edge-tts not available"}

    # "chatterbox" or "auto": prefer Chatterbox, fall back to edge.
    if engine in ("chatterbox", "auto") and chatterbox_available():
        res = _synth_chatterbox(text, out_wav, timeout=timeout)
        if res.get("available") or engine == "chatterbox":
            return res
    if edge_available():
        return _synth_edge(text, out_wav, voice, timeout=min(timeout, 300))
    return {"available": False, "reason": "no TTS engine available (Chatterbox venv or edge-tts)"}


def word_timings(text: str, duration_s: float) -> list[dict[str, Any]]:
    """Proportional (length-weighted) per-word timing → token captions for
    media/captions.py. Tokens keep a leading space (except the first). For exact
    timing, run faster-whisper over the generated WAV instead."""
    words = text.split()
    if not words or duration_s <= 0:
        return []
    weights = [max(1, len(w)) for w in words]
    total = sum(weights)
    caps: list[dict[str, Any]] = []
    t = 0.0
    for i, (w, wt) in enumerate(zip(words, weights)):
        dur = duration_s * wt / total
        tok = (" " + w) if i > 0 else w
        caps.append({"text": tok, "start_ms": int(t * 1000), "end_ms": int((t + dur) * 1000)})
        t += dur
    return caps


def list_voices() -> list[str]:
    """Recommended narrator voices. Chatterbox uses a built-in/synthetic voice (or a
    cloned reference); these names are the edge-tts fallback voices."""
    return [
        "en-US-AndrewMultilingualNeural",  # warm, confident male — default
        "en-US-AvaMultilingualNeural",      # natural female
        "en-US-AriaNeural",
        "en-GB-RyanNeural",
        "en-GB-SoniaNeural",
    ]
