import os
import glob
from pathlib import Path

def main():
    _here = Path(__file__).resolve().parent  # remotion_explainer/
    transcripts_dir = _here.parent.parent / "reimagined transcripts"
    files = list(transcripts_dir.glob("*.txt"))
    files.sort()
    
    with open("gen_all_narrations.bat", "w", encoding="utf-8") as f:
        for p in files:
            name = p.name
            if name.startswith("INDEX"): continue
            
            # extract slug, e.g. "076_speed-of-light-delay.txt" -> "speed-of-light-delay" -> let's just use the first part or custom
            # Actually, `make_narration.py` slug will be the prefix "076" or the actual slug.
            # I can just use `t_076` as slug.
            prefix = name.split('_')[0]
            try:
                num = int(prefix)
            except:
                continue
            
            if num >= 76 and num <= 100:
                slug = "t" + prefix
                f.write(f'python make_narration.py --txt "..\\..\\reimagined transcripts\\{name}" --slug {slug}\n')

if __name__ == "__main__":
    main()
