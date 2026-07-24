# Running ClipPilot

Everything runs on your Python 3.14 — FFmpeg is bundled, nothing to install beyond the Python deps.

## 0. First time

```powershell
cd "C:\Dikshant\Money making\ClipPilot"
$env:PYTHONPATH = "$PWD\src"
python -m clippilot doctor        # what's ready + your path to first $
```

`doctor` tells you exactly what's configured (ffmpeg / whisper / TTS [Chatterbox or edge-tts] / Anthropic key / YouTube / Upload-Post) and the next steps.

## 1. See it make a video (one command)

```powershell
python -m clippilot demo-short "3 surprising facts about the ocean" --open
```

Generates a full short — topic → script → narration → **content-matched B-roll** → **karaoke captions** — and opens the finished `.mp4`. (First run downloads a small Whisper model once.)

## 2. The app (GUI)

| Double-click | Does |
|------|------|
| **`run.bat`** | the native window |
| **`demo.bat`** | engine self-test in the console (no key) |
| **`cli.bat`** | command line (e.g. `cli.bat doctor`, `cli.bat status`) |

In the window:
- **Section A · Paid Clipping** — Browse to a video you own/are-authorized-to-clip → **Add job**. It finds the best moments, cuts vertical 9:16, captions them.
- **Section B · Faceless Funnel** / **C · Ad-Share** — type a **topic** → **Generate short** (script + B-roll + narration + captions).
- **⛔ Review / Approve** — pick a parked job → see the **preview thumbnail**, Claude's summary, title/caption/hashtags, likeness/third-party warnings → **Open** the clip → **Approve & publish** or **Reject**. Nothing publishes without your click.
- **⚙ Settings** — flip **auto-approve** for a trusted lane, set the music bed, strike threshold, and install the **24/7 background task**.

## 3. Publish for free (one-time)

1. Create a Google Cloud OAuth **Desktop** client, enable **YouTube Data API v3**; put `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` in `.env` (copy `.env.example` → `.env`).
2. Get a refresh token: `python -m clippilot.publish.youtube_auth --write-env`

Now publishing goes to YouTube at **$0** (first-party Data API). Optional: a free `PEXELS_API_KEY` upgrades B-roll to curated stock; `UPLOAD_POST_*` keys add IG/FB/TikTok cross-posting.

## 4. Run it unattended (24/7)

```powershell
python -m clippilot.service --install --every 5   # Windows task: drain every 5 min
```

Enable **auto-approve** (⚙ Settings, or the MCP `set_settings` tool) on a trusted owned-source lane, and that lane clips → captions → publishes on its own. Third-party / face / ad-share lanes keep the gate + strike guardrail.

## 5. Done-for-you templates (CLI)

```powershell
python -m clippilot profile-save --name Acme --section B --channel acme_yt --seconds 25 --bgm "C:\music\acme.mp3"
python -m clippilot enqueue-profile --source "5 tips for first-time homebuyers" --profile Acme
python -m clippilot enqueue-folder --folder "C:\clients\acme\footage" --section A   # batch a whole folder
python -m clippilot run            # process the queue
```

## 6. Let your Claude app drive it (MCP)

Add ClipPilot to Claude Desktop and Claude can enqueue, run, review, approve, publish, run `doctor`, and manage profiles. Setup + full tool list: [`docs/09-claude-app-connection.md`](docs/09-claude-app-connection.md).

## 7. The Claude brain (optional but recommended)

Put `ANTHROPIC_API_KEY=<your-anthropic-key>` in `.env` (a real key starts `sk-ant-`). With it, Claude *watches* the keyframes to pick the best moments and writes real, topic-specific scripts/metadata. Without it, the app falls back to solid heuristics (speech-density highlights, template scripts) — still produces watchable output, just not as smart.

## Run the tests

```powershell
$env:PYTHONPATH = "$PWD\src"; $env:QT_QPA_PLATFORM = "offscreen"
python -m unittest discover -s src/tests -t src
# opt-in real-media render + e2e tests (slower):
$env:CLIPPILOT_RUN_RENDER="1"; $env:CLIPPILOT_RUN_E2E="1"; $env:CLIPPILOT_WHISPER_MODEL="tiny"
```
