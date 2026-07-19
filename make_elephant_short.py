from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "output" / "_work_elephant_keeper_short"
OUT = ROOT / "output" / "elephant_keeper_final_goodbye_short.mp4"

# Source images: place your generated images in output/generated_images/
# and list them here, or pass them as CLI args.
SOURCE_IMAGES = [
    # ROOT / "output" / "generated_images" / "scene_01.png",
    # ROOT / "output" / "generated_images" / "scene_02.png",
    # ROOT / "output" / "generated_images" / "scene_03.png",
    # ROOT / "output" / "generated_images" / "scene_04.png",
    # ROOT / "output" / "generated_images" / "scene_05.png",
    # ROOT / "output" / "generated_images" / "scene_06.png",
]

NARRATION = (
    "This elephant remembered him for decades. "
    "When he first guided her into the enclosure, she pressed her forehead against him. "
    "From that day on, he became the keeper she trusted most. "
    "For years, she followed his voice. Even after he retired, they never forgot each other. "
    "Then, when the old keeper learned he was dying, he made one final request. "
    "Volunteers brought him back to the zoo, rolling his bed to her enclosure. "
    "The elephant recognized him instantly. She reached out her trunk so he could hold it. "
    "After he whispered goodbye to his beloved friend, he passed away two days later."
)

CAPTIONS = [
    (0.00, 2.35, "SHE REMEMBERED HIM\nFOR DECADES"),
    (2.35, 5.95, "THE FIRST DAY,\nSHE CHOSE HIM"),
    (5.95, 9.10, "HE BECAME\nHER KEEPER"),
    (9.10, 13.70, "EVEN RETIREMENT\nCOULDN'T ERASE THAT BOND"),
    (13.70, 17.95, "THEN HE MADE\nONE FINAL REQUEST"),
    (17.95, 22.20, "THEY BROUGHT HIM\nBACK TO HER"),
    (22.20, 27.25, "SHE REACHED OUT\nSO HE COULD HOLD ON"),
    (27.25, 31.70, "TWO DAYS LATER,\nHE WAS GONE"),
]


def run(args: list[str], *, cwd: Path | None = None) -> None:
    subprocess.run(args, cwd=cwd, check=True)


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def ass_time(seconds: float) -> str:
    cs = round(seconds * 100)
    h = cs // 360000
    cs %= 360000
    m = cs // 6000
    cs %= 6000
    s = cs // 100
    cs %= 100
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def write_ass(path: Path, scale: float) -> None:
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
    line_break = "\\N"
    for start, end, text in CAPTIONS:
        lines.append(
            "Dialogue: 0,"
            f"{ass_time(start * scale)},{ass_time(end * scale)},Hook,,0,0,0,,"
            f"{{\\fad(80,120)\\blur0.5}}{text.replace(chr(10), line_break)}"
        )
    path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")


def synthesize_narration(path: Path) -> None:
    """Narrate with local-GPU Chatterbox TTS (no robotic SAPI). Falls back to
    edge-tts (cloud) if the Chatterbox venv/engine is unavailable."""
    cb_python = ROOT / "chatterbox-env" / "Scripts" / "python.exe"
    cb_engine = ROOT / "chatterbox_engine.py"
    text_file = WORK / "narration.txt"
    text_file.write_text(NARRATION, encoding="utf-8")
    if cb_python.exists() and cb_engine.exists():
        run([str(cb_python), str(cb_engine), "--text-file", str(text_file),
             "--out", str(path), "--model", "base"])
        return
    # Fallback: edge-tts (system python), then transcode to WAV.
    mp3 = path.with_suffix(".edge.mp3")
    run([sys.executable, "-m", "edge_tts", "--voice", "en-US-AndrewMultilingualNeural",
         "--text", NARRATION, "--write-media", str(mp3)])
    run(["ffmpeg", "-hide_banner", "-y", "-i", str(mp3), "-ar", "24000", "-ac", "1", str(path)])


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
        "scale=1300:2312:force_original_aspect_ratio=increase,"
        "crop=1300:2312,"
        f"zoompan=z='1+0.075*on/{frames}':d={frames}:"
        f"x={x_expr}:y={y_expr}:s=1080x1920:fps=30,"
        "eq=contrast=1.06:saturation=1.08:brightness=-0.015,"
        "unsharp=5:5:0.55,"
        "fade=t=in:st=0:d=0.18,fade=t=out:st="
        f"{max(0, seconds - 0.20):.3f}:d=0.20,format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-loop",
            "1",
            "-i",
            str(image),
            "-t",
            f"{seconds:.3f}",
            "-vf",
            vf,
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            str(out),
        ]
    )


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    assets = WORK / "assets"
    assets.mkdir(exist_ok=True)

    copied = []
    for i, src in enumerate(SOURCE_IMAGES, start=1):
        dst = assets / f"scene_{i:02d}.png"
        shutil.copy2(src, dst)
        copied.append(dst)

    narration = WORK / "narration.wav"
    synthesize_narration(narration)
    audio_duration = probe_duration(narration)
    scale = audio_duration / CAPTIONS[-1][1]

    scene_weights = [2.35, 3.60, 3.15, 4.60, 4.25, 4.25, 5.05, 4.45]
    total = sum(scene_weights)
    durations = [audio_duration * (w / total) for w in scene_weights]
    scene_images = [copied[0], copied[0], copied[1], copied[1], copied[2], copied[3], copied[4], copied[5]]

    clips = []
    for i, (image, dur) in enumerate(zip(scene_images, durations), start=1):
        clip = WORK / f"clip_{i:02d}.mp4"
        make_scene(image, clip, dur, i)
        clips.append(clip)

    concat_file = WORK / "concat.txt"
    concat_file.write_text("".join(f"file '{c.name}'\n" for c in clips), encoding="utf-8")
    silent = WORK / "silent.mp4"
    run(["ffmpeg", "-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", concat_file.name, "-c", "copy", silent.name], cwd=WORK)

    captions = WORK / "captions.ass"
    write_ass(captions, scale)

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
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-i",
            silent.name,
            "-i",
            narration.name,
            "-f",
            "lavfi",
            "-i",
            music,
            "-filter_complex",
            f"[0:v]{final_vf}[v];[1:a]volume=1.15[a1];[2:a]afade=t=in:st=0:d=1.2,afade=t=out:st={max(0, audio_duration-2):.3f}:d=2,volume=0.18[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=0[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            f"{audio_duration:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(OUT.resolve()),
        ],
        cwd=WORK,
    )

    print(f"Rendered {OUT}")
    print(f"Duration: {audio_duration:.2f}s")
    print("Assets:")
    print(textwrap.indent("\n".join(str(p) for p in copied), "  "))


if __name__ == "__main__":
    main()
