# shorts-factory — macOS Port & Changes Log

> Last updated: 2026-07-19
> Purpose: permanent reference for every change made during the Windows→macOS port
> and the Gemini (free) ↔ Claude/Anthropic (paid) brain swap.

---

## 1. Status of Keys / Credentials

| Key | File(s) | Status |
|-----|---------|--------|
| `YOUTUBE_CLIENT_ID` | `.env` + `ClipPilot/.env` | ✅ SET — `78037484134-r861c30nd...apps.googleusercontent.com` |
| `YOUTUBE_CLIENT_SECRET` | `.env` + `ClipPilot/.env` | ✅ SET — `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` |
| `YOUTUBE_REFRESH_TOKEN` | `.env` + `ClipPilot/.env` | ✅ SET — (long token auto-written by youtube_auth) |
| `GCP_PROJECT_NUMBER` | `.env` only | ✅ SET — `78037484134` |
| `GCP_PROJECT_ID` | (reference only) | `auto-502910` |
| `ANTHROPIC_API_KEY` | `.env` + `ClipPilot/.env` | ⏸ EMPTY — using Gemini instead (see Section 2) |
| `GEMINI_API_KEY` | `.env` + `ClipPilot/.env` | 🔴 TODO — get at https://aistudio.google.com/apikey |
| `PEXELS_API_KEY` | `.env` + `ClipPilot/.env` | 🔴 TODO — get at https://www.pexels.com/api/ |
| `PIXABAY_API_KEY` | `.env` + `ClipPilot/.env` | ⬜ OPTIONAL |
| `NOTIFY_EMAIL_ADDRESS` | `.env` only | 🔴 TODO — your Gmail address |
| Gmail App Password | `~/.config/shorts/email.json` | 🔴 TODO — run `python notify_email.py --set-password "xxxx"` |

---

## 2. Gemini vs Anthropic — HOW TO SWITCH

### CURRENT STATE: Gemini (FREE) is active

Both `.env` files currently have:
```
GEMINI_API_KEY=         ← fill from https://aistudio.google.com/apikey (free, instant)
CLIPPILOT_BRAIN_PROVIDER=gemini
CLIPPILOT_BRAIN_MODEL=gemini-2.0-flash
ANTHROPIC_API_KEY=      ← intentionally left empty
```

The code in `ClipPilot/src/clippilot/brain/client.py` → `get_client()` function:
1. If `CLIPPILOT_BRAIN_PROVIDER=gemini` → uses `GeminiVisionClient` (NEW file we created)
2. If `ANTHROPIC_API_KEY` is set → uses `AnthropicVisionClient` (original code — UNTOUCHED)
3. If neither → falls back to `MockVisionClient` (template-only, no AI)

The Gemini client lives at:
  `ClipPilot/src/clippilot/brain/gemini_client.py`  ← NEW FILE (created 2026-07-19)
It uses pure Python stdlib (no pip install), calls Gemini REST API directly.

Gemini free tier limits:
  - gemini-2.0-flash: 15 req/min, 1M tokens/day
  - gemini-1.5-pro: 50 req/day (smarter but slower)

---

### HOW TO SWITCH BACK TO ANTHROPIC/CLAUDE (when ready to upgrade)

Step 1 — Get Anthropic API key
  → https://console.anthropic.com/ → API Keys → Create Key
  → Key starts with: sk-ant-api03-...
  → Buy $5 credits in Billing (lasts months)

Step 2 — Update BOTH .env files (change these 3 lines):
  BEFORE:
    CLIPPILOT_BRAIN_PROVIDER=gemini
    CLIPPILOT_BRAIN_MODEL=gemini-2.0-flash
    ANTHROPIC_API_KEY=

  AFTER:
    CLIPPILOT_BRAIN_PROVIDER=anthropic
    CLIPPILOT_BRAIN_MODEL=claude-sonnet-4-6   (or claude-opus-4-8 for best quality)
    ANTHROPIC_API_KEY=sk-ant-api03-...

