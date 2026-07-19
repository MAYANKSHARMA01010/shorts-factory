# -*- coding: utf-8 -*-
"""pipeline.py — director-brief-driven, strictly <=20s short producer.

The orchestrator for the `ultimate-short` skill. One brief.json -> finished
1080x1920 short. Self-contained in this skill folder; references the project's
shared resources (venvs, Z-Image, sound library, punchy-recut) by path.

  * beat-based timeline (mixed visual types) instead of 3 parallel arrays,
  * a HARD <=20s cap enforced post-TTS via a pitch-preserving atempo ramp,
  * dynamic, colorful, per-beat captions (director_brief.write_styled_ass),
  * a per-beat SFX bed from semantic cues (assets/sound_effects),
  * a pluggable per-beat visual renderer (Phase 0/1 renders every beat as a
    Z-Image still; Phase 2+ adds animation / 3D / avatar / micro-video).

GPU models (Chatterbox, Z-Image) are each shelled into their own venv subprocess
and fully exit before the next loads — required to stay inside 6GB VRAM.

Usage (from anywhere):
  python .claude/skills/ultimate-short/pipeline.py --brief .claude/skills/ultimate-short/briefs/<slug>.json
  ... --skip-images          reuse existing beat stills
  ... --recut                run punchy-recut as a finishing pass
  ... --gameplay-dir DIR     stack over gameplay (implies --recut)
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parent                 # .../ultimate-short
PROJECT_ROOT = Path(__file__).resolve().parents[3]    # .../Money making
sys.path.insert(0, str(PKG))
import director_brief as db  # noqa: E402
from renderers import render_beat, RenderError  # noqa: E402

# macOS/Linux: venvs use bin/python; Windows uses Scripts/python.exe
import sys as _sys
_venv_bin = "Scripts" if _sys.platform == "win32" else "bin"
_py_exe = "python.exe" if _sys.platform == "win32" else "python"
IMGGEN_PY = PROJECT_ROOT / "imggen-env" / _venv_bin / _py_exe
ZIMAGE_GEN = PROJECT_ROOT / "zimage_gen.py"
CB_PY = PROJECT_ROOT / "chatterbox-env" / _venv_bin / _py_exe
CB_ENGINE = PROJECT_ROOT / "chatterbox_engine.py"
RECUT = PROJECT_ROOT / ".claude" / "skills" / "punchy-recut" / "recut.py"

OUT_DIR = PKG / "output"

DEFAULT_STYLE = (
    "cinematic photorealistic film still, shallow depth of field, 85mm lens, "
    "dramatic lighting, fine detail, atmospheric, vertical composition"
)


def run(args, *, cwd=None):
    subprocess.run([str(a) for a in args], cwd=cwd, check=True)


def probe_duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "json", str(path)], check=True, capture_output=True, text=True)
    return float(json.loads(r.stdout)["format"]["duration"])


# ---------------------------------------------------------------------------
# Narration + the authoritative <=20s clamp
# ---------------------------------------------------------------------------
def synthesize_narration(text: str, out: Path, work: Path, allow_edge: bool = False) -> None:
    """Chatterbox is the ONLY audio engine for ultimate-short (owner rule: audio = Chatterbox
    only). No audio diffusion; no default edge-tts. If the chatterbox-env is missing we fail
    loudly rather than silently swapping in a different voice app. --allow-edge is an explicit
    emergency override only and prints a warning."""
    text_file = work / "narration.txt"
    text_file.write_text(text, encoding="utf-8")
    if CB_PY.exists() and CB_ENGINE.exists():
        run([CB_PY, CB_ENGINE, "--text-file", text_file, "--out", out, "--model", "base"])
        return
    if not allow_edge:
        raise SystemExit(
            f"Chatterbox is the only permitted audio engine, but chatterbox-env was not found "
            f"at {CB_PY}. Repair the venv (no other audio app is allowed). Pass --allow-edge "
            f"ONLY as an explicit emergency override.")
    print("[ultimate] WARN --allow-edge: using edge-tts emergency fallback (NOT Chatterbox)", flush=True)
    mp3 = out.with_suffix(".edge.mp3")
    run([sys.executable, "-m", "edge_tts", "--voice", "en-US-AndrewMultilingualNeural",
         "--text", text, "--write-media", mp3])
    run(["ffmpeg", "-hide_banner", "-y", "-i", mp3, "-ar", "24000", "-ac", "1", out])


def cap_narration(narration: Path, work: Path) -> tuple[Path, float]:
    """Return (audio_path, duration) guaranteed <= SOFT_TARGET via atempo if needed."""
    dur = probe_duration(narration)
    target = db.SOFT_TARGET_SECONDS
    if dur <= target + 0.5:
        return narration, dur
    speed = dur / target
    if speed > 2.0:
        print(f"[ultimate] WARN narration {dur:.1f}s needs {speed:.2f}x (>2.0 atempo limit); "
              f"clamping to 2.0 — final may exceed cap. Shorten the script.", flush=True)
        speed = 2.0
    capped = work / "narration_capped.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", narration,
         "-filter:a", f"atempo={speed:.4f}", "-ar", "24000", "-ac", "1", capped])
    new_dur = probe_duration(capped)
    print(f"[ultimate] narration {dur:.2f}s -> {new_dur:.2f}s (atempo {speed:.3f}x) to fit <=20s", flush=True)
    return capped, new_dur


# ---------------------------------------------------------------------------
# Per-beat visuals — Phase 0/1: everything renders as a Z-Image still.
# (Phase 2+ swaps animation/three_d/avatar/micro_video to their real renderers.)
# ---------------------------------------------------------------------------
def _cap_text(beat: dict) -> str:
    cap = beat.get("caption") or {}
    return str(cap.get("text", "")).replace("\\n", " ").replace("\n", " ").strip()


def beat_image_prompt(beat: dict, brief: dict) -> str:
    sp = str(beat.get("scene_prompt", "")).strip()
    if sp:
        base = sp
    else:
        vis = beat.get("visual")
        if vis == "three_d":
            subj = (beat.get("three_d") or {}).get("subject", "abstract structure")
            base = f"clean 3D render of {subj}, studio lighting, dark background, depth"
        elif vis == "animation":
            scn = (beat.get("animation") or {}).get("scene") or _cap_text(beat)
            base = f"bold dynamic motion-graphic illustration of {scn}, vivid colors"
        elif vis == "avatar":
            kind = ((brief.get("brief") or {}).get("avatar") or {}).get("kind") or "person"
            base = f"expressive portrait of a {kind}, friendly, soft studio key light, looking at camera"
        else:
            base = _cap_text(beat) or brief.get("brief", {}).get("hook", "cinematic scene")
    style = brief.get("style") or DEFAULT_STYLE
    return f"{base.rstrip(', ')}, {style}"


def generate_beat_images(brief: dict, work: Path) -> list[Path]:
    """Generate one Z-Image still per beat in a single batch (one model load)."""
    assets = work / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    beats = brief["beats"]
    outs = [assets / f"beat_{i:02d}.png" for i in range(len(beats))]
    seed = int(brief.get("seed", 7))
    jobs = {
        "defaults": {"height": int(brief.get("gen_h", 896)), "width": int(brief.get("gen_w", 512)),
                     "steps": 8, "guidance": 1.0, "seed": seed},
        "jobs": [{"prompt": beat_image_prompt(b, brief), "out": str(o), "seed": seed + i}
                 for i, (b, o) in enumerate(zip(beats, outs))],
    }
    (work / "jobs.json").write_text(json.dumps(jobs, indent=2), encoding="utf-8")
    print(f"[ultimate] generating {len(outs)} beat stills via Z-Image ...", flush=True)
    run([IMGGEN_PY, ZIMAGE_GEN, "--jobs", work / "jobs.json"])
    missing = [o.name for o in outs if not o.exists()]
    if missing:
        raise SystemExit(f"image generation failed for: {missing}")
    return outs


def make_scene(image: Path, out: Path, seconds: float, index: int) -> None:
    """Ken-Burns a still into a beat clip (ported from produce_short_zimage.py)."""
    frames = max(1, math.ceil(seconds * 30))
    d = index % 4
    if d == 0:
        x, y = "'iw/2-(iw/zoom/2)'", "'ih/2-(ih/zoom/2)'"
    elif d == 1:
        x, y = "'(iw-iw/zoom)*(on/(duration*30))'", "'ih/2-(ih/zoom/2)'"
    elif d == 2:
        x, y = "'iw/2-(iw/zoom/2)'", "'(ih-ih/zoom)*(1-on/(duration*30))'"
    else:
        x, y = "'(iw-iw/zoom)*(1-on/(duration*30))'", "'ih/2-(ih/zoom/2)'"
    vf = (
        "scale=1300:2312:force_original_aspect_ratio=increase,crop=1300:2312,"
        f"zoompan=z='1+0.075*on/{frames}':d={frames}:x={x}:y={y}:s=1080x1920:fps=30,"
        "eq=contrast=1.06:saturation=1.10:brightness=-0.012,unsharp=5:5:0.55,"
        f"fade=t=in:st=0:d=0.18,fade=t=out:st={max(0, seconds - 0.20):.3f}:d=0.20,format=yuv420p"
    )
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", image,
         "-t", f"{seconds:.3f}", "-vf", vf, "-an", "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "18", out])


def make_avatar_clip(image: Path, out: Path, seconds: float) -> None:
    """Animate a Z-Image portrait into a 'living portrait' talking avatar — a
    speech-rhythm head bob + slow sway, headless via ffmpeg. Works for ANY subject
    (person / animal / creature), unlike human-only Wav2Lip; reliable on 6GB.
    """
    bob_hz = 2.6  # speech-cadence vertical bob
    vf = (
        "scale=1300:2312:force_original_aspect_ratio=increase,crop=1300:2312,"
        "crop=1080:1920:"
        "x='(in_w-1080)/2 + 16*sin(2*PI*0.45*t)':"
        f"y='(in_h-1920)/2 + 22*sin(2*PI*{bob_hz}*t) + 10*sin(2*PI*0.7*t)',"
        # talking heads read better bright — lift exposure (don't darken like make_scene)
        "eq=contrast=1.04:saturation=1.12:brightness=0.028,unsharp=5:5:0.5,"
        f"fade=t=in:st=0:d=0.18,fade=t=out:st={max(0, seconds - 0.20):.3f}:d=0.20,format=yuv420p"
    )
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", image,
         "-t", f"{seconds:.3f}", "-vf", vf, "-an", "-r", "30", "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "18", out])


# ---------------------------------------------------------------------------
# Per-beat SFX bed (non-voice audio from semantic cues) — req #4
# ---------------------------------------------------------------------------
def build_sfx_bed(timed_beats, total_dur: float, work: Path):
    # input 0 = silent base (lavfi anullsrc); inputs 1..n = the n cue files.
    cue_inputs, filt, labels = [], [], []
    n = 0
    for start, end, beat in timed_beats:
        cue = (beat.get("sfx") or {}).get("cue")
        path = db.resolve_cue(cue)
        if not path:
            continue
        gain = float((beat.get("sfx") or {}).get("gain", 0.5))
        at = (beat.get("sfx") or {}).get("at", "start")
        t = start if at == "start" else max(0.0, end - 0.4)
        delay = max(0, int(t * 1000))
        in_idx = n + 1
        cue_inputs += ["-i", str(path)]
        filt.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,"
                    f"volume={gain:.2f},adelay={delay}|{delay}[s{n}]")
        labels.append(f"[s{n}]")
        n += 1
    if n == 0:
        return None
    bed = work / "sfx_bed.wav"
    mix = "[0:a]" + "".join(labels) + f"amix=inputs={n + 1}:normalize=0:duration=first[mix]"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={total_dur:.3f}", *cue_inputs,
         "-filter_complex", ";".join(filt + [mix]),
         "-map", "[mix]", "-t", f"{total_dur:.3f}", bed])
    return bed


# ---------------------------------------------------------------------------
# Compose: motion clips -> concat -> captions + audio mix
# ---------------------------------------------------------------------------
def compose(brief: dict, images: list[Path], narration: Path, audio_dur: float,
            work: Path, out_path: Path) -> float:
    beats = brief["beats"]
    timed = db.derive_beat_times(beats, audio_dur)
    palette = (brief.get("brief") or {}).get("palette") or []

    clips = []
    for i, ((start, end, beat), image) in enumerate(zip(timed, images), start=1):
        clip = work / f"clip_{i:02d}.mp4"
        seconds = max(0.4, end - start)
        vis = beat.get("visual", "still")
        if vis in ("animation", "three_d", "micro_video"):
            # real engine (HyperFrames / Remotion-R3F / camera-fly); fall back to the
            # Z-Image still poster on ANY engine failure so the pipeline never breaks.
            try:
                render_beat(beat, seconds, clip, size=(1080, 1920), palette=palette)
                print(f"[ultimate] beat {i} ({vis}) rendered via engine", flush=True)
            except RenderError as e:
                print(f"[ultimate] WARN beat {i} {vis} engine failed ({e}); "
                      f"falling back to Z-Image still", flush=True)
                make_scene(image, clip, seconds, i)
        elif vis == "avatar":
            # universal "living portrait" talking avatar (any subject), headless via ffmpeg
            make_avatar_clip(image, clip, seconds)
            print(f"[ultimate] beat {i} (avatar) living-portrait", flush=True)
        else:  # still (and not-yet-wired micro_video) -> Z-Image poster Ken-Burns
            make_scene(image, clip, seconds, i)
        clips.append(clip)

    (work / "concat.txt").write_text("".join(f"file '{c.name}'\n" for c in clips), encoding="utf-8")
    silent = work / "silent.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", "concat.txt", "-c", "copy", silent.name], cwd=work)

    db.write_styled_ass(timed, brief.get("caption_styles", {}), work / "captions.ass")
    bed = build_sfx_bed(timed, audio_dur, work)

    final_vf = ("drawbox=x=0:y=1430:w=iw:h=490:color=black@0.18:t=fill,"
                "ass=captions.ass,vignette=PI/6")
    inputs = ["-i", silent.name, "-i", narration.name]
    amix_parts = ["[1:a]volume=1.0[voice]"]
    amix_inputs = "[voice]"
    n_aud = 1
    if bed is not None:
        inputs += ["-i", bed.name]
        amix_parts.append("[2:a]volume=1.0[sfx]")
        amix_inputs += "[sfx]"
        n_aud += 1
    afilter = ";".join(amix_parts) + ";" + amix_inputs + \
        f"amix=inputs={n_aud}:normalize=0:duration=first,loudnorm=I=-15:TP=-1.5:LRA=11[a]"

    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
         "-filter_complex", f"[0:v]{final_vf}[v];{afilter}",
         "-map", "[v]", "-map", "[a]", "-t", f"{audio_dur:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out_path.resolve())],
        cwd=work)
    return probe_duration(out_path)


# ---------------------------------------------------------------------------
# Optional finishing: punchy-recut (+ gameplay)
# ---------------------------------------------------------------------------
def finish_recut(out_path: Path, gameplay_dir):
    args = [sys.executable, RECUT, "--input", out_path, "--speed", "1.1",
            "--punch", "0", "--sfx-every", "2", "--whoosh-gain", "0.4"]
    if gameplay_dir:
        args += ["--gameplay-dir", gameplay_dir]
    run(args)
    return out_path.with_name(out_path.stem + "_punchy.mp4")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", required=True, help="path to the director brief.json")
    ap.add_argument("--skip-images", action="store_true", help="reuse existing beat stills")
    ap.add_argument("--recut", action="store_true", help="run punchy-recut as a finishing pass")
    ap.add_argument("--gameplay-dir", default=None, help="stack over gameplay (implies recut)")
    ap.add_argument("--allow-edge", action="store_true",
                    help="EMERGENCY ONLY: permit edge-tts if Chatterbox is unavailable "
                         "(audio is Chatterbox-only by policy)")
    args = ap.parse_args()

    brief = db.validate_brief(json.loads(Path(args.brief).read_text(encoding="utf-8")))
    slug = brief["slug"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    work = OUT_DIR / f"_work_{slug}"
    work.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{slug}_short.mp4"

    print(f"[ultimate] {slug}: {len(brief['beats'])} beats, ~{brief['_estimate_seconds']}s spoken", flush=True)

    narration_raw = work / "narration.wav"
    synthesize_narration(brief["narration"], narration_raw, work, allow_edge=args.allow_edge)
    narration, audio_dur = cap_narration(narration_raw, work)

    if args.skip_images:
        images = sorted((work / "assets").glob("beat_*.png"))
        if len(images) != len(brief["beats"]):
            raise SystemExit(f"--skip-images: found {len(images)} stills, need {len(brief['beats'])}")
    else:
        images = generate_beat_images(brief, work)

    dur = compose(brief, images, narration, audio_dur, work, out_path)
    print(f"[ultimate] composed {out_path.name}  duration={dur:.2f}s", flush=True)
    assert dur <= db.HARD_CAP_SECONDS + 0.05, f"FINAL {dur:.2f}s EXCEEDS {db.HARD_CAP_SECONDS}s cap"

    final = out_path
    if args.recut or args.gameplay_dir:
        final = finish_recut(out_path, args.gameplay_dir)
        fdur = probe_duration(final)
        print(f"[ultimate] finished {final.name}  duration={fdur:.2f}s", flush=True)
        assert fdur <= db.HARD_CAP_SECONDS + 0.05, f"recut {fdur:.2f}s EXCEEDS cap"

    print(f"\nDONE -> {final}")
    print(f"Duration: {probe_duration(final):.2f}s  (cap {db.HARD_CAP_SECONDS:.0f}s)")


if __name__ == "__main__":
    main()
