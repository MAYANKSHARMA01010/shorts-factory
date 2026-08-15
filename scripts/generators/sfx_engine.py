"""shorts-factory SFX & Emotion Engine
=====================================
Handles all inline sound-effect and voice-emotion markers in narration scripts.

Marker syntax (works ANYWHERE in script -- start, middle, or end of any line):
  [sfx_tag]   -> plays a sound file at the exact word that marker sits next to
  (emotion)   -> shifts narrator prosody from that point forward

Tag resolution order:
  1. packages/ClipPilot/assets/sfx/<tag>.wav   (bundled presets)
  2. Freesound CC0 API auto-download           (any custom tag you invent)
  3. Skip with warning if both fail            (offline / not found)
"""
from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

log = logging.getLogger("sfx_engine")

# ---- Emotion -> Edge-TTS SSML Prosody mapping --------------------------------
EMOTION_SSML: dict[str, dict[str, str]] = {
    "excited":    {"rate": "fast",   "pitch": "+10%"},
    "funny":      {"rate": "fast",   "pitch": "+8%"},
    "happy":      {"rate": "fast",   "pitch": "+6%"},
    "serious":    {"rate": "slow",   "pitch": "-5%"},
    "sad":        {"rate": "slow",   "pitch": "-8%"},
    "dramatic":   {"rate": "x-slow", "volume": "loud"},
    "whispering": {"rate": "slow",   "volume": "x-soft"},
    "whisper":    {"rate": "slow",   "volume": "x-soft"},
    "sarcastic":  {"rate": "medium", "pitch": "-3%"},
    "angry":      {"rate": "fast",   "pitch": "+5%", "volume": "loud"},
    "confused":   {"rate": "slow",   "pitch": "+3%"},
    "bored":      {"rate": "slow",   "volume": "soft"},
    "normal":     {},
}

_EMOTION_FALLBACKS: dict[str, str] = {
    "shocked":  "dramatic", "surprised": "excited",  "calm":     "serious",
    "scared":   "whispering","terrified": "dramatic", "cheerful": "funny",
    "playful":  "funny",    "solemn":    "serious",
}

# ---- Built-in SFX preset metadata -------------------------------------------
SFX_PRESETS: dict[str, dict[str, str]] = {
    "laugh":          {"emoji": "😂", "desc": "Studio audience laugh",     "search": "studio audience laugh"},
    "chuckle":        {"emoji": "🐿️", "desc": "Soft chuckle",              "search": "soft chuckle"},
    "giggle":         {"emoji": "😄", "desc": "Playful giggle",            "search": "giggle sound"},
    "gasp":           {"emoji": "😱", "desc": "Shocked gasp",              "search": "gasp shocked"},
    "sigh":           {"emoji": "😮", "desc": "Deep sigh",                 "search": "deep sigh"},
    "rimshot":        {"emoji": "🥁", "desc": "Ba-dum-tss drum hit",       "search": "rimshot drum comedy"},
    "sad_trombone":   {"emoji": "😢", "desc": "Wah-wah trombone",          "search": "sad trombone wah wah"},
    "cash_register":  {"emoji": "💰", "desc": "Cha-ching cash register",   "search": "cash register cha ching"},
    "ding":           {"emoji": "🔔", "desc": "Bell ding",                 "search": "bell ding notification"},
    "applause":       {"emoji": "👏", "desc": "Crowd applause",            "search": "crowd applause short"},
    "boo":            {"emoji": "😡", "desc": "Crowd booing",              "search": "crowd booing"},
    "crickets":       {"emoji": "🦗", "desc": "Crickets chirping",         "search": "crickets chirping"},
    "thunder":        {"emoji": "⚡", "desc": "Thunder boom",              "search": "thunder boom dramatic"},
    "dramatic_bass":  {"emoji": "💥", "desc": "Deep bass boom",            "search": "bass boom impact dramatic"},
    "pop":            {"emoji": "🫧", "desc": "Comic pop",                 "search": "comic pop sound"},
    "airhorn":        {"emoji": "📢", "desc": "Loud air horn blast",       "search": "air horn blast"},
    "record_scratch": {"emoji": "📻", "desc": "DJ record scratch",         "search": "record scratch dj"},
    "drum_roll":      {"emoji": "🥁", "desc": "Rolling snare drum",        "search": "snare drum roll"},
    "woosh":          {"emoji": "💨", "desc": "Fast whoosh",               "search": "woosh fast transition"},
    "buzzer":         {"emoji": "❌", "desc": "Game show buzzer",          "search": "game show buzzer wrong"},
}

