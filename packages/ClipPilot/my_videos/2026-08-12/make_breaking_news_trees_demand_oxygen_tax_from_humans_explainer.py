"""Make a 60 FPS animated explainer video for: 'Breaking News: Trees demand oxygen tax from humans'

Format  : 9:16 vertical
Output  : /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-12/breaking_news_trees_demand_oxygen_tax_from_humans
Manifest: /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-12/breaking_news_trees_demand_oxygen_tax_from_humans/manifest.json

Run via CLI:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-12/make_breaking_news_trees_demand_oxygen_tax_from_humans_explainer.py
"""
import json
import sys
from pathlib import Path

TITLE      = "Breaking News: Trees demand oxygen tax from humans"
SCRIPT     = "Breaking News! In a shocking turn of events, trees have officially announced an oxygen tax on humans! A spokesperson for the Tree Union said, \"We're tired of giving away free oxygen for centuries. From now on, every breath comes with a bill!\" The new rate? Five cents per breath. Or you can get the monthly plan if you're a heavy breather. People are already receiving oxygen bills. One man reportedly owes forty-seven dollars just for breathing during a Monday morning. Tree tax collectors have also started going door to door. Their message is simple: \"Pay up... or stop breathing!\" Humans are protesting, shouting, \"Oxygen is our right!\" But the Tree Union isn't backing down. Their leader responded, \"You cut us, pollute us, and destroy our forests. Now pay and appreciate us!\" Things are getting serious. QR codes saying \"PAY TO BREATHE\" have started appearing everywhere. And now trees are offering Premium Oxygen. Extra fresh, less pollution, and 99.9% pure. Subscribe now! So remember: next time you take a deep breath... check your bank account first. This is your breaking news update. Stay tuned. We might need plants soon!"
KEYWORDS   = ["funny news", "trees", "oxygen tax", "talking trees", "comedy", "satire", "AI video", "funny facts", "what if", "absurd news", "environmental comedy"]
TAGS       = ["Shorts", "TikTok", "Reels", "Funny", "Comedy", "AI", "AIVideo", "Trees", "OxygenTax", "Satire", "FunnyNews", "WhatIf"]
VIDEO_TYPE = "short"
PROJECT_DIR= Path("/Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-12/breaking_news_trees_demand_oxygen_tax_from_humans")

if __name__ == "__main__":
    print(f"🎬 Explainer Script for: {TITLE}")
    print(f"Output Directory : {PROJECT_DIR}")
    print(f"Video Type       : {VIDEO_TYPE} (60 FPS, CRF 16)")
    print(f"Manifest Path    : {PROJECT_DIR / 'manifest.json'}")
