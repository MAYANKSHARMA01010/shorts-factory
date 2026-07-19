# ClipPilot — Vision

*A native Windows app where Claude is the brain that turns long-form video into short-form income — honestly, legally, and with you in the loop.*

**Owner:** Dikshant · **Status:** feature-complete & verified — 197 tests + a real-media render/e2e gate, both money paths green · **Last updated:** 2026-06-22

---

## 0. One sentence

> ClipPilot watches your videos like a human, decides what's worth clipping, cuts and captions vertical shorts, writes the titles and hashtags, and lines them up for your one-click approval before publishing — with Claude as the brain and you as the editor-in-chief.

---

## 1. The dream — and the honest reframe

**What you asked for:** a 100% automated machine that clips videos and posts YouTube Shorts / Reels while money prints in the background.

**What the research found (and what changed the plan):** the *machine* is very buildable — ~95% of the production pipeline can be automated. But three things had to be faced honestly, or this becomes months of work for $0:

| The fantasy | The reality |
|---|---|
| "Press start, collect ad-share money from faceless auto-shorts" | YouTube (Jul 2025) and Meta (through Apr 2026) built enforcement *specifically* to kill mass-produced AI content. Expected value ≈ **$0 and a terminated channel.** Shorts pay **$0.01–0.04 per 1,000 views**; you need ~10M views just to *qualify* to earn. |
| "Auto-clip anyone's videos and monetize" | That's the **#1 channel-termination / DMCA path.** 3 strikes in 90 days = permanent ban. |
| "100% hands-off" | Every configuration that both *pays* and *survives* needs a human value-add per video. |

**The reframe that makes it real:** the same engine, fed by **authorized sources**, steered by **your judgment**, pointed at money that comes from **budgets and clients** — not ad-share pennies:

- 🥇 **Authorized paid-clipping campaigns** (creators pay per 1,000 views from a funded pool) — fastest first dollar, copyright-safe.
- 🥈 **Done-for-you clipping/shorts service** — recurring B2B revenue, client owns the source.
- 🥉 **An original faceless funnel channel** — content as a funnel to affiliate/brand deals, *not* AdSense.

**Honest year-1 range:** the faceless-ad-share dream ≈ **$0**. The steered, client-and-campaign version ≈ **$5K–$30K** if you work it. ClipPilot is built for the version that pays.

> The soul of this project is keeping three things separate: *buildable* ≠ *makes money* ≠ *allowed to be 100% hands-off.* ClipPilot is honest about all three at every step.

---

## 2. What ClipPilot is

A **native Windows desktop app** (`run.bat` → a real window) that orchestrates a fleet of open-source tools, with **Claude as the decision-making brain** connected via MCP. It is:

- **An engine** — a queue + state machine that drives every video through ingest → understand → clip → caption → compose → **approve** → publish.
- **A brain** — Claude *sees* the keyframes (not just the transcript), picks the clip-worthy moments and explains why, writes the platform-specific titles/captions/hashtags, and flags anything risky.
- **A cockpit** — a GUI where you watch the clips Claude proposes and **approve or reject** before anything goes out. You are the editor-in-chief; Claude is the tireless editor.

It runs **CPU-only on your own machine** — your footage and keys never leave it (except the Claude API text/vision calls you opt into). FFmpeg is bundled; nothing to install.

---

## 3. The product — three sections, one engine

All three share the same pipeline and the same approval gate; they differ in *what they're pointed at*:

