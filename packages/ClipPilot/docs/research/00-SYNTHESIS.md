# Deep-Research Synthesis (raw evidence)

> Output of the 6-lens deep-research workflow (`wpyeupafa`, 11 agents, 2026-06-22): YouTube money · Meta money · faceless/clipping economics · legal/ToS · architecture · 30-tool inventory — each money/legal claim adversarially fact-checked before synthesis. The planning docs `01`–`05` are derived from this. Where research and the skeptic disagreed, the conservative/verified figure is used and flagged.

---

# Automated Clipping + Shorts/Reels Money Machine: The Decision Document

*Lead analyst's verdict, 2026-06-22. Written for a solo founder before committing months of build time.*

## 1. VERDICT IN ONE PARAGRAPH

**Technically: yes, you can build it (high feasibility). Financially: the version you described — "press start, walk away, collect checks" — is a money-loser, and the platforms have spent 2025–2026 explicitly engineering it to fail.** A native Windows app with Claude as an MCP-driven brain orchestrating clip → caption → render → publish is a sound, buildable system; roughly 95% of the *production pipeline* can be automated with the tools you already cloned. But three things are fantasy and one thing is real. Fantasy #1: **clipping other people's videos 100% automatically and monetizing it** — the single fastest route to Content ID revenue-diversion, DMCA strikes, and permanent channel termination (YouTube wiped 16 channels with 4.7B views in Jan 2026; Meta strips *all* algorithmic reach from repost accounts). Fantasy #2: **per-view ad revenue from mass-produced AI shorts** — YouTube's July 15, 2025 "inauthentic content" policy makes templated, zero-human-input content *YPP-ineligible from the start*. Fantasy #3: **"hands-off."** Every configuration that both pays and survives requires a human value-add per video. What's **real**: an AI-*assisted*, human-in-the-loop engine that you steer — genuinely original content and/or **authorized** paid-clipping campaigns and/or selling the pipeline as a service. The machine is fine. Pointing it at platform ad-share for faceless auto-content is the mistake.

## 2. THE MONEY REALITY

**Honest per-view economics (verified, conservative):**

| Path | Real RPM / pay (per 1,000 views) | What $1,000/mo requires |
|---|---|---|
| YouTube Shorts (broad/global) | **$0.01–$0.04** | ~25–40M views/month |
| YouTube Shorts (US/UK niche) | $0.05–$0.12 | ~10M views/month |
| Instagram Reels ad-share | **$0.01–$0.03** (does pay, but economically irrelevant) | Not viable |
| Facebook Content Monetization | **$0.05–$0.10** median, after 30–50% ineligible-view haircut | ~3–4M+ qualified views/month |
| **Authorized paid clipping (Whop Content Rewards)** | **$0.50–$3.00** (avg ~$1.00–$1.25) | ~$500–$3,000 per 1M views |

Biggest lever everywhere: **geography** — a US view ≈ 10× an India/SE-Asia view.

**Monetization walls (verified against primary sources):**
- **YouTube YPP Tier 2** (ad revenue): **10M Shorts views / rolling 90 days** OR 4,000 long-form watch-hours/12mo. Shorts-feed watch time does *not* count toward hours.
- **July 15, 2025 "Inauthentic content" policy**: targets "mass-produced," "templated with little variation," "easily replicable at scale." Enforcement is **channel-level and terminal**. Treat **permanent channel loss + flagged AdSense footprint** as the *modal* bad outcome.
- **Meta**: demonetization of unoriginal content (Jul 2025), "Rewarding Original Creators" reweighting (Mar 2026), **April 30, 2026 aggregator crackdown** stripping all recommendations from repost-heavy accounts. Scrape+repost is the single most-targeted behavior.

**Money models ranked (best risk-adjusted ROI for a solo operator):**
1. **Authorized paid clipping** (Whop Content Rewards) — paid from a creator's marketing budget, copyright-safe, fastest cash (week 1–4). **Best path.**
2. **Productized "done-for-you" clipping/shorts service (B2B)** — recurring fees, client owns source, zero RPM dependency. Most durable.
3. **Affiliate/brand-deal funnel on an original niche channel** — content as funnel, not ad-share. Needs real audience (3–9 months).
4. **Selling the tool/method** — saturated but honest if genuinely useful.
5. **(Worst) Raw Shorts/Reels ad-share from auto-content** — lowest RPM, gated behind 10M-view wall, the explicit enforcement target.

**Blunt year-1 earnings (solo, self-hosted, worked consistently):**
- **Pure automated ad-share shorts (original plan): $0–$500/year. Most likely $0**, often net-negative after compute+time. The *expected* outcome.
- **Authorized paid clipping, ground out: ~$500–$3,000/month** months 2–6 → **$5K–$25K year 1** if clips perform.
- **DFY service, a few retained clients: ~$1,000–$5,000/month recurring** by end of year 1 with active outreach.
- **Blended (campaigns + service): ~$5,000–$30,000 year 1.** Faceless ad-revenue dream: **assume near-zero.**

