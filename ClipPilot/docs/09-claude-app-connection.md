# 09 — Connect ClipPilot to your Claude app (custom MCP)

**Status:** ✅ built & tested (2026-06-22) · the stdio MCP server + full pipeline-control tool surface · **Owner ask:** *"connect with my claude app via custom mcp or cli so that claude can perform the task."*

This is the bridge that lets **Claude (the desktop app) actually operate ClipPilot** — not just look at a video, but enqueue sources, run the pipeline, inspect jobs at the approval gate, approve/reject, and publish. Claude talks to ClipPilot through a local **MCP server** ClipPilot ships ([`src/clippilot/mcp_server/`](../src/clippilot/mcp_server/)).

---

## 1. Two transports, one tool surface

Both speak JSON-RPC 2.0 through the same dispatcher (`handle_rpc`), so they expose the identical tools:

| Transport | Launch | Who uses it |
|---|---|---|
| **stdio** *(default)* | `python -m clippilot.mcp_server` | **The Claude Desktop app** (it launches the command and pipes JSON line-by-line) |
| **HTTP** (loopback) | `python -m clippilot.mcp_server --http` → `http://127.0.0.1:19789/` | The in-app brain / local debugging / any HTTP MCP client |

stdlib-only — **no `mcp` SDK dependency**, so it imports on Python 3.14. HTTP is forced to `127.0.0.1` (never `0.0.0.0` — the SSRF footgun, docs/02b §4).

## 2. Register it in Claude Desktop

Add ClipPilot to `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`). Restart Claude Desktop after editing.

```json
{
  "mcpServers": {
    "clippilot": {
      "command": "python",
      "args": ["-m", "clippilot.mcp_server"],
      "env": {
        "PYTHONPATH": "C:\\Dikshant\\Money making\\ClipPilot\\src",
        "ANTHROPIC_API_KEY": "<PASTE_YOUR_ANTHROPIC_API_KEY_HERE>",
        "CLIPPILOT_DATA": "C:\\Dikshant\\Money making\\ClipPilot\\data"
      }
    }
  }
}
```

- `PYTHONPATH` — points at ClipPilot's `src/` so `clippilot` imports (until it's `pip install`-ed).
- `ANTHROPIC_API_KEY` — optional; only needed for the Claude-vision understanding + LLM metadata stages. Without it those stages fall back to deterministic/heuristic behavior.
- `CLIPPILOT_DATA` — optional; pins the SQLite job store + media dir to the app's `data/` (so the GUI and Claude operate on the **same** queue). Defaults to `<repo>/data`.

> Use a full Python path (e.g. `C:\\Users\\diksh\\AppData\\Local\\Programs\\Python\\Python314\\python.exe`) for `command` if `python` isn't on Claude Desktop's PATH.

## 3. The tool surface Claude drives

**Read / understand** (stateless, take `{path}`):

| Tool | Does |
|---|---|
| `probe` | source metadata (duration, fps, resolution, codec, audio) |
| `extract_signals` | cheap ffmpeg signals: scene cuts, silence, loudness, shots/min |
| `understand_meta` | preview an understanding pass's cost/shape (no Claude call) |
| `understand_video` | the holistic `Understanding` object + keyframe paths |

**Pipeline control** (drive the real SQLite job store — this is how Claude *performs the task*):

| Tool | Args | Does |
|---|---|---|
| `enqueue` | `source_ref`, `section`(A/B/C), `rights_tag`, `channel`, `idempotency_key` | add a long-form source to the pipeline |
| `run_engine` | `max_steps` | drive pending jobs until they park (approval gate / done / needs-attention) |
| `list_jobs` | `status`, `limit` | list jobs, newest first |
| `job_detail` | `id` | status + understanding summary + likeness flag + title/caption/hashtags + clip paths + events |
| `job_counts` | — | jobs by status |
| `approve` | `id` | approve a gated job → it proceeds to publish |
| `reject` | `id`, `reason` | reject a gated job |
| `requeue` | `id` | retry a needs-attention/paused job |
| `record_strike` | `channel`, `platform` | log a copyright strike (auto-pauses at 2; termination = 3/90d) |
| `doctor` | — | readiness report: what's configured + what each unlocks + next steps to first dollar |
| `get_settings` | — | read current settings (auto_approve, guardrails, brain_model, …) |
| `set_settings` | `auto_approve`, `default_section`, `brain_model`, `max_attempts`, `guardrails` | update + persist settings — the lever that graduates a trusted lane to hands-off |