_SFX_TAG_RE     = re.compile(r'\[([a-zA-Z][a-zA-Z0-9_]*)\]')
_EMOTION_TAG_RE = re.compile(r'\(([a-zA-Z][a-zA-Z0-9_]*)\)')


# =============================================================================
# 1. Script Parser
# =============================================================================

def parse_sfx_markers(script: str) -> tuple[str, list[dict[str, Any]]]:
    """Parse ALL [sfx_tag] and (emotion_tag) markers from script text.

    Markers work at any position -- start, middle, end of any line.
    Returns:
        clean_script:  Text with all markers stripped (safe for TTS).
        events:        List of {type, tag, char_pos, word_index, order}
    """
    raw_events: list[dict[str, Any]] = []
    for m in _SFX_TAG_RE.finditer(script):
        raw_events.append({"type": "sfx", "tag": m.group(1).lower(), "start": m.start(), "end": m.end()})
    for m in _EMOTION_TAG_RE.finditer(script):
        raw_events.append({"type": "emotion", "tag": m.group(1).lower(), "start": m.start(), "end": m.end()})
    raw_events.sort(key=lambda e: e["start"])

    # Build clean script
    clean_script = _SFX_TAG_RE.sub("", script)
    clean_script = _EMOTION_TAG_RE.sub("", clean_script)
    clean_script = re.sub(r" {2,}", " ", clean_script).strip()

    total_words = len(clean_script.split())
    # Build cumulative removal counts
    removal = _build_removal_map(script, raw_events)

    seen_at: dict[int, int] = {}
    events: list[dict[str, Any]] = []
    for ev in raw_events:
        clean_pos = max(0, min(ev["start"] - removal[ev["start"]], len(clean_script)))
        word_index = len(clean_script[:clean_pos].split())
        word_index = max(0, min(word_index, max(total_words - 1, 0)))
        order = seen_at.get(word_index, 0)
        seen_at[word_index] = order + 1
        events.append({"type": ev["type"], "tag": ev["tag"],
                        "char_pos": clean_pos, "word_index": word_index, "order": order})

    return clean_script, events


def _build_removal_map(original: str, raw_events: list[dict]) -> list[int]:
    removal = [0] * (len(original) + 1)
    cumulative = 0
    prev_end = 0
    for ev in raw_events:
        start, end = ev["start"], ev["end"]
        for i in range(prev_end, min(end + 1, len(original) + 1)):
            removal[i] = cumulative
        cumulative += end - start
        prev_end = end
    for i in range(prev_end, len(original) + 1):
        removal[i] = cumulative
    return removal


# =============================================================================
# 2. Timestamp Resolver
# =============================================================================