**Failure base rate:** ~3% of automation channels ever reach monetization (blog estimate). For a templated, zero-human-judgment pipeline: **>50% probability over 12 months of demonetization/rejection/termination.**

## 3. THE WINNING STRATEGY

Don't build a money printer. Build a **clip/repurpose engine that you steer**, pointed at money from *budgets and clients*, not ad-share pennies:

**A.** Engine is **authorized-source-only**: ingest accepts (1) content you own, (2) licensed/authorized, or (3) CC/public-domain. Eliminates ~90% of legal+ban risk.
**B.** Monetize via **authorized paid clipping** (fastest first dollar) + **done-for-you service** (durable recurring) in parallel.
**C.** Own faceless channel only as an **original funnel** (synthetic/own avatar, original scripts, materially varied substance, auto AI-disclosure) → monetize via affiliate/brand deals/traffic to your service, never AdSense.
**D.** **Claude's job** = judgment (which spans are clip-worthy + why, hooks/titles/descriptions per platform, ensuring variation, flagging disclosure needs). Deterministic code cuts/renders/publishes. **Human owns the publish-approval gate.**

Pattern across the whole dossier: **sell picks-and-shovels, or get paid by someone with a marketing budget. Never bet on platform ad-share for AI shorts.**

## 4. RECOMMENDED ARCHITECTURE

**Mental model:** Claude is the MCP **client** (brain that decides/writes). The Windows app is a fleet of MCP **servers** (typed tools). Deterministic code executes all side effects. A human approval gate sits before every irreversible publish.

