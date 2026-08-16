"""Make a 60 FPS animated explainer video for: 'BREAKING NEWS: Trees Are Charging Us for Oxygen'

Format  : 9:16 vertical
Output  : /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-16/breaking_news_trees_are_charging_us_for_oxygen
Manifest: /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-16/breaking_news_trees_are_charging_us_for_oxygen/manifest.json

Run via CLI:
    cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot
    PYTHONPATH="$PWD/src" python3 my_videos/2026-08-16/make_breaking_news_trees_are_charging_us_for_oxygen_explainer.py
"""
import json
import sys
from pathlib import Path

TITLE      = "BREAKING NEWS: Trees Are Charging Us for Oxygen"
SCRIPT     = "(serious) BREAKING NEWS!\n(dramatic) Trees may not be charging us for oxygen\u2026 but we\u2019re destroying the system that helps keep our air and planet healthy.\n(funny) Yes. The thing we\u2019ve been breathing for FREE\u2026 apparently has a price.\nAnd that price?\n(serious) Our planet.\n(normal) Here\u2019s the science.\nTrees absorb carbon dioxide and release oxygen through photosynthesis.\nThey also help remove pollutants, store carbon, cool our cities, protect soil, and provide homes for wildlife.\n(whispering) But here\u2019s the part people don\u2019t realize\u2026\n(normal) Trees aren\u2019t actually the only major source of Earth\u2019s oxygen.\n(dramatic) The oceans are huge players too.\nTiny organisms called phytoplankton produce a massive amount of oxygen through photosynthesis.\n(funny) So technically\u2026 even the ocean is working overtime to keep us alive.\nBut humans?\n(serious) We\u2019re cutting forests down, polluting ecosystems, and damaging the natural systems we depend on.\n(dramatic) And unlike a Netflix subscription\u2026\n(serious) you can\u2019t just cancel planet Earth when things go wrong.\n(funny) Imagine getting a monthly bill saying:\n(serious) \u201cOxygen: \u20b94,000.\u201d\n(funny) \u201cCarbon removal: \u20b92,000.\u201d\n(dramatic) \u201cClean air premium: \u20b95,000.\u201d\n(whispering) And then\u2026\n(funny) \u201cPayment failed.\u201d\n(normal) Obviously, trees aren\u2019t actually going to charge us.\nBut the consequences of destroying forests and ecosystems are very real.\n(serious) So maybe the message from the trees isn\u2019t\u2026\n(dramatic) \u201cPay us for oxygen.\u201d\n(serious) It\u2019s\u2026"
KEYWORDS   = ["trees", "oxygen", "photosynthesis", "climate change", "forests", "deforestation", "environment", "environmental science", "phytoplankton", "oceans", "carbon dioxide", "carbon removal", "clean air", "pollution", "ecosystem", "wildlife", "global warming", "climate crisis", "nature", "Earth", "sustainability", "science news", "climate facts", "oxygen facts"]
TAGS       = ["Trees", "Oxygen", "Photosynthesis", "ClimateChange", "Deforestation", "Environment", "Science", "Phytoplankton", "Oceans", "GlobalWarming", "ClimateCrisis", "CleanAir", "Ecosystem", "Nature", "Earth", "Sustainability", "ScienceFacts", "EnvironmentalFacts", "ClimateFacts", "DidYouKnow"]
VIDEO_TYPE = "short"
PROJECT_DIR= Path("/Users/mayanksharma/Downloads/New_Projects/shorts-factory/packages/ClipPilot/output/2026-08-16/breaking_news_trees_are_charging_us_for_oxygen")

if __name__ == "__main__":
    print(f"🎬 Explainer Script for: {TITLE}")
    print(f"Output Directory : {PROJECT_DIR}")
    print(f"Video Type       : {VIDEO_TYPE} (60 FPS, CRF 16)")
    print(f"Manifest Path    : {PROJECT_DIR / 'manifest.json'}")