def locate_sfx_timestamps(
    events: list[dict[str, Any]],
    word_timings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Map each SFX event's word_index -> actual millisecond timestamp.

    word_timings: [{text, start_ms, end_ms}] from tts.word_timings or Whisper.
    Chained tags (order > 0) are spaced 200ms apart.
    """
    sfx_events = [e for e in events if e["type"] == "sfx"]
    if not sfx_events or not word_timings:
        return sfx_events

    resolved = []
    for ev in sfx_events:
        idx = min(ev["word_index"], len(word_timings) - 1)
        base_ms = word_timings[idx].get("start_ms", 0)
        start_ms = base_ms + ev["order"] * 200
        resolved.append({**ev, "start_ms": int(start_ms)})
    return resolved


# =============================================================================
# 3. SFX Asset Resolver
# =============================================================================

def resolve_sfx_asset(tag: str, sfx_dir: str | Path) -> str | None:
    """Find or download the WAV file for `tag`.
    Order: local bundled -> Freesound CC0 -> None + warning.
    """
    sfx_dir = Path(sfx_dir)
    sfx_dir.mkdir(parents=True, exist_ok=True)
    wav_path = sfx_dir / f"{tag}.wav"

    if wav_path.exists() and wav_path.stat().st_size > 0:
        return str(wav_path)

    log.info("SFX [%s] not bundled -- trying Freesound CC0...", tag)
    if _freesound_download(tag, wav_path):
        return str(wav_path)

    log.warning("SFX [%s] not found -- will be skipped", tag)
    return None


def _freesound_download(tag: str, out_wav: Path) -> bool:
    api_key = os.environ.get("FREESOUND_API_KEY", "")
    if not api_key:
        return False
    query = SFX_PRESETS.get(tag, {}).get("search", f"{tag.replace('_',' ')} sound effect short")
    url = (f"https://freesound.org/apiv2/search/text/?query={urllib.request.quote(query)}"
           f"&filter=license%3A%22Creative+Commons+0%22&fields=id,name,previews"
           f"&page_size=1&token={api_key}")
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read().decode())
        results = data.get("results", [])
        if not results:
            return False
        preview_url = (results[0]["previews"].get("preview-hq-mp3") or
                       results[0]["previews"].get("preview-lq-mp3"))
        if not preview_url:
            return False
        tmp_mp3 = out_wav.with_suffix(".freesound.mp3")
        with urllib.request.urlopen(preview_url, timeout=15) as r:
            tmp_mp3.write_bytes(r.read())
        if not tmp_mp3.exists() or tmp_mp3.stat().st_size < 1000:
            return False
        res = subprocess.run(["ffmpeg", "-y", "-i", str(tmp_mp3),
                               "-ar", "48000", "-ac", "1", str(out_wav)],
                             capture_output=True, timeout=30)
        tmp_mp3.unlink(missing_ok=True)
        return out_wav.exists() and out_wav.stat().st_size > 0
    except Exception as exc:
        log.warning("Freesound download failed for [%s]: %s", tag, exc)
        return False


# =============================================================================
# 4. SFX FFmpeg Mixer
# =============================================================================

def mix_sfx_into_narration(
    narration_wav: str,
    sfx_events_ms: list[dict[str, Any]],
    sfx_dir: str | Path,
    out_wav: str,
    sfx_volume: float = 0.75,
) -> str:
    """Mix SFX into narration WAV using FFmpeg adelay + amix.

    Returns out_wav (or copies narration_wav unchanged if nothing resolved).
    """
    import shutil
    sfx_dir = Path(sfx_dir)
    Path(out_wav).parent.mkdir(parents=True, exist_ok=True)

    resolved: list[dict[str, Any]] = []
    for ev in sfx_events_ms:
        asset = resolve_sfx_asset(ev["tag"], sfx_dir)
        if asset:
            resolved.append({**ev, "asset": asset})
        else:
            log.warning("Skipping SFX [%s] -- no asset found", ev["tag"])

    if not resolved:
        shutil.copy2(narration_wav, out_wav)
        return out_wav

    cmd = ["ffmpeg", "-y", "-i", str(narration_wav)]
    for ev in resolved:
        cmd += ["-i", ev["asset"]]

    n_sfx = len(resolved)
    filter_parts: list[str] = []
    for i, ev in enumerate(resolved):
        d = ev["start_ms"]
        filter_parts.append(f"[{i+1}:a]volume={sfx_volume},adelay={d}|{d}[s{i}]")

    sfx_labels = "".join(f"[s{i}]" for i in range(n_sfx))
    filter_parts.append(
        f"[0:a]{sfx_labels}amix=inputs={n_sfx+1}:duration=first:dropout_transition=1[a]"
    )
    codec_args = ["-c:a", "pcm_s16le", "-ar", "48000"] if str(out_wav).endswith(".wav") else ["-c:a", "aac", "-ar", "48000", "-b:a", "320k"]
    cmd += [
        "-filter_complex", ";".join(filter_parts),
        "-map", "[a]",
        *codec_args,
        "-y", str(out_wav),
    ]

    log.info("Mixing %d SFX into narration...", n_sfx)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0 or not Path(out_wav).exists():
        log.error("FFmpeg SFX mix failed: %s", result.stderr[-500:])
        shutil.copy2(narration_wav, out_wav)
        return out_wav
    return out_wav


# =============================================================================
# 5. SSML Emotion Builder (Edge-TTS)
# =============================================================================

def build_ssml_with_emotions(
    clean_script: str,
    emotion_events: list[dict[str, Any]],
) -> str:
    """Wrap segments in Edge-TTS SSML prosody based on emotion events.
    Unknown emotions map to closest built-in via _EMOTION_FALLBACKS.
    """
    if not emotion_events:
        return _wrap_ssml_speak(clean_script)

    events = sorted(emotion_events, key=lambda e: e["char_pos"])
    parts: list[str] = []
    cursor = 0
    open_prosody = False

    for ev in events:
        pos = ev["char_pos"]
        tag = ev["tag"].lower()
        if tag not in EMOTION_SSML:
            tag = _EMOTION_FALLBACKS.get(tag, "normal")

        segment = clean_script[cursor:pos]
        if segment:
            parts.append(segment)

        if open_prosody:
            parts.append("</prosody>")
            open_prosody = False

        ssml_attrs = EMOTION_SSML.get(tag, {})
        if ssml_attrs:
            attrs_str = " ".join(f'{k}="{v}"' for k, v in ssml_attrs.items())
            parts.append(f"<prosody {attrs_str}>")
            open_prosody = True

        cursor = pos

    remaining = clean_script[cursor:]
    if remaining:
        parts.append(remaining)
    if open_prosody:
        parts.append("</prosody>")

    return _wrap_ssml_speak("".join(parts))


def _wrap_ssml_speak(body: str) -> str:
    return ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            'xml:lang="en-US">' + body + "</speak>")


# =============================================================================
# 6. SFX Library (for /api/sfx/library endpoint)
# =============================================================================

def get_sfx_library() -> list[dict[str, str]]:
    return [
        {"tag": tag, "emoji": meta["emoji"], "description": meta["desc"],
         "preview_url": f"/api/sfx/preview/{tag}"}
        for tag, meta in SFX_PRESETS.items()
    ]


# =============================================================================
# 7. Offline Preset WAV Generator (FFmpeg tone/noise synthesis)
# =============================================================================

_GENERATORS: dict[str, list[str]] = {
    "laugh":         ["-f","lavfi","-i","sine=frequency=880:duration=0.8",    "-af","tremolo=f=12:d=0.8"],
    "chuckle":       ["-f","lavfi","-i","sine=frequency=660:duration=0.4",    "-af","tremolo=f=8:d=0.6"],
    "giggle":        ["-f","lavfi","-i","sine=frequency=1200:duration=0.5",   "-af","tremolo=f=15:d=0.7"],
    "gasp":          ["-f","lavfi","-i","sine=frequency=400:duration=0.5",    "-af","afade=t=in:st=0:d=0.05,afade=t=out:st=0.4:d=0.1"],
    "sigh":          ["-f","lavfi","-i","anoisesrc=color=brown:duration=1.0", "-af","lowpass=f=500,afade=t=in:st=0:d=0.3,afade=t=out:st=0.7:d=0.3"],
    "rimshot":       ["-f","lavfi","-i","sine=frequency=200:duration=0.6",    "-af","afade=t=out:st=0.1:d=0.5"],
    "sad_trombone":  ["-f","lavfi","-i","sine=frequency=300:duration=1.5",    "-af","vibrato=f=5:d=0.5"],
    "cash_register": ["-f","lavfi","-i","sine=frequency=1500:duration=0.3",   "-af","afade=t=out:st=0.1:d=0.2"],
    "ding":          ["-f","lavfi","-i","sine=frequency=1800:duration=0.8",   "-af","afade=t=out:st=0.3:d=0.5"],
    "applause":      ["-f","lavfi","-i","anoisesrc=color=white:duration=2.0", "-af","bandpass=f=2000:width_type=h:w=2000"],
    "boo":           ["-f","lavfi","-i","anoisesrc=color=brown:duration=1.5", "-af","lowpass=f=800"],
    "crickets":      ["-f","lavfi","-i","sine=frequency=4000:duration=2.0",   "-af","tremolo=f=30:d=0.9"],
    "thunder":       ["-f","lavfi","-i","anoisesrc=color=brown:duration=1.5", "-af","lowpass=f=200,afade=t=in:st=0:d=0.05"],
    "dramatic_bass": ["-f","lavfi","-i","sine=frequency=60:duration=0.8",     "-af","afade=t=out:st=0.5:d=0.3"],
    "pop":           ["-f","lavfi","-i","sine=frequency=800:duration=0.2",    "-af","afade=t=out:st=0.05:d=0.15"],
    "airhorn":       ["-f","lavfi","-i","sine=frequency=450:duration=1.0",    "-af","vibrato=f=3:d=0.3"],
    "record_scratch":["-f","lavfi","-i","anoisesrc=color=white:duration=0.5", "-af","highpass=f=1000"],
    "drum_roll":     ["-f","lavfi","-i","anoisesrc=color=white:duration=1.5", "-af","bandpass=f=300:width_type=h:w=300,tremolo=f=20:d=0.8"],
    "woosh":         ["-f","lavfi","-i","anoisesrc=color=white:duration=0.5", "-af","highpass=f=2000,afade=t=in:st=0:d=0.1,afade=t=out:st=0.4:d=0.1"],
    "buzzer":        ["-f","lavfi","-i","sine=frequency=250:duration=0.8",    "-af","vibrato=f=20:d=0.9"],
}


def generate_preset_sfx(sfx_dir: str | Path) -> dict[str, bool]:
    """Generate all preset SFX WAVs using FFmpeg tone/noise synthesis (offline)."""
    sfx_dir = Path(sfx_dir)
    sfx_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, bool] = {}
    for tag, filter_args in _GENERATORS.items():
        out = sfx_dir / f"{tag}.wav"
        if out.exists() and out.stat().st_size > 0:
            results[tag] = True
            continue
        cmd = ["ffmpeg", "-y"] + filter_args + ["-ar", "48000", "-ac", "1", str(out)]
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=15)
            ok = r.returncode == 0 and out.exists() and out.stat().st_size > 0
        except Exception as exc:
            log.warning("Error generating SFX [%s]: %s", tag, exc)
            ok = False
        results[tag] = ok
        if not ok:
            log.warning("Failed to generate SFX [%s]", tag)
    success = sum(1 for v in results.values() if v)
    log.info("Generated %d/%d SFX presets in %s", success, len(results), sfx_dir)
    return results


# =============================================================================
# CLI
# =============================================================================
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) > 1 and sys.argv[1] == "generate-presets":
        sfx_dir = sys.argv[2] if len(sys.argv) > 2 else "packages/ClipPilot/assets/sfx"
        print(f"Generating preset SFX WAVs in: {sfx_dir}")
        results = generate_preset_sfx(sfx_dir)
        for tag, ok in results.items():
            print(f"  {'OK' if ok else 'FAIL'} [{tag}]")
        sys.exit(0)

    # Self-test
    test_script = (
        "[thunder] Breaking news! Trees announced [laugh] an oxygen tax!\n"
        "The rate? [ding] Five cents per breath. [cash_register]\n"
        "One man (whispering) owed forty-seven dollars. [gasp]\n"
        "(serious) Pay up... or stop breathing! [dramatic_bass]\n"
        "(funny) Subscribe now! [applause] Plants coming soon!"
    )
    clean, events = parse_sfx_markers(test_script)
    print("=== Clean Script ===")
    print(clean)
    print(f"\n=== Events ({len(events)}) ===")
    for ev in events:
        print(f"  {ev['type']:8s} [{ev['tag']:16s}] word_idx={ev['word_index']} order={ev['order']}")
    emotions = [e for e in events if e["type"] == "emotion"]
    print("\n=== SSML snippet ===")
    ssml = build_ssml_with_emotions(clean, emotions)
    print(ssml[:400] + ("..." if len(ssml) > 400 else ""))
