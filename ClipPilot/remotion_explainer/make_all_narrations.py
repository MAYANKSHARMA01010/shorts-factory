import os
import subprocess
from pathlib import Path

# Paths
_HERE = Path(__file__).resolve().parent  # remotion_explainer/
transcript_dir = _HERE.parent.parent / "reimagined transcripts"
remotion_dir = _HERE
make_narration = remotion_dir / "make_narration.py"

if not transcript_dir.exists():
    print(f"Transcript dir not found: {transcript_dir}")
    exit(1)

# Find all transcripts between 065 and 100
for txt_file in sorted(transcript_dir.glob("*.txt")):
    name = txt_file.name
    if not name[0].isdigit():
        continue
    try:
        num = int(name.split("_")[0])
    except ValueError:
        continue
        
    if 65 <= num <= 100:
        slug = f"t{num:03d}"
        print(f"Processing {name} -> {slug}")
        cmd = ["python", str(make_narration), "--txt", str(txt_file), "--slug", slug]
        subprocess.run(cmd, cwd=str(remotion_dir), check=True)

print("Finished all narrations!")
