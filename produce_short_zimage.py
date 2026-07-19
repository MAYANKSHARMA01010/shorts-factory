# -*- coding: utf-8 -*-
"""Reusable, spec-driven producer for ClipPilot shorts with ORIGINAL Z-Image-Turbo
visuals. One JSON spec per video -> finished 1080x1920 short. Generalizes the
elephant proof-of-concept so the 519-video batch reuses one code path.

Spec JSON (UTF-8):
{
  "slug": "elephant_keeper",
  "narration": "full narration text read by the TTS voice",
  "captions": [[start, end, "HOOK LINE\nSECOND LINE"], ...],   // seconds (reference timeline)
  "scene_prompts": ["cinematic prompt for image 0", "...image 1", ...],
  "scene_map": [0,0,1,1,2,3,4,5],     // one entry per caption beat -> scene_prompts index
  "scene_weights": [2.35,3.6,...],    // relative duration per caption beat (len == captions)
  "style": "optional cinematic style suffix appended to every prompt",
  "gen_w": 512, "gen_h": 896,         // generation size (VRAM-safe portrait), optional
  "seed": 7                            // optional base seed
}

Captions/weights are on a *reference* timeline; everything is rescaled to the
actual TTS narration duration, so the spec doesn't need frame-accurate timing.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IMGGEN_PY = ROOT / "imggen-env" / "Scripts" / "python.exe"
ZIMAGE_GEN = ROOT / "zimage_gen.py"
CB_PY = ROOT / "chatterbox-env" / "Scripts" / "python.exe"
CB_ENGINE = ROOT / "chatterbox_engine.py"

DEFAULT_STYLE = (
    "cinematic photorealistic film still, shallow depth of field, 85mm lens, "
    "soft natural golden-hour light, emotional documentary photography, "
    "muted warm color grade, fine detail, atmospheric, vertical composition"
)


def run(args: list[str], *, cwd: Path | None = None) -> None:
    subprocess.run(args, cwd=cwd, check=True)


def probe_duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "json", str(path)], check=True, capture_output=True, text=True)
    return float(json.loads(r.stdout)["format"]["duration"])


def ass_time(seconds: float) -> str:
    cs = round(seconds * 100)
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def write_ass(captions: list, path: Path, scale: float) -> None:
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,Arial,88,&H00FFFFFF,&H000000FF,&H00111111,&H96000000,-1,0,0,0,100,100,0,0,1,7,2,8,70,70,170,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for start, end, text in captions:
        body = text.replace("\n", "\\N")
        lines.append("Dialogue: 0,"
                     f"{ass_time(start * scale)},{ass_time(end * scale)},Hook,,0,0,0,,"
                     f"{{\\fad(80,120)\\blur0.5}}{body}")
    path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")


def synthesize_narration(text: str, out: Path, work: Path) -> None:
    text_file = work / "narration.txt"
    text_file.write_text(text, encoding="utf-8")
    if CB_PY.exists() and CB_ENGINE.exists():
        run([str(CB_PY), str(CB_ENGINE), "--text-file", str(text_file),
             "--out", str(out), "--model", "base"])
        return
    mp3 = out.with_suffix(".edge.mp3")
    run([sys.executable, "-m", "edge_tts", "--voice", "en-US-AndrewMultilingualNeural",
         "--text", text, "--write-media", str(mp3)])
    run(["ffmpeg", "-hide_banner", "-y", "-i", str(mp3), "-ar", "24000", "-ac", "1", str(out)])


def make_scene(image: Path, out: Path, seconds: float, index: int) -> None:
    frames = max(1, math.ceil(seconds * 30))
    direction = index % 4
    if direction == 0:
        x_expr, y_expr = "'iw/2-(iw/zoom/2)'", "'ih/2-(ih/zoom/2)'"
    elif direction == 1:
        x_expr, y_expr = "'(iw-iw/zoom)*(on/(duration*30))'", "'ih/2-(ih/zoom/2)'"
    elif direction == 2:
        x_expr, y_expr = "'iw/2-(iw/zoom/2)'", "'(ih-ih/zoom)*(1-on/(duration*30))'"
    else:
        x_expr, y_expr = "'(iw-iw/zoom)*(1-on/(duration*30))'", "'ih/2-(ih/zoom/2)'"
    vf = (
        "scale=1300:2312:force_original_aspect_ratio=increase,crop=1300:2312,"
        f"zoompan=z='1+0.075*on/{frames}':d={frames}:x={x_expr}:y={y_expr}:s=1080x1920:fps=30,"
        "eq=contrast=1.06:saturation=1.08:brightness=-0.015,unsharp=5:5:0.55,"
        f"fade=t=in:st=0:d=0.18,fade=t=out:st={max(0, seconds - 0.20):.3f}:d=0.20,format=yuv420p"
    )
    run(["ffmpeg", "-hide_banner", "-y", "-loop", "1", "-i", str(image), "-t", f"{seconds:.3f}",
         "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(out)])


def generate_images(spec: dict, work: Path) -> list[Path]:
    assets = work / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    style = spec.get("style", DEFAULT_STYLE)
    prompts = [f"{p.rstrip(', ')}, {style}" for p in spec["scene_prompts"]]
    outs = [assets / f"img_{i:02d}.png" for i in range(len(prompts))]
    seed = int(spec.get("seed", 7))
    jobs = {
        "defaults": {"height": int(spec.get("gen_h", 896)), "width": int(spec.get("gen_w", 512)),
                     "steps": 8, "guidance": 1.0, "seed": seed},
        "jobs": [{"prompt": p, "out": str(o), "seed": seed + i}
                 for i, (p, o) in enumerate(zip(prompts, outs))],
    }
    (work / "jobs.json").write_text(json.dumps(jobs, indent=2), encoding="utf-8")
    print(f"[produce] generating {len(outs)} images ...", flush=True)
    run([str(IMGGEN_PY), str(ZIMAGE_GEN), "--jobs", str(work / "jobs.json")])
    missing = [o.name for o in outs if not o.exists()]
    if missing:
        raise SystemExit(f"image generation failed for: {missing}")
    return outs


def compose(spec: dict, images: list[Path], work: Path, out_path: Path) -> float:
    captions = [tuple(c) for c in spec["captions"]]
    scene_map = spec["scene_map"]
    weights = spec["scene_weights"]
    assert len(scene_map) == len(captions) == len(weights), "captions/scene_map/scene_weights length mismatch"

    narration = work / "narration.wav"
    synthesize_narration(spec["narration"], narration, work)
    audio_dur = probe_duration(narration)
    scale = audio_dur / captions[-1][1]

    total = sum(weights)
    durations = [audio_dur * (w / total) for w in weights]
    scene_images = [images[i] for i in scene_map]

    clips = []
    for i, (image, dur) in enumerate(zip(scene_images, durations), start=1):
        clip = work / f"clip_{i:02d}.mp4"
        make_scene(image, clip, dur, i)
        clips.append(clip)

    (work / "concat.txt").write_text("".join(f"file '{c.name}'\n" for c in clips), encoding="utf-8")
    silent = work / "silent.mp4"
    run(["ffmpeg", "-hide_banner", "-y", "-f", "concat", "-safe", "0",
         "-i", "concat.txt", "-c", "copy", silent.name], cwd=work)

    write_ass(captions, work / "captions.ass", scale)
    final_vf = ("drawbox=x=0:y=0:w=iw:h=360:color=black@0.20:t=fill,"
                "drawbox=x=0:y=1500:w=iw:h=420:color=black@0.18:t=fill,"
                "ass=captions.ass,vignette=PI/5")
    music = (f"aevalsrc=0.035*sin(2*PI*110*t)+0.026*sin(2*PI*165*t)+"
             f"0.018*sin(2*PI*220*t):s=44100:d={audio_dur:.3f}")
    run(["ffmpeg", "-hide_banner", "-y", "-i", silent.name, "-i", narration.name,
         "-f", "lavfi", "-i", music, "-filter_complex",
         f"[0:v]{final_vf}[v];[1:a]volume=1.15[a1];"
         f"[2:a]afade=t=in:st=0:d=1.2,afade=t=out:st={max(0, audio_dur-2):.3f}:d=2,volume=0.18[a2];"
         f"[a1][a2]amix=inputs=2:duration=first:dropout_transition=0[a]",
         "-map", "[v]", "-map", "[a]", "-t", f"{audio_dur:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out_path.resolve())],
        cwd=work)
    return audio_dur


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True, help="path to the per-video spec JSON")
    ap.add_argument("--skip-images", action="store_true", help="reuse existing images")
    args = ap.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    slug = spec["slug"]
    work = ROOT / "output" / f"_work_{slug}_zimage"
    work.mkdir(parents=True, exist_ok=True)
    out_path = ROOT / "output" / f"{slug}_zimage_short.mp4"

    if args.skip_images:
        assets = work / "assets"
        images = sorted(assets.glob("img_*.png"))
    else:
        images = generate_images(spec, work)

    dur = compose(spec, images, work, out_path)
    print(f"Rendered {out_path}")
    print(f"Duration: {dur:.2f}s")


if __name__ == "__main__":
    main()
