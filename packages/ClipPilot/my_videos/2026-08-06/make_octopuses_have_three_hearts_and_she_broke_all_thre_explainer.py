"""Make a 60 FPS animated explainer video for: 'Octopuses Have THREE Hearts… And She Broke All Three 💔'

Format  : 9:16 vertical
Output  : /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-06/octopuses_have_three_hearts_and_she_broke_all_thre
Manifest: /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-06/octopuses_have_three_hearts_and_she_broke_all_thre/manifest.json

Run via CLI:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-06/make_octopuses_have_three_hearts_and_she_broke_all_thre_explainer.py
"""
import json
import sys
from pathlib import Path

TITLE      = "Octopuses Have THREE Hearts\u2026 And She Broke All Three \ud83d\udc94"
SCRIPT     = "Did you know octopuses have three hearts?\n\nOne pumps blood to the body. The other two pump blood to the gills.\n\nScientists call it a distributed circulatory system.\n\nRomantics call it... three chances to get your heart broken.\n\nBecause your girlfriend isn't stopping at just one.\n\nThe first heart breaks when she says \"I need space.\"\n\nThe second goes when she posts a photo with \"just a friend.\"\n\nAnd the third? That one shatters when she whispers \"you're like a brother to me.\"\n\nThree hearts. Three hits. One octopus.\n\nBut here's what nobody tells you \u2014 octopuses regenerate.\n\nTheir arms grow back. Their bodies heal. They survive.\n\nMaybe that's the real lesson.\n\nYou weren't built with one heart to protect you.\n\nYou were built with extras \u2014 because some things are worth surviving twice.\n\nFollow for more facts that hit different."
KEYWORDS   = ["octopus facts", "three hearts", "heartbreak humor", "science facts", "funny science", "marine biology", "relatable shorts", "viral facts"]
TAGS       = ["shorts", "octopus", "funfacts", "heartbreak", "science", "relatable", "viral", "trending", "biology", "lovefacts"]
VIDEO_TYPE = "short"
PROJECT_DIR= Path("/Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-06/octopuses_have_three_hearts_and_she_broke_all_thre")

if __name__ == "__main__":
    print(f"🎬 Explainer Script for: {TITLE}")
    print(f"Output Directory : {PROJECT_DIR}")
    print(f"Video Type       : {VIDEO_TYPE} (60 FPS, CRF 16)")
    print(f"Manifest Path    : {PROJECT_DIR / 'manifest.json'}")
