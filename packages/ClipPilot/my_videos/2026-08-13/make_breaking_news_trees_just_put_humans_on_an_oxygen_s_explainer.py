"""Make a 60 FPS animated explainer video for: 'Breaking News: Trees Just Put Humans on an Oxygen Subscription Part 2'

Format  : 9:16 vertical
Output  : /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s
Manifest: /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s/manifest.json

Run via CLI:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-13/make_breaking_news_trees_just_put_humans_on_an_oxygen_s_explainer.py
"""
import json
import sys
from pathlib import Path

TITLE      = "Breaking News: Trees Just Put Humans on an Oxygen Subscription Part 2"
SCRIPT     = "[dramatic_bass] (serious) BREAKING NEWS!\n\nScientists have confirmed something absolutely terrifying.\n\n[woosh] Trees are officially charging humans for oxygen.\n\n[record_scratch]\n\n(funny) Yes. The thing we've been breathing for FREE... apparently had a subscription plan.\n\n[ding] The new price?\n\n(serious) Five cents per breath.\n\n[cash_register]\n\nAnd if you're a heavy breather...\n\n[gasp] Congratulations. You're financially screwed.\n\n[drum_roll]\n\nOne man reportedly received his first monthly oxygen bill.\n\n[woosh]\n\n(whispering) Forty-seven dollars.\n\n[gasp]\n\n(funny) He immediately stopped breathing and started holding his breath to save money.\n\n[crickets]\n\nUnfortunately, the trees have thought of that too.\n\n(dramatic) New policy: holding your breath still counts as an oxygen subscription.\n\n[buzzer]\n\nHumans protested.\n\n[applause] \u201cOXYGEN IS OUR RIGHT!\u201d\n\nBut the Tree Union had one response.\n\n(serious) \u201cThen stop cutting us down.\u201d\n\n[thunder]\n\nAnd now they're launching...\n\n(excited) PREMIUM OXYGEN!\n\n[ding]\n\nExtra fresh. Less pollution. And absolutely NO ads between breaths!\n\n[laugh]\n\n(funny) Subscribe now...\n\n[airhorn]\n\n...before your lungs get disconnected.\n\n[dramatic_bass] This has been your daily news.\n\n[crickets]\n\nAnd yes...\n\n(whispering) ...the trees are watching."
KEYWORDS   = ["funny news", "oxygen tax", "trees", "talking trees", "tree union", "absurd news", "comedy news", "funny AI video", "AI comedy", "satire", "what if", "environmental comedy", "fake news", "funny story"]
TAGS       = ["shorts", "funny", "comedy", "funnynews", "satire", "AIvideo", "AIcomedy", "talkingtrees", "oxygentax", "trees", "whatif", "absurdcomedy", "funnyshorts", "viralshorts"]
VIDEO_TYPE = "short"
PROJECT_DIR= Path("/Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s")

if __name__ == "__main__":
    print(f"🎬 Explainer Script for: {TITLE}")
    print(f"Output Directory : {PROJECT_DIR}")
    print(f"Video Type       : {VIDEO_TYPE} (60 FPS, CRF 16)")
    print(f"Manifest Path    : {PROJECT_DIR / 'manifest.json'}")
