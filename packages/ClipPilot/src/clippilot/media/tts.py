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
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
        tf.write(text)
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


def _synth_edge(text: str, out_wav: str, voice: Optional[str] = None, timeout: int = 180) -> dict[str, Any]:
    voice = voice or os.environ.get("EDGE_TTS_VOICE", _DEFAULT_EDGE_VOICE)
    Path(out_wav).parent.mkdir(parents=True, exist_ok=True)
    tmp_mp3 = str(Path(out_wav).with_suffix(".edge.mp3"))
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "edge_tts", "--voice", voice, "--text", text, "--write-media", tmp_mp3],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        return {"available": False, "reason": f"edge-tts: {exc}"}
    if not (Path(tmp_mp3).exists() and Path(tmp_mp3).stat().st_size > 0):
        return {"available": False, "reason": (proc.stderr or "edge-tts produced no output")[-400:]}
    # Transcode to the requested path (usually .wav) so downstream gets a real WAV.
    if str(out_wav).lower().endswith(".mp3"):
        shutil.move(tmp_mp3, out_wav)
    else:
        from .ffmpeg import run_ffmpeg
        try:
            run_ffmpeg(["-y", "-i", tmp_mp3, "-ar", "24000", "-ac", "1", str(Path(out_wav).resolve())], timeout=120)
        except Exception as exc:  # noqa: BLE001
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