Step 3 — Install the Anthropic Python package:
  source .venv/bin/activate
  pip install anthropic

Step 4 — Verify:
  cd ClipPilot && PYTHONPATH=src python3 -m clippilot doctor
  Should show: "Anthropic API key: set ✅"

NO CODE CHANGES NEEDED — client.py auto-selects based on CLIPPILOT_BRAIN_PROVIDER.

---

### CLAUDE MODEL COST REFERENCE

Model               | Input $/1M | Output $/1M | Recommended for
claude-opus-4-8     | $5.00      | $25.00      | Best quality
claude-sonnet-4-6   | $3.00      | $15.00      | ← RECOMMENDED for daily use
claude-haiku-4-5    | $1.00      | $5.00       | Cheapest, lowest quality

Per video estimate: $0.02–$0.05 (Sonnet), $0.005–$0.01 (Haiku)

---

## 3. Infrastructure Fixes Done

### Python Virtual Environment
  Created: python3 -m venv .venv
  Activate: source .venv/bin/activate
  Packages installed: edge-tts==7.2.8, faster-whisper==1.2.1, soundfile==0.14.0, numpy==2.5.1
  ALWAYS run `source .venv/bin/activate` before any Python script.

### Remotion npm packages
  cd ClipPilot/remotion_explainer && npm install
  212 packages installed, 0 vulnerabilities.

---

## 4. Python Files Changed (Windows → macOS paths)

Patterns replaced throughout:
  - Path(r"C:\Dikshant\Money making\...") → Path(__file__).resolve().parent / "..."
  - Scripts\python.exe                   → bin/python  (macOS venv layout)
  - WinGet FFmpeg path                   → shutil.which("ffmpeg")
  - Hardcoded Windows temp paths         → tempfile.gettempdir()
  - GPU model paths                      → os.environ.get("ZIMAGE_MODEL_DIR", default)

Files modified:
  collect_finals.py                              — BASE path, Windows char regex
  make_shorts_from_transcripts.py               — BASE path
  make_from_source.py                            — BASE, SCRATCH, ESRGAN, + import tempfile
  chatterbox_engine.py                           — FFMPEG → shutil.which
  chatterbox_test.py                             — docstring run example
  zimage_gen.py                                  — DEFAULT_MODEL → env var
  zimage_smoke.py                                — REPO → env var, --out default
  bench_fp16.py                                  — REPO, SCRATCH → env vars
  bench_zimage.py                                — REPO → env var
  clamp_test.py                                  — REPO, SCRATCH → env vars
  diag_fp16.py                                   — REPO → env var
  dl_zimage.py                                   — TARGET → env var
  notify_email.py                                — hardcoded email → env var
  make_elephant_short.py                         — SOURCE_IMAGES → commented template
  ClipPilot/make_sky_explainer.py               — docstring run command
  ClipPilot/src/clippilot/media/tts.py          — Chatterbox path, Scripts→bin
  ClipPilot/src/clippilot/generate/assemble.py  — font candidates (macOS first)
  ClipPilot/src/clippilot/mcp_server/stdio.py   — PYTHONPATH example
  ClipPilot/remotion_explainer/render_one_by_one.py  — remotion_dir
  ClipPilot/remotion_explainer/make_all_narrations.py — transcript_dir, remotion_dir
  ClipPilot/remotion_explainer/gen_all.py        — transcripts_dir
  .claude/skills/ultimate-short/pipeline.py      — venv paths cross-platform
  dashboard.py                                   — Replaced Windows schtasks with macOS bash execution
  yt_analytics.py                                — Replaced Postiz Docker cred loading with direct .env loading

---