**Stack:** Tauri 2 (Rust core + webview UI) shell *(alt: Python+PySide6 if you're far more fluent in Python)*; brain = `claude-opus-4-8` via Anthropic SDK with manual agentic loop + human gate, prompt caching, bulk steps offloaded to LocalAI; Windows Task Scheduler + WinSW/nssm service; SQLite job queue (state, attempts, idempotency_key, content_hash); hand-rolled YouTube Data API v3 / Instagram Content Publishing / FB Graph Reels clients.

**API facts (verified/corrected):**
- YouTube `videos.insert`: **1 quota unit/call** since Dec 4, 2025 (brief's "100" was wrong), **hard cap 100 calls/day**. High velocity of near-identical content = faster termination, not a feature.
- Instagram Content Publishing: **100 posts/rolling 24h** (50 was stale). Business accounts only; **cannot attach in-app/trending music via API** — audio must be embedded pre-upload.

```
┌───────────────────────────────────────────────────────────────────────┐
│                    NATIVE WINDOWS APP ("Studio")                       │
│        Tauri (Rust core + webview UI) · system tray · SQLite           │
│  ┌──────────┐    ┌────────────┐    ┌──────────────────────────────┐    │
│  │ Task     │──▶│ Job Queue   │──▶│ Orchestrator (state machine)  │    │
│  │ Scheduler│    │ (SQLite +  │    │  "what should happen next?"  │    │
│  │ /service │    │  retries,  │    └───────────────┬──────────────┘    │
│  └──────────┘    │ idempotency)│                   │ asks for decisions │
│                  └────────────┘                    ▼                    │
│   app exposes MCP SERVERS ◀──tool calls────┌────────────────────────┐  │
│        (typed tools)                       │  CLAUDE = MCP CLIENT    │  │
│   ┌──────────────────────────────────┐     │  (claude-opus-4-8)     │  │
│   │ ingest │ transcribe │ find_       │     │  THE BRAIN: picks      │  │
│   │ highlights │ clip │ caption │     │────▶│  clips, writes copy,   │  │
│   │ voiceover │ broll │ render │      │     │  ensures variation     │  │
│   │ compose │ schedule │ publish      │     └────────────────────────┘  │
│   └────┬──────────────────┬──────────┘                                  │
│        │ shell out        │ HTTP             ⛔ HUMAN APPROVAL GATE       │
│        ▼                  ▼                  (tray UI + push to phone)   │
│  ┌──────────────────┐  ┌───────────────────────────────────────────┐   │
│  │ LOCAL OSS TOOLBELT│  │ PLATFORM PUBLISH (build yourself)         │   │
│  │ FFmpeg · moviepy ·│  │ YouTube Data API v3                       │   │
│  │ faster-whisper ·  │  │ Instagram Content Publishing API (Reels)  │   │
│  │ VideoCaptioner ·  │  │ FB Graph (Reels)                          │   │
│  │ hyperframes ·     │  │ ⚠ NOT MoneyPrinter auto-publish (→ China) │   │
│  │ LocalAI · Duix    │  │ ⚠ ingest accepts OWNED/LICENSED/CC only   │   │
│  └──────────────────┘  └───────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

## 5. LEGAL GUARDRAILS

**🟢 GREEN (safe to automate, with AI disclosure):** editing/captioning *your own or licensed/CC* footage; fully-synthetic or your-own avatar+voice (Duix on yourself/non-existent person) with auto-disclosure; commercially-licensed/royalty-free music embedded pre-upload; posting via official APIs at human cadence.

**🟡 YELLOW (guardrails required — breaks "100% automated"):** AI shorts at scale (legal to make, demonetized unless materially varied + genuine value; mandatory "altered/synthetic content" disclosure — live since **March 2024**, not May 2025); real-person avatar/voice only with signed scoped release; **EU AI Act Art. 50** deepfake disclosure becomes hard law **Aug 2, 2026** for any EU viewers; automation via official APIs only, throttled, single account.

**🔴 RED (don't — termination/civil/criminal):** fully automated clipping + re-upload of third-party copyrighted video for monetization (3 DMCA strikes/90 days = permanent termination; #1 termination path); face/voice-clone of any real identifiable person without consent (right-of-publicity, TN ELVIS Act, CA AB 1836/2602, ~40+ state laws; intimate deepfakes → federal criminal under TAKE IT DOWN Act, live May 19, 2026; NO FAKES Act advanced past Senate Judiciary June 2026 — imminent); deceased-person likeness without estate consent; the MuAPI "no content filters" path with no human review (verified locally at `Open-Generative-AI-main/.../src/lib/muapi.js`); auto-pulling trending/in-app music for monetized/API posts.

**Non-negotiable guardrails to bake in:**
1. **Ingest allow-list** — owned/licensed/CC only.
2. **Mandatory human approval gate** before every `publish_*`.
3. **Auto-apply AI-disclosure labels** in publish step.
4. **Cleared-music-only** enforcement.
5. **No real-person likeness without a stored signed release** (default avatar = synthetic/yourself).
6. **No Deep-Live-Cam, no unfiltered MuAPI** in any published path.

## 6. PHASED BUILD PLAN

**MVP = own/licensed-source clipping + faceless shorts, CPU-only, deterministic render, human-gated publish to YouTube + IG. No self-hosted GPU video-gen.**

| Phase | Scope | Person-weeks |
|---|---|---|
| **0 — Setup** | Tauri shell: tray, autostart, SQLite queue, job state machine, supervisor. Start OAuth/app-review early (long lead time). | **2.0** |
| **1 — Minimal clip + caption + manual review** | MCP host + tool servers (ingest[allow-list], transcribe, clip, caption, compose) wrapping FFmpeg/whisper/VideoCaptioner. Claude orchestrator + **approval gate**. *Runs a real authorized-clipping channel on its own.* | **4.0** |
| **2 — Deterministic render + cheap compute** | hyperframes templating (byte-identical → content-hash idempotency) + LocalAI bulk TTS/LLM. | **2.5** |
| **3 — Publish + scheduling** | YouTube Data API v3 + IG Content Publishing clients (OAuth, rate-limit accounting, idempotency, retries), scheduler/service hardening, NEEDS_ATTENTION parking, push-to-phone HITL, e2e testing. | **4.5** |
| **MVP total** | | **≈13 person-weeks (~3 months solo)** |

**Add-ons:** FB Reels +0.5wk · TikTok +1.0wk code (+2–4wks calendar for posting audit) · Duix talking-head +1.5wk · self-hosted GPU AI b-roll +3–4wks *(recommend hosted API instead: +1wk)*.

**Costs:** Claude orchestration **~$0.05–$0.10/video** (text-only; caching + LocalAI offload lowers it) — *not your cost driver*. Compute floor **<$100/mo** self-hosted. GPU is the real cost only if self-hosting video-gen (avoid for MVP). **Net MVP run cost ≈$50–$150/mo** excluding time. Real costs = **time + ban-risk, not cash.**

## 7. HARD TRUTHS / OPEN DECISIONS

1. **Monetize the TOOL/SERVICE or the CONTENT?** The fork that matters most. Durable money = paid by someone with a budget (campaigns, DFY) or selling the tool — not ad-share. If committed to "my channel prints ad money," honest EV ≈ **$0 + likely terminated channel.**
2. **Legal-risk tolerance** — willing to enforce owned/licensed/CC ingest + human gate (which break "100% automated")? If not, you're building a termination generator.
3. **GPU budget** — buy 24GB+ NVIDIA + WSL2, or hosted APIs? For MVP, **skip GPU entirely.**
4. **Which platforms** — YouTube Shorts + FB are the only meaningful per-view targets (both brutal); IG = funnel only; TikTok needs an audit (defer). Pick **YouTube + one of {FB, IG-as-funnel}** for MVP.
5. **Niche + geography** — US/UK high-CPM niche ≈ 10× a global meme channel. Decide before building; it shapes avatar/voice/templates.
6. **Stack fluency** — Tauri/Rust vs Python/PySide6. Pick the one you'll actually ship.
7. **Will you do sales?** The two best paths need outbound human effort. Compute is the easy 20%; sales + editorial judgment are the load-bearing 80%.

**Bottom line:** Build the engine — good idea, you have the parts. But as **an AI-assisted clip/repurpose factory you steer, fed only by authorized sources, gated by your judgment, pointed at clients and campaigns** — not a faceless ad-share money printer. The first version makes money; the second is the one the entire internet's enforcement machinery spent two years learning to kill.
