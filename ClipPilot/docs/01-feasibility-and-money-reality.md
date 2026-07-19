# 01 — Feasibility & Money Reality

**Status:** ✅ written from research (`research/00-SYNTHESIS.md`) · **Date:** 2026-06-22
**Read this first.** It decides whether the project is worth building and *what* to build.

---

## 1.1 The verdict

Two separate questions, two separate answers:

| Question | Answer |
|---|---|
| **Can we build a native Windows app with Claude-as-brain (via MCP) that automates clipping + Shorts/Reels?** | ✅ **Yes — high feasibility.** ~95% of the *production* pipeline is automatable with the tools already cloned. |
| **Will the "press start, walk away, collect ad-share money" version make money?** | ❌ **No.** Expected value ≈ **$0 and a likely-terminated channel.** It is the exact pattern YouTube + Meta spent 2025–2026 engineering to kill. |
| **Is there a version that *does* make money?** | ✅ **Yes** — an AI-*assisted*, human-steered engine fed only by **authorized** sources, monetized via **paid clipping campaigns** + **done-for-you service**, not platform ad-share. |

**Three fantasies to abandon:**
1. **Auto-clipping other people's videos for monetization** → fastest route to Content ID diversion, DMCA strikes, permanent termination. (YouTube removed 16 channels w/ 4.7B views in Jan 2026; Meta strips all algorithmic reach from repost accounts.)
2. **Per-view ad revenue from mass-produced AI shorts** → YouTube's July 15 2025 "inauthentic content" policy makes templated zero-human content **YPP-ineligible from the start**.
3. **"100% hands-off"** → every configuration that both pays *and* survives needs a human value-add per video.

## 1.2 The money reality (verified, conservative)

**Per-view economics:**

| Path | Real pay / 1,000 views | To clear $1,000/mo |
|---|---|---|
| YouTube Shorts (broad/global) | **$0.01–$0.04** | ~25–40M views/mo |
| YouTube Shorts (US/UK niche) | $0.05–$0.12 | ~10M views/mo |
| Instagram Reels ad-share | **$0.01–$0.03** (pays, but irrelevant) | Not viable |
| Facebook Content Monetization | **$0.05–$0.10** median (after 30–50% ineligible-view haircut) | ~3–4M+ qualified views/mo |
| **Authorized paid clipping (Whop Content Rewards)** | **$0.50–$3.00** (avg ~$1.00–$1.25) | ~$500–$3,000 per 1M views |

> **Geography is the biggest lever** — a US view ≈ 10× an India/SE-Asia view. Cheap global traffic earns at the rock bottom of every range. Authorized clipping pays **~25–100×** the ad-share rate per view.

**The walls you must clear (or can't earn at all):**
- **YouTube YPP Tier 2** (ad revenue): **10M Shorts views / rolling 90 days** *or* 4,000 long-form watch-hours/12mo. Shorts-feed watch time does **not** count toward hours. Most automated channels never reach 10M.
- **YouTube "Inauthentic content" policy (Jul 15 2025):** explicitly targets "mass-produced," "templated with little variation," "easily replicable at scale." Enforcement is **channel-level and terminal** — assume **permanent channel loss + a flagged AdSense footprint** as the *modal* (most likely) failure, not a rare tail.
- **Meta crackdowns:** unoriginal-content demonetization (Jul 2025) → "Rewarding Original Creators" reweighting (Mar 2026) → **April 30 2026 aggregator crackdown** stripping *all* recommendations from repost-heavy accounts. Scrape+repost (the classic MoneyPrinter model) is the single most-targeted behavior on Meta.

## 1.3 Money models, ranked (best risk-adjusted ROI for a solo operator)

1. 🥇 **Authorized paid clipping** (Whop Content Rewards & similar). Paid from a creator's *marketing budget*; copyright-safe because the owner authorizes it; fastest cash (week 1–4). Your automation is a genuine throughput edge. **The recommended first money path.**
2. 🥈 **Productized done-for-you (DFY) clipping/shorts service (B2B).** Sell the pipeline's *output* to podcasters / course creators / agencies for recurring fees. Client owns the source → zero RPM dependency. **Most durable line** (requires outreach).
3. 🥉 **Affiliate / brand-deal funnel on an original niche channel.** Content as top-of-funnel, **not** ad-share. How real "faceless" operators actually earn. Needs a real audience first (3–9 months).
4. **Selling the tool/method itself.** Saturated, reputation risk, but honest if genuinely useful.
5. ⛔ **(Worst) Raw Shorts/Reels ad-share from auto-generated content.** Lowest RPM, gated behind the 10M-view wall, and the explicit target of every 2025–2026 enforcement wave. **This is the thing the original plan asked for.**

## 1.4 Blunt year-1 earnings range (solo, self-hosted, worked consistently)

| Strategy | Year-1 outcome |
|---|---|
| **Pure automated ad-share shorts (original plan)** | **$0–$500 total. Most likely $0**, often net-negative after compute + time. The *expected* outcome. |
| **Authorized paid clipping, ground out** | **~$500–$3,000/month** in months 2–6 → roughly **$5K–$25K year 1** if clips perform and pools stay fresh. |
| **DFY service, a few retained clients** | **~$1,000–$5,000/month recurring** by end of year 1 with active outreach. |
| **Blended (campaigns + service)** | **~$5,000–$30,000 year 1.** |

**Failure base rate:** ~3% of automation channels ever reach monetization (industry blog estimate, not audited). For a templated, zero-human-judgment pipeline: **>50% probability over 12 months of demonetization, rejection, or termination** — plus collateral false-positive risk during ban waves.

## 1.5 What this means for the build

- **Do not optimize the architecture for "max videos/day to faceless ad-share channels."** Optimize it for **judgment-per-video + authorized sourcing + a human approval gate** — that's what survives and pays.
- The **clipping** pipeline and the **shorts** pipeline are both worth building — but both must be fed by the **owned/licensed/CC ingest allow-list** (see `04-legal-guardrails.md`).
- The MVP can be **CPU-only** and cost **~$50–$150/month** to run (see `05-build-plan.md`). Cash is not the constraint; **your time and ban-risk are.**

→ Continue to [`02-architecture.md`](02-architecture.md) for *how* it's built, and [`05-build-plan.md`](05-build-plan.md) for *the order* and the decisions you need to make first.