## 5. New Files Created

  .env                                             — root project secrets
  ClipPilot/.env                                   — ClipPilot secrets
  daily_shorts.sh                                  — macOS version of daily_shorts.bat
  learn_shorts.sh                                  — macOS version of learn_shorts.bat
  study_creators.sh                                — macOS version of study_creators.bat
  digest.sh                                        — macOS version of digest.bat
  Dashboard.sh                                     — macOS version of Dashboard.bat
  dashboard_server.sh                              — macOS version of dashboard_server.bat
  ensure_postiz.sh                                 — macOS version of ensure_postiz.ps1
  ClipPilot/src/clippilot/brain/gemini_client.py  — FREE Gemini vision client (new)

---

## 6. Windows-Only Files (NOT changed, still exist for reference)

  daily_shorts.bat, learn_shorts.bat, study_creators.bat,
  digest.bat, Dashboard.bat, dashboard_server.bat,
  ensure_postiz.ps1
  ClipPilot/remotion_explainer/*.bat

Use the .sh equivalents on Mac.

---

## 7. Remaining TODO

  [ ] Fill GEMINI_API_KEY in both .env files
        → https://aistudio.google.com/apikey (free, Google sign-in)
  [ ] Fill PEXELS_API_KEY in both .env files
        → https://www.pexels.com/api/ (free, instant)
  [ ] Fill NOTIFY_EMAIL_ADDRESS in root .env
  [ ] Set Gmail App Password:
        → https://myaccount.google.com/apppasswords (need 2FA on)
        → python notify_email.py --set-password "xxxx xxxx xxxx xxxx"
  [ ] Run doctor check:
        source .venv/bin/activate
        cd ClipPilot && PYTHONPATH=src python3 -m clippilot doctor
  [ ] Test a video end-to-end
  [ ] Switch to Anthropic when satisfied (see Section 2)

---

## 8. Daily Usage Quick Reference

  # Start here every time:
  cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory
  source .venv/bin/activate

  # Dashboard (monitoring):
  python dashboard.py → http://localhost:8899

  # Make a video:
  bash daily_shorts.sh

  # Analytics:
  python yt_analytics.py

  # ClipPilot health check:
  cd ClipPilot && PYTHONPATH=src python3 -m clippilot doctor

## 9. Testing & Manual Usage (Without Claude)

Since Claude/Anthropic is required for autonomous agent tasks (`daily_shorts.sh`), here is how to use the engine manually for free:

### Generate a Custom Video manually
1. Make a copy of `ClipPilot/make_sky_explainer.py` and name it `my_video.py`
2. Open `my_video.py` and type your own `TITLE`, `SCRIPT`, and `KEYWORDS` at the top of the file.
3. Run: `cd ClipPilot && PYTHONPATH=src python3 my_video.py`
4. The script will render your video using Gemini + Pexels.

### Test YouTube Upload manually
A custom script was created to test YouTube uploading directly.
Run: `python test_youtube_upload.py`
This will upload the previously generated test video as a **Private** short on your YouTube channel.
### Free Version Dashboard (Next.js & Flask Backend)
To launch the Next.js dashboard and API backend for managing, editing, and publishing your manually generated videos:
1. **Start the API Backend (Port 5001)**:
   - Open a terminal and run: `cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory`
   - Run: `source .venv/bin/activate`
   - Run: `python3 apps/api-backend/app.py`
2. **Start the Next.js Frontend (Port 3000)**:
   - Open a NEW terminal tab and run: `cd /Users/mayanksharma/Downloads/New_Projects/shorts-factory/apps/web-ui`
   - Run: `npm run dev`
3. Open your browser to: `http://localhost:3000`

### Backend API & AI Brain Updates (2026-07-24)
- **Backend Port Updated**: Changed API backend server port in `apps/api-backend/app.py` and `apps/web-ui/src/app/page.tsx` from `5000` to `5001`.
- **Gemini Model Optimization**: Configured `gemini-2.0-flash` (Google's flagship 100% free-tier AI model) as primary metadata generator, with automated rate-limit (429) fallback to `gemini-2.0-flash-lite`.
