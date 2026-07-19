# SETUP — reproducing the factory on your machine

This is a reference architecture for a personal, GPU-backed Windows box. It is **not** a one-click
install. Expect to adapt hardcoded paths and reproduce the Docker/GPU setup. Everything below is the
honest list of what has to exist for the loops to run.

## 0. Prerequisites

- **Windows 10/11** (the runners are `.bat`/`.ps1` + Windows Task Scheduler). A local **NVIDIA GPU**
  is only needed for the optional local image/video generation.
- **[Claude Code](https://claude.com/claude-code) CLI**, signed in (a Claude subscription or an API
  key). The loops call it headlessly: `claude -p "<brief>" --dangerously-skip-permissions`.
- **Python 3.11+** and **Node.js 18+** (Node only for Remotion in `ClipPilot/remotion_explainer`).
- **FFmpeg** on `PATH`.
- **Docker Desktop** (for Postiz).
- **Git Bash** (some helpers are `.sh`).

## 1. Clone & install

```bash
git clone <your-fork-url> shorts-factory
cd shorts-factory
pip install -r requirements.txt          # core is stdlib-only; this covers voice/captions
cd ClipPilot/remotion_explainer && npm install && cd ../..   # only if you render with Remotion
```

> **Fix the paths.** Scripts contain absolute paths like `C:/Dikshant/Money making/`. Search-and-
> replace them for your clone location before running anything.

## 2. Stand up Postiz (the publish/OAuth backend)

Follow the [Postiz self-host guide](https://github.com/gitroomhq/postiz-app). Once running:

1. Connect your **YouTube** channel in the Postiz UI (this performs the Google OAuth and stores the
   refresh token in Postiz's Postgres `Integration` table).
2. Copy your **org API key**: Settings → Developers → Access → Reveal. Save it:
   ```bash
   mkdir -p ~/.config/postiz && printf '%s' 'YOUR_KEY' > ~/.config/postiz/key
   ```
3. Sanity check the channel is visible:
   ```bash
   python .claude/skills/ultimate-short/post_to_postiz.py --list
   ```

The publish scripts (`post_to_youtube.py`, `yt_analytics.py`) read the YouTube client id/secret from
the Postiz container env and the refresh token from its DB — a single source of truth. If you don't
run Postiz, set those in your own `.env` and adapt `access_token()` in those two files.

> **Publish the Google OAuth consent screen to "Production"** in the GCP console. In "Testing" mode
> refresh tokens expire after ~7 days and publishing silently dies.

## 3. Enable the YouTube Analytics API (for the learning loop)

Enable it once for your GCP project so `yt_analytics.py` can read CTR / retention:
`https://console.developers.google.com/apis/api/youtubeanalytics.googleapis.com/overview`
(replace with your project). Without it the loop degrades gracefully to views/likes only.

## 4. Email notifications (optional)

```bash
python notify_email.py --set-password "abcd efgh ijkl mnop"   # a Gmail App Password
python notify_email.py --subject "test" --body "it works"
```
Stored at `~/.config/shorts/email.json` (mode 600). Never commit it.

## 5. Wire the schedules

The five loops are Windows Scheduled Tasks calling the `.bat` runners. Example (adjust names/paths):

```bat
schtasks /Create /TN "DailyShorts_12" /TR "C:\path\to\daily_shorts.bat" /SC DAILY /ST 12:00 /RL LIMITED /F
schtasks /Create /TN "ShortsDashboardServer" /TR "C:\path\to\dashboard_server.bat" /SC MINUTE /MO 30 /RL LIMITED /F
```

- `daily_shorts.bat` → ensures Postiz is up, then runs the producer brief headlessly.
- `learn_shorts.bat` / `study_creators.bat` / `digest.bat` → the weekly/daily loops.
- `dashboard_server.bat` → keeps the dashboard alive at `http://localhost:8899`.

`Shorts Control.bat` is a manual menu for the same actions; the dashboard has one-click buttons too.

## 6. First run

```bash
# produce + publish one Short by hand first, to confirm the whole chain works:
daily_shorts.bat
# then open the dashboard:
Dashboard.bat
```

If anything fails, check the `*_run.log` files and `ensure_postiz.ps1` output. Postiz's own publisher
can be flaky on localhost — `post_to_youtube.py` is the reliable direct-upload path and is used as
primary.
