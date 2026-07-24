# ClipPilot

*A native Windows app where **Claude is the brain** that turns long-form video into short-form income — honestly, legally, and with you in the loop.*

ClipPilot watches your videos like a human, picks the clip-worthy moments and explains why, cuts and **captions** vertical shorts, writes the titles/hashtags, and lines them up for **your one-click approval** before publishing — to YouTube, for free. It runs **CPU-only on your machine**; FFmpeg is bundled.

> **Honest framing (read [`VISION.md`](VISION.md)):** the "press start, collect faceless ad-share money" dream ≈ **$0 + a banned channel** — platforms spent 2024–26 building enforcement to kill mass AI content. ClipPilot is built for the version that *pays*: **authorized paid-clipping campaigns, done-for-you clients, and an original funnel** — money from budgets and clients, not ad-share pennies. *Buildable ≠ makes money ≠ allowed to be 100% hands-off* — the app is honest about all three.

---

## Quickstart

```powershell
cd "C:\Dikshant\Money making\ClipPilot"
$env:PYTHONPATH = "$PWD\src"

python -m clippilot doctor      # what's configured + your path to first $
python -m clippilot.ui          # the app (or double-click run.bat)
```

In the app: pick a **Section tab** → Browse to a video → set rights → **Add job**. The background engine clips, captions, and writes metadata, then parks it in **⛔ Review / Approve**. Review the clip + Claude's summary + title/caption/hashtags + any likeness/third-party warnings, then **Approve & publish** or **Reject**. Nothing publishes without your click — unless you turn on auto-approve for a trusted lane (⚙ Settings).

`demo.bat` runs a no-key engine self-test; `cli.bat status` / `cli.bat doctor` for the CLI.

## The three sections — one engine

| Section | Feed it | Money |
|---|---|---|
| **A · Paid Clipping / DFY** | an owned/authorized long-form source | the earner — paid-clipping campaigns + done-for-you clients |
| **B · Faceless Funnel** | just a **topic** (it writes the script, narrates, and assembles the short) | affiliate / brand / traffic — never raw ad-share |
| **C · Ad-Share** | a theme | supported with eyes open; the app shows the honest earnings + ban risk |

All share the pipeline: `ingest → signals → transcribe → understand → find_highlights → clip → caption → compose → ⛔ approve → publish`.

## Make it pay — free YouTube publishing

```powershell
# 1) Create a Google Cloud OAuth "Desktop app" client, enable YouTube Data API v3.
#    Put YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET in .env (copy .env.example → .env).
# 2) Get a refresh token (one command):
python -m clippilot.publish.youtube_auth --write-env
```

Now `publish` uploads to YouTube for **$0** (first-party Data API) — no paid gateway. See [`docs/09-claude-app-connection.md`](docs/09-claude-app-connection.md) §7.

## Let Claude operate it (custom MCP)

Add ClipPilot to Claude Desktop's `claude_desktop_config.json` and Claude can run the whole pipeline — enqueue, run, review, approve, publish, tune settings, even `doctor`:

```json
{ "mcpServers": { "clippilot": {
  "command": "python", "args": ["-m", "clippilot.mcp_server"],
  "env": { "PYTHONPATH": "C:\\Dikshant\\Money making\\ClipPilot\\src" } } } }
```

Full tool reference + setup: [`docs/09-claude-app-connection.md`](docs/09-claude-app-connection.md).

## Run it unattended (24/7)

```powershell
python -m clippilot.service --install --every 5   # Windows Task: drain every 5 min
```

Enable **auto-approve** on a trusted lane (owned source + cleared music) in ⚙ Settings or via the MCP `set_settings` tool, and that lane clips→captions→publishes on its own. Third-party / face-present / ad-share lanes keep the gate + strike guardrail — by design.

## Guardrails (enforced in code, not vibes)

Human approval gate (default ON) · auto AI-disclosure on every post · copyright-strike tracker that auto-pauses a channel at 2 strikes · rights-tagging on every source · **hard line: no non-consensual real-person face/voice swap, ever.**

## Status

✅ **Built & tested — 129 passing tests**, including a real-media end-to-end run (real ffmpeg + whisper → a captioned vertical clip). Every core stage is real: the Claude **vision** understanding brain, ranked highlight selection, vertical clipping, **karaoke captions**, Section B topic→script→TTS→video generation, free YouTube publishing, the MCP control surface (stdio for Claude Desktop + HTTP), the unattended service, and the native GUI. Live status: [`docs/00-OVERVIEW-AND-STATUS.md`](docs/00-OVERVIEW-AND-STATUS.md).

🔜 Next: richer Section B backgrounds / b-roll, first-party IG/FB upload, a Dashboard service-control button.

## Where things live

| Path | Purpose |
|------|---------|
| [`VISION.md`](VISION.md) | the product vision + the honest money model |
| [`src/clippilot/`](src/clippilot/) | the app (engine, brain, media, generate, publish, mcp_server, ui) |
| [`docs/`](docs/) | architecture, legal guardrails, tool reuse map, Claude-app connection |
| [`docs/09-claude-app-connection.md`](docs/09-claude-app-connection.md) | connect Claude + publish setup |

## Run the tests

```powershell
$env:PYTHONPATH = "$PWD\src"; $env:QT_QPA_PLATFORM = "offscreen"
python -m unittest discover -s src/tests -t src
# opt-in real-media e2e: $env:CLIPPILOT_RUN_E2E="1"; $env:CLIPPILOT_WHISPER_MODEL="tiny"
```
