# -*- coding: utf-8 -*-
"""Sample short with ORIGINAL Z-Image-Turbo visuals (replaces the externally
pre-generated images in make_elephant_short.py). Reuses the proven narration /
Ken-Burns / caption / compose logic; only the image SOURCE changes.

Flow:
  1. Hand-authored cinematic prompts -> jobs JSON
  2. imggen-env python zimage_gen.py  (generates 6 portrait images, model loaded once)
  3. Chatterbox narration + timed captions + Ken-Burns + compose  (reused)
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

import make_elephant_short as base  # reuse helpers + NARRATION + CAPTIONS

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "output" / "_work_elephant_zimage"
OUT = ROOT / "output" / "elephant_keeper_zimage_short.mp4"
IMGGEN_PY = ROOT / "imggen-env" / "Scripts" / "python.exe"
ZIMAGE_GEN = ROOT / "zimage_gen.py"

# Consistent cinematic look + recurring characters for cross-shot continuity.
STYLE = (
    "cinematic photorealistic film still, shallow depth of field, 85mm lens, "
    "soft natural golden-hour light, emotional documentary photography, "
    "muted warm color grade, fine detail, atmospheric, vertical composition"
)

# Six content-matched scenes, aligned to the eight caption beats via SCENE_MAP.
PROMPTS = [
    # 0 — the decades-long bond / the first day she chose him
    "an elderly zookeeper in a faded khaki uniform gently pressing his forehead "
    "against the forehead of a large gentle Asian elephant inside a sunlit "
    "sanctuary enclosure, deep mutual trust, a tear in his eye, " + STYLE,
    # 1 — he became her keeper / the bond through retirement
    "an elderly silver-haired zookeeper walking side by side with a large Asian "
    "elephant along a dusty sanctuary path at golden hour, the elephant's trunk "
    "resting affectionately on his shoulder, a lifetime of companionship, " + STYLE,
    # 2 — dying, one final request
    "a frail elderly silver-haired man lying weak in a hospital bed beside a "
    "window, looking wistfully outside with quiet determination, pale soft light, "
    "a faded photograph of an elephant on the nightstand, somber, " + STYLE,
    # 3 — they brought him back to her
    "volunteers in scrubs carefully wheeling a hospital bed carrying a frail "
    "elderly man across a zoo pathway toward a large elephant enclosure, "
    "overcast soft light, tender emotional documentary moment, " + STYLE,
    # 4 — she reached out her trunk so he could hold on
    "extreme close-up of a large Asian elephant gently lowering its trunk to "
    "touch the trembling outstretched hand of a frail elderly man lying on a bed "
    "at the enclosure fence, warm golden backlight, deeply emotional, " + STYLE,
    # 5 — two days later, he was gone
    "a lone Asian elephant standing quietly in an empty sanctuary enclosure at "
    "dusk, head lowered in grief, long shadows across the ground, melancholic "
    "and still, empty space, " + STYLE,
]

# Map the 8 caption beats to the 6 unique images (same mapping as the original).
SCENE_MAP = [0, 0, 1, 1, 2, 3, 4, 5]
SCENE_WEIGHTS = [2.35, 3.60, 3.15, 4.60, 4.25, 4.25, 5.05, 4.45]

# Portrait ~9:16 size that stays in the fast VRAM zone on the 6GB card (768x1344
# thrashes the allocator at ~30s/step; 512x896 peaks ~4.3GB -> ~2.5s/step).
# Upscaled to 1080x1920 downstream by the Ken-Burns stage.
GEN_W, GEN_H = 512, 896


def generate_images(assets: Path) -> list[Path]:
    assets.mkdir(parents=True, exist_ok=True)
    outs = [assets / f"img_{i:02d}.png" for i in range(len(PROMPTS))]
    jobs = {
        "defaults": {"height": GEN_H, "width": GEN_W, "steps": 8, "guidance": 1.0, "seed": 7},
        "jobs": [{"prompt": p, "out": str(o), "seed": 7 + i}
                 for i, (p, o) in enumerate(zip(PROMPTS, outs))],
    }
    jobs_path = WORK / "jobs.json"
    jobs_path.write_text(json.dumps(jobs, indent=2), encoding="utf-8")
    print(f"[zimage] generating {len(outs)} images via imggen-env ...", flush=True)
    subprocess.run([str(IMGGEN_PY), str(ZIMAGE_GEN), "--jobs", str(jobs_path)], check=True)
    missing = [o for o in outs if not o.exists()]
    if missing:
        raise SystemExit(f"image generation failed for: {[m.name for m in missing]}")
    return outs


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    assets = WORK / "assets"
    images = generate_images(assets)

    narration = WORK / "narration.wav"
    base.WORK.mkdir(parents=True, exist_ok=True)  # synthesize_narration writes narration.txt there
    _orig_synth_work = base.WORK
    # Point the reused narration helper at our WORK dir.
    base.WORK = WORK
    base.synthesize_narration(narration)
    audio_duration = base.probe_duration(narration)
    scale = audio_duration / base.CAPTIONS[-1][1]

    total = sum(SCENE_WEIGHTS)
    durations = [audio_duration * (w / total) for w in SCENE_WEIGHTS]
    scene_images = [images[i] for i in SCENE_MAP]

    clips = []
    for i, (image, dur) in enumerate(zip(scene_images, durations), start=1):
        clip = WORK / f"clip_{i:02d}.mp4"
        base.make_scene(image, clip, dur, i)
        clips.append(clip)

    concat_file = WORK / "concat.txt"
    concat_file.write_text("".join(f"file '{c.name}'\n" for c in clips), encoding="utf-8")
    silent = WORK / "silent.mp4"
    base.run(["ffmpeg", "-hide_banner", "-y", "-f", "concat", "-safe", "0",
              "-i", concat_file.name, "-c", "copy", silent.name], cwd=WORK)

    captions = WORK / "captions.ass"
    base.write_ass(captions, scale)

    final_vf = (
        "drawbox=x=0:y=0:w=iw:h=360:color=black@0.20:t=fill,"
        "drawbox=x=0:y=1500:w=iw:h=420:color=black@0.18:t=fill,"
        "ass=captions.ass,"
        "vignette=PI/5"
    )
    music = (
        f"aevalsrc=0.035*sin(2*PI*110*t)+0.026*sin(2*PI*165*t)+"
        f"0.018*sin(2*PI*220*t):s=44100:d={audio_duration:.3f}"
    )
    base.run(
        ["ffmpeg", "-hide_banner", "-y",
         "-i", silent.name, "-i", narration.name,
         "-f", "lavfi", "-i", music,
         "-filter_complex",
         f"[0:v]{final_vf}[v];[1:a]volume=1.15[a1];"
         f"[2:a]afade=t=in:st=0:d=1.2,afade=t=out:st={max(0, audio_duration-2):.3f}:d=2,"
         f"volume=0.18[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=0[a]",
         "-map", "[v]", "-map", "[a]", "-t", f"{audio_duration:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
         str(OUT.resolve())],
        cwd=WORK,
    )
    base.WORK = _orig_synth_work
    print(f"Rendered {OUT}")
    print(f"Duration: {audio_duration:.2f}s")


if __name__ == "__main__":
    main()
