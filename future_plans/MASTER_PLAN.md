# MASTER PLAN — from autonomous video factory to a money-making platform

*Written 2026-07-02, grounded in a 4-stream research pass (sources in each file). Companion files:
`PLATFORM_MAP.md` (what exists) · `revenue_streams.md` (every stream, ranked) · `expansion_ideas.md`
(growth vectors) · `risks.md` (pre-mortem).*

## The one-paragraph strategy

Shorts ad revenue is structurally tiny ($100–350 per **million** finance views) — so the channel is not
the business; it's the **audience-acquisition engine**. The business is the ladder it feeds: fan-funding
tier at 500 subs → affiliates + newsletter (a finance email subscriber is worth **$30–100/year** vs
~$0.0003/view — a ~100,000× per-person value gap) → finance **long-form** ($10–25 RPM, 100× Shorts) →
sponsorships ($50–800/video at 10k subs, finance CPM $40–80) → a **portfolio of cloned channels** (our
marginal production cost is ~$0 vs the $500–2,000/mo competitors pay) → optional **exit** at 18–24×
monthly profit (real Flippa multiples; one faceless channel sold for $300k, and its automation codebase
alone appraised at $50k — our stack is a saleable asset independent of any channel).

## Where we are (honest baseline, 2026-07-02)

- 29 subs · 7,839 views · 28 videos · **not monetized**
- Run-rate ~300–500k views/90d → full YPP Shorts bar (10M/90d) needs ~25× growth or a breakout
- Industry data: faceless channels hit traction around **video 30–40** — we're at 28. The inflection
  window is *now*, and the machine is already posting 3/day with compounding quality loops.
- Finance retention 76% AVP (quality proven); science reach 400–1,700/video (algo trust proven).
  E2 (≤20s science) and E3 (finance impressions) are running.

## The milestone ladder (what unlocks what)

| Milestone | Threshold | What it unlocks | Realistic ETA |
|---|---|---|---|
| **M1: Fan-funding tier** | **500 subs** + 3 uploads/90d + (3M Shorts views/90d OR 3k watch hrs) | Memberships, Super Thanks, **YouTube Shopping affiliate stickers ON Shorts** (500-sub threshold since Mar 2026) | 2–4 months |
| **M2: Full YPP** | 1,000 subs + (10M Shorts views/90d OR **4,000 long-form watch hrs/12mo**) | Shorts ad share (45% of pooled allocation) + long-form ads | 6–12 months (industry norm) |
| **M3: Sponsor-ready** | ~10k subs | $50–800/video finance integrations — likely beats ad revenue | 8–14 months |
| **M4: Portfolio** | Channel #1 at YPP | Clone factory → channel #2 (pure finance) at ~$0 marginal cost | month 8–12 |
| **M5: Exit option** | ~$3k/mo profit | $54–72k channel sale at 18–24× (plus the codebase as a separate asset) | optional, month 12+ |

**Key insight:** M2 has two doors. The Shorts door (10M views/90d) needs virality; the **long-form door
(4,000 watch hours)** is buildable deliberately — 8–10 min finance explainers using our existing house
components ALSO earn $10–25 RPM immediately once monetized *and* count toward the hours. Long-form is
both the hedge and the prize. See `expansion_ideas.md` §2.

## Horizon 0 — THIS WEEK (unlocks + infrastructure, ~2 hrs of owner time)

1. **Publish the Google OAuth app to Production** (5 min) — kills the 7-day token expiry risk.
2. **Set the Gmail app password** (`python notify_email.py --set-password "…"`) — digests + failure alerts go live.
3. **Decide the niche question** in `DECISIONS_FOR_OWNER.md` — recommendation stands: **C (Hybrid)**,
   science for reach + ≤1 number-led finance/day, revisit after E2/E3 land (~07-09).
4. **Apply to affiliate networks** (free, no traffic minimums): Impact.com, FlexOffers, Fintel Connect →
   Credit Karma (~$6/signup), Rocket Money ($4–10), Acorns, Robinhood ($5–20/funded). Skip credit-card
   programs (closed to small creators). *(Owner: ~30 min of signups.)*
5. **Stand up the link hub** — one page listing "tools I mention" (Vercel/Beehiiv page), then put it in
   the channel's bio links. Nothing inside a Short is clickable, so the funnel is: verbal CTA → channel
   page → bio link. Add FTC disclosure ("some links are paid") to the description template.