## 4. The end-to-end loop Claude runs

```
enqueue(source_ref=…, section="A")        →  job queued
run_engine()                              →  ingest…compose, parks at ⛔ approval gate
job_detail(id)                            →  Claude reviews summary + clip + metadata + likeness flag
approve(id)        (or reject)            →  unblocks publish
run_engine()                              →  publishes → done
```

Verified working over stdio as a real process (2026-06-22): `enqueue → run_engine (8 steps, parked) → approve → run_engine (1 step, done)`.

## 5. Honest note on "100% automation" (the owner's goal)

The owner wants 100% automation. The engine **can** run unattended — but VISION §7 and docs/04 keep the **human approval gate ON by default** because fully hands-off publishing of AI/clipped content is exactly what platform enforcement is built to catch. The path to honest automation:

1. **Today:** Claude can run the whole pipeline and *propose* at the gate; a human clicks approve (seconds/day, not hours).
2. **Per-template trust:** once a template (owned source + cleared music + a section) has a track record, the operator can enable auto-approve *for that template only* — then Claude's `approve` closes the loop unattended for that lane.
3. **Never** for third-party/face-present/ad-share lanes — those keep the gate and the strike guardrail.

So "100% automation" is delivered as **graduated auto-approval per trusted lane**, not a blanket hands-off switch — buildable *and* survivable. The MCP surface above already exposes every lever (`approve`, `record_strike`, `get_settings`/`set_settings`) Claude needs to operate within that policy.

## 6. Unattended 24/7 — the service runner + Windows Task Scheduler ✅

`clippilot/service.py` drains the pipeline on a timer so jobs flow even with the GUI closed. Jobs publish unattended **only** where `auto_approve` is on (set it per trusted lane via `set_settings`); everywhere else they wait at the gate.

```powershell
python -m clippilot.service                 # loop forever (default every 10s)
python -m clippilot.service --once          # one drain cycle (what the task runs)
python -m clippilot.service --install --every 5    # register a 5-min Windows task
python -m clippilot.service --uninstall
```

`--install` writes a `service_tick.bat` wrapper (sets PYTHONPATH/CLIPPILOT_DATA) and registers a `schtasks` MINUTE task named **ClipPilot**, so Windows keeps draining across reboots. The full **unattended loop** — `set_settings auto_approve=true → enqueue → service --once → published` — is verified end-to-end (a service cycle drains all 9 stages to `done` with no human click).

**The honest shape of "press start and it runs":** enable `auto_approve` for an owned-source/cleared-music lane, install the task, and ClipPilot clips→captions→publishes that lane 24/7. Point it at a third-party/face/ad-share lane and the gate + strike guardrail stay on — by design.

## 7. Publishing — free first-party YouTube (preferred) vs. the paid gateway

The `publish` stage picks a publisher in this order: **first-party YouTube Data API** (free) → **Upload-Post** (paid cross-poster) → export-metadata-for-manual-upload. AI-disclosure is forced on either way.

**Free YouTube path (recommended)** — one-time setup:
1. In [Google Cloud Console](https://console.cloud.google.com/): create a project, enable the **YouTube Data API v3**, create an **OAuth client ID** of type *Desktop app*. Put its `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` in `.env`.
2. Get a **refresh token** with the built-in helper — it opens the consent page, catches the redirect, and saves the token:
   ```powershell
   python -m clippilot.publish.youtube_auth --write-env
   ```
   (reads the client id/secret from `.env`; writes `YOUTUBE_REFRESH_TOKEN` back to `.env`).
3. Done — ClipPilot now refreshes the access token and does a resumable `videos.insert` itself (no SaaS fee). The unattended service publishes Section A/B output to YouTube for free.

Quotas: a default Data API project gets 10,000 units/day; an upload costs ~1,600 units → ~6 uploads/day. Request more quota in Cloud Console if you scale.

**Paid path:** set `UPLOAD_POST_API_KEY` + `UPLOAD_POST_USERNAME` to cross-post one mp4 to YouTube + IG/FB + TikTok in a single call (upload-post.com account required).

→ Next: a `get_settings`/`set_settings`-aware GUI toggle, then Section B/C generation (Pixelle port) so the funnel + ad-share lanes produce content too.