### 🅰 Paid Clipping / Done-For-You *(the money-maker)*
Drop in a long-form source you own or are authorized to clip (a stream, podcast, talk, client's footage). ClipPilot finds the best 20–45s moments, reframes them vertical, captions them, and queues them for your approval. Monetize via **paid-clipping campaigns** and **DFY clients**. *This is the section that earns first.*

### 🅱 Faceless Funnel
A topic + a synthetic/own avatar → an original, materially-varied short. Monetize through **affiliate links / brand deals / traffic to your service** — never raw ad-share. Auto-applies AI-disclosure; Claude enforces "is this actually original?".

### 🅲 Ad-Share Automation *(built, with eyes open)*
The classic theme→short automation. Built because you asked — but the UI surfaces the honest earnings + ban-risk so expectations stay real. Same approval gate, same disclosure.

---

## 4. The brain — Claude as understander *and* judge

The capability you specifically wanted: **understand a video like a human, not just transcribe it.**

ClipPilot gives Claude the four senses a person uses watching a clip:
- **Eyes** — sampled keyframes sent as real image blocks; Claude reads scenes, on-screen text, faces, framing.
- **Ears** — the transcript (faster-whisper) + a loudness/energy curve (laughter, applause, music swells).
- **Reading** — on-screen text Claude reads straight off the frames.
- **Structure** — shot/scene boundaries with timecodes, so it reasons over a *timeline*, not a blob.

From that, Claude produces a holistic **understanding**: a summary, per-scene descriptions, mood, topics/entities, and **highlight candidates each carrying a reason and a score** — never a bare timestamp. The deterministic tools *extract*; Claude *understands*. Cost is honest: **~$0.15–0.30 per 10-minute video.**

Claude also writes the **per-platform metadata** (title/caption/hashtags within each platform's caps) and **flags a real identifiable person** — which automatically routes the job to a consent/likeness check before publishing.

---

## 5. How it works — the pipeline

```
ingest → extract_signals → transcribe → UNDERSTAND → find_highlights
       → clip → caption → compose → ⛔ APPROVAL GATE → publish
```

- **Deterministic code** owns the mechanics (cut, caption, render, upload) — fast, repeatable, idempotent.
- **Claude** owns the judgment (what to clip + why, the copy, the variation check, the disclosure call).
- **You** own the one irreversible step: *approve → publish.* Auto-publish only ever unlocks per-template, for low-risk owned-source content, after a template has earned trust.

Built on the tools you assembled — reused where the license and platform allow (FFmpeg, faster-whisper, MoneyPrinterTurbo's metadata + publisher, Pixelle's generation pipeline, remotion's captions), and deliberately *not* vendoring the AGPL/GPL/GPU-only/macOS ones. Every reuse decision is documented in `docs/08-reuse-map.md`.

---

## 6. The money model (honest)

| Path | Honest economics | ClipPilot's edge |
|---|---|---|
| **Authorized paid clipping** | $0.50–$3.00 / 1,000 views (25–100× ad-share) | Throughput: produce volume, keep the human-approved quality bar |
| **Done-for-you service** | $1–5K/mo recurring per few clients | One operator serving many sources fast |
| **Original funnel → affiliate/brand** | The real "faceless" income | Genuinely varied, disclosed, original content |
| **Raw faceless ad-share** | ~$0, high ban risk | *Supported, but the app tells you the truth* |

**The pattern:** sell picks-and-shovels, or get paid by someone with a marketing budget. Never bet the business on platform ad-share for AI shorts.

---

## 7. Non-negotiables — guardrails baked into the app

These are *engineering requirements*, enforced in code, not good intentions:

1. **Human approval gate** before every publish.
2. **Auto AI-disclosure** on every AI-generated/altered post.
3. **Copyright-strike tracker** that auto-pauses a channel at 2 strikes (termination is 3).
4. **Cleared-music only** — never trending/catalog audio on a monetized post.
5. **Rights tagging** on every source (owned / licensed / CC / third-party), surfaced at review. *(Owner chose to allow third-party sourcing — the app warns, tracks, and keeps the gate, but the legal risk is the owner's accepted business risk.)*
6. **Hard line:** no non-consensual real-person face-swap / voice-clone. Ever.

---

## 8. Architecture at a glance

- **Shell:** PySide6 native Windows app (system tray, 3 section tabs, dashboard, approval-review screen).
- **Brain:** Claude (`claude-opus-4-8`, vision) via the Anthropic SDK; MCP-over-HTTP tool surface on `127.0.0.1`.
- **Engine:** SQLite job queue + state machine; background worker thread (never blocks the UI).
- **Media:** bundled FFmpeg (signals, clip, caption, compose), faster-whisper (transcribe) — all CPU, all on Python 3.14.
- **Publish:** social-metadata generation + Upload-Post cross-poster (ported from MoneyPrinterTurbo); first-party YouTube/IG APIs next.

Full detail in `docs/02-architecture.md` + `docs/02b-architecture-update.md`.

---

## 9. Where it stands — built vs. ahead

**✅ Built, tested & verified (197 tests + a full real-media render/e2e gate — both money paths green):** the job engine + approval gate + strike guardrail; real ffmpeg signals/keyframes; faster-whisper transcription; the **Claude vision understanding brain** (with a deterministic, signal-based fallback when there's no key); **Section A** end-to-end (clip authorized long-form → ranked highlights → vertical 9:16) and **Section B/C** generation (topic → original Claude script → **local-GPU Chatterbox TTS** (MIT; edge-tts cloud fallback; SAPI removed) → **content-matched B-roll** from Pexels/Openverse that **changes per spoken phrase** → assembled short); **big bold karaoke captions** (the active word pops); an optional cleared **music bed**; **free first-party YouTube publishing** (+ a one-command OAuth helper) with Upload-Post cross-posting; the **Claude-app MCP connection** (stdio for Claude Desktop + HTTP) exposing the whole control surface incl. `doctor`, settings, and DFY templates; an **unattended service + Windows 24/7 task** with graduated auto-approve; **DFY templates** across MCP/CLI/GUI; the **native Windows GUI** (sections, review-with-thumbnail, settings, templates); a one-command **`demo-short`**; and **two adversarial code-review passes that found & fixed 25 real bugs** (a double-publish race, AI-disclosure compliance gaps, a broken approval button, and more).

**🔜 The one genuinely-blocked item:** first-party IG/FB upload needs the video at a public URL (a hosting dependency) — and the paid Upload-Post path already covers IG/FB/TikTok in the meantime. Otherwise the build is feature-complete; remaining work is polish.

Live status always in `docs/00-OVERVIEW-AND-STATUS.md`.

---

## 10. What winning looks like

- **Month 1:** the app reliably turns one authorized long-form video into a batch of approved, captioned vertical clips you'd be proud to post.
- **Months 2–6:** first real income from **paid-clipping campaigns** + **a couple of DFY clients** — the engine is a genuine throughput edge.
- **By year-end:** a steerable, mostly-automated clip/repurpose factory that earns from budgets and clients, with you spending minutes-per-day at the approval gate instead of hours in an editor.

Success is **not** "a faceless channel printing ad money" — that's the version the whole internet's enforcement machinery spent two years learning to kill. Success is **a tool that makes a real operator faster than anyone else, pointed at money that actually exists.**

---

## 11. The bet

Build the engine — you have the parts and most of it is done. But run it as **an AI-assisted clip/repurpose factory you steer, fed by authorized sources, gated by your judgment, and aimed at clients and campaigns.** That version makes money. ClipPilot is that version.
