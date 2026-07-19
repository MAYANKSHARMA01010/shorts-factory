# PLATFORM MAP — everything this system is, as of 2026-07-02

One page to understand the whole machine. This is what we actually built (all live, all verified).

## What it is, in one sentence
A **fully autonomous, self-improving YouTube Shorts factory**: it picks topics, researches them,
writes validated scripts, renders bespoke hand-coded animated videos, QAs them like a viewer,
publishes directly to YouTube 3×/day, studies the best creators daily, reads its own analytics
weekly, and rewrites its own playbook — with a human needed only for strategic decisions.

## The channel (the current asset)
- **"Mango cuts"** (`@dikshantbhatia4613`, channel `UCMoBTABrKCeJtO_v8Ff_24Q`)
- 29 subs · 7,839 total views · 28 videos (7 published autonomously since 2026-06-29)
- Niche: hybrid **science-curiosity** (views: 400–1,700/video) + **personal finance** (retention: 76% AVP, high-CPM)
- Monetization: **not yet** (pre-YPP). This is the #1 thing the future plan addresses.

## The five autonomous loops (Windows Task Scheduler)
| Loop | Schedule | What it does |
|---|---|---|
| **DailyShorts** | 12:00 / 17:00 / 21:00 | one full video each: topic → research → GATE validate → script → render → watch-back QA → publish direct to YouTube |
| **CreatorStudy** | daily 08:00 | finds top Shorts by real views (`yt_top.py`), `/watch`es them frame-by-frame, grows `competitor_playbook.md` |
| **ShortsLearn** | Sun 10:00 | reads YouTube Analytics (CTR/AVP), runs one-variable experiments, rewrites SKILL.md's ★ SELF-LEARNED RULES |
| **ShortsDigest** | daily 23:00 | emails the day's summary (needs Gmail app-password setup to actually send; saves `digest_last.html` meanwhile) |
| **ShortsDashboardServer** | every 30 min (self-heal) | keeps the live dashboard at `http://localhost:8899` alive |

## The intelligence layer (what makes it compound)
- **`SKILL.md` ★ SELF-LEARNED RULES** — evidence-tiered rules (HYPOTHESIS→SIGNAL→RULE) the producer must apply; only the learning run edits them, with backups (`skill_backups/`).
- **`competitor_playbook.md`** — techniques extracted from winners (Gohar Khan 19.5M, Mark Tilbury 10.2M, Zack D. 128M, Terra Mystica 63M, AdviceWithErin 12.9M…). Grows daily.
- **`learnings.md`** — append-only lab notebook. Active experiments: **E1** (niche views gap), **E2** (≤20s science scripts → AVP ≥70% target, review 07-09), **E3** (finance impressions trend).
- **`variation/` + `variation_ledger.md`** — the anti-"inauthentic content" engine: rotates 25 title shapes × 8 formats × 6 visual skins × 8 voices × lengths; hard diversity gate (≥3 axes different from last 6 videos).
- **`DECISIONS_FOR_OWNER.md`** — strategic forks parked for the owner (OPEN: niche decision A/B/C — Hybrid recommended).

## The production stack (all local, RTX 2060)
- **Script/plan:** `ultimate-short` skill (hook rules, GATE validation, director briefs)
- **Voice:** edge-tts (8 rotating voices) → faster-whisper word timings (`make_narration.py`)
- **Video:** hand-coded **Remotion SVG explainers** (`ClipPilot/remotion_explainer/`, 124+ comps) — no stock, no slideshows (this is the moat vs. YouTube's anti-AI-slop policy)
- **Finish:** `recut.py` pacing + 570-file SFX library + loudnorm −14 LUFS
- **QA:** `/watch` skill — the producer literally watches its own video and fixes retention leaks
- **Publish:** `post_to_youtube.py` (direct Data API upload — reliable; Postiz kept only for scheduling/other platforms)
- **Analytics:** `yt_analytics.py` (Data + Analytics API: views, CTR, AVP) · `yt_top.py` (competitor finder)

## Control surfaces (for the owner)
- **Dashboard** `http://localhost:8899` — live B&W terminal view: NOW / schedule / services / analytics / published / studied / decisions + **control panel buttons** (make video, study, learn, digest, all)
- **Desktop icons:** "Shorts Dashboard", "Shorts Control" (legacy menu)
- **Logs:** `daily_run.log`, `study_run.log`, `learn_run.log`, `digest_run.log`

## What the data says so far (the honest read)
- **Science-curiosity:** high reach (algo trusts the channel here), weak retention (49.7% AVP → E2 is fixing with ≤20s)
- **Finance:** excellent retention (76.1% AVP — production quality is proven), low reach so far (algorithmic channel-history bias, expected to lift with consistency — E3 tracks it)
- **Composite ranking:** science dominates the mix; finance is the high-RPM supplement (≤1/day, number-led hooks)

## Known gaps / loose ends
1. **Not monetized yet** — see `MASTER_PLAN.md` (the whole point of this folder)
2. **Email digest can't send** until the Gmail app password is saved (`python notify_email.py --set-password "…"`)
3. **Google OAuth consent screen** may still be in Testing mode → refresh token can expire every 7 days (publish the app to Production to make it permanent)
4. **Niche decision A/B/C** still open in `DECISIONS_FOR_OWNER.md` (running Hybrid per recommendation meanwhile)
5. Claude subscription usage is the real "cost of goods" — 3 heavy runs/day + study + learn runs
