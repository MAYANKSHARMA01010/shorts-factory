"""Make a 60 FPS animated explainer video for: 'Why Mosquitoes Are the Ultimate Tricksters'

Format  : 9:16 vertical
Output  : /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-07/why_mosquitoes_are_the_ultimate_tricksters
Manifest: /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-07/why_mosquitoes_are_the_ultimate_tricksters/manifest.json

Run via CLI:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-07/make_why_mosquitoes_are_the_ultimate_tricksters_explainer.py
"""
import json
import sys
from pathlib import Path

TITLE      = "Why Mosquitoes Are the Ultimate Tricksters"
SCRIPT     = "Did you know mosquitoes are actually the deadliest creatures on Earth? They kill more people in one day than sharks do in a century. But how? They transmit microscopic killers like malaria. Next time you hear that buzz, remember: it's not just an itch, it's a tiny vampire with a deadly payload."
KEYWORDS   = []
TAGS       = []
VIDEO_TYPE = "short"
PROJECT_DIR= Path("/Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-07/why_mosquitoes_are_the_ultimate_tricksters")

if __name__ == "__main__":
    print(f"🎬 Explainer Script for: {TITLE}")
    print(f"Output Directory : {PROJECT_DIR}")
    print(f"Video Type       : {VIDEO_TYPE} (60 FPS, CRF 16)")
    print(f"Manifest Path    : {PROJECT_DIR / 'manifest.json'}")
