import os
import subprocess
import time
from pathlib import Path

remotion_dir = Path(__file__).resolve().parent  # this file lives in remotion_explainer/

# We process T065 to T100
for i in range(65, 101):
    slug = f"t{i:03d}"
    class_name = slug.capitalize()
    
    # Wait until narration is ready
    words_json = remotion_dir / "src" / f"{slug}_words.json"
    while not words_json.exists():
        print(f"Waiting for {words_json.name} to be generated...")
        time.sleep(10)
        
    print(f"[{slug}] Narrations ready. Generating TSX...")
    subprocess.run(["python", "auto_gen_v2.py"], cwd=str(remotion_dir), check=True)
    
    # Run pipeline
    print(f"[{slug}] Running pipeline...")
    cmd = ["pipeline.bat", class_name, slug, f"R_AUTO_V2 - {class_name}"]
    subprocess.run(cmd, cwd=str(remotion_dir), shell=True, check=False)
    
    print(f"[{slug}] Pipeline finished.")

print("All tasks completed!")