6. **Start the newsletter shell** (Beehiiv free tier) + a $0 lead magnet (budget-tracker template) —
   see `revenue_streams.md` §2 for why this is the highest-value-per-person asset we can build.

## Horizon 1 — months 0–3: "Get to 500" (M1)

**Goal:** 500 subs + 3M Shorts views/90d. Views math: needs ~33k/day; current best videos do 1,700 —
so this leans on (a) E2 fixing science retention → wider algo distribution, (b) posting consistency,
(c) multi-platform reach compounding subs.
- Keep 3/day on YouTube; let the learning loops run (E2 review 07-09; promote/kill rules weekly).
- **Add Instagram + Facebook same-day repurposing via Postiz** (config only, zero new content cost).
  IG = audience growth; FB starts the 600k-watch-minutes clock for its monetization program.
- **Start TikTok** — the best small-creator economics in 2026 ($0.40–1.00 RPM on US finance/education).
  CRITICAL: TikTok only pays on **>60s** videos → produce a 60–90s "extended cut" per topic (the house
  pipeline can render a longer variant of the same comp). AI-VO on original scripts is explicitly OK
  there (disclose with the AI toggle). Thresholds: 10k followers + 100k views/30d — our 90 videos/mo
  can clear the views bar; followers are the bottleneck, so start the clock now.
- In-video CTAs: end-frames rotate between "watch again" (loop metric), "screenshot this" (save), and
  a subscribe-framed payoff — subs are the M1 binding constraint.
- **KPIs (weekly, via the digest):** subs (target +40–60/wk by month 2), pooled AVP ≥70% (E2), finance
  impressions trend (E3), views/90d run-rate.

## Horizon 2 — months 3–6: "Two doors to full YPP" (M2)

- **Pilot long-form:** 2×/week, 8–10 min finance explainers ("How credit scores ACTUALLY work — the
  full story") assembled from house components; each is also a source for 3–4 Shorts. Builds the
  4,000-hour door + is where affiliates convert ($6.40/1k long-form finance views vs ~$0.10–0.90/1k
  Shorts) + clickable description/pinned links exist there.
- Newsletter CTA moves into every finance video (QR in the Remotion outro comp + bio link). Target:
  first 500 email subs (worth $15–50k/yr/1k subs at maturity — compounding asset, algorithm-proof).
- If TikTok crossed its thresholds → first external revenue ($80–500/mo potential at our volume).
- **Decision gate at month 4:** if finance impressions still choked on YouTube (E3 negative), split
  channel #2 (pure finance) early instead of waiting for M4 — clean niche signal for the algo.

## Horizon 3 — months 6–12: "Portfolio + compounding" (M4–M5)

- Full YPP on channel #1 → Shorts ads flow (modest) + long-form ads (real: finance long-form at even
  100k views/mo ≈ $1,000–2,500/mo at $10–25 RPM).
- **Clone the factory:** channel #2 = pure finance (highest RPM), maybe channel #3 = pure science
  (highest reach). Each clone costs ~config + new channel OAuth; competitors pay $500–2k/mo for what
  our stack does at ~$0 marginal. This is the structural moat.
- Sponsorships at 10k+ subs ($50–800/video; finance CPM $40–80) — one integration/week beats ads.
- Digital products: $10–19 budget templates via Gumroad (10% fee) sold to the newsletter.
- **Exit optionality:** keep clean monthly P&L records from month 6 — buyers pay 18–24× documented
  monthly profit; undocumented channels discount heavily. The codebase itself is separately saleable.

## The P&L frame (be honest about COGS)

- **Cost:** the Claude subscription running the factory (~$100–200/mo) + electricity ≈ the entire cost
  base. Everything else (Remotion, edge-tts, Postiz, YouTube APIs) is free.
- **Break-even:** roughly the first $150–250/mo of revenue — realistically month 4–8 via TikTok +
  early affiliates + fan-funding, before full YPP even lands.
- **The asymmetry:** costs are flat; every revenue stream compounds. A 12-month loss window is the
  industry norm for faceless channels ($26k spent in one documented case) — ours is ~$1.5–2.5k total,
  which is the whole thesis: **we automated away the cost side of a proven business model.**

## Weekly review (wire into the machine)

The weekly **ShortsLearn** run should check this plan's KPIs (subs delta, views/90d run-rate, AVP,
platform thresholds) and append a one-line horizon status to `learnings.md`. When a milestone is hit,
it flags the unlocked action in `DECISIONS_FOR_OWNER.md`. The plan is a living file — the learning
loop keeps it honest.
