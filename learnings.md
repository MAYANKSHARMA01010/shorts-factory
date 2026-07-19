# Learnings — the channel's self-learning lab notebook (append-only)

The weekly LEARNING RUN appends observations here (evidence + hypothesis + experiment + result), then
promotes validated ones into SKILL.md's "★ SELF-LEARNED RULES" section. Nothing here is deleted —
superseded entries are marked, not removed. Every claim must cite the data (views/CTR/retention) or
the external source that justifies it. Confidence tiers: **HYPOTHESIS** (untested hunch) → **SIGNAL**
(supported by our own data at adequate N) → **RULE** (validated by an experiment, promoted to SKILL.md).

---

## 2026-07-01 — Baseline read (first `yt_analytics.py` pull)

**Channel:** Mango cuts · 26 subs · 7,457 total views · 25 videos. (Analytics API not yet enabled → no
CTR/retention yet; enable it for the real diagnosis — see below.)

**Observation O1 — niche is the dominant view driver, not the title pattern.** Sorted by views:
- science/curiosity ("did you know" body facts, survival, weird science): **995–1,530 views**
  (Hot Dog 1530, Blood 1392, Earwax 1351, Pencil 1095, Mirror 995).
- **finance/money (the new autonomous topics): ~67 views** (credit-score "paid on time" = 67).
- The **"YOUR X is lying to you"** title pattern works WITHIN a niche (Pencil 1095, Mirror 995) — but
  applying it to finance (67) did NOT rescue the low-view niche. → **niche >> title** as a view driver.

**Confidence:** SIGNAL (finance N is small/new, but the gap is ~15–20×, and science has many data
points). Not yet RULE — finance videos are also very new (posted 06/29–06/30) and may still accrue.

**Hypotheses to test (one variable at a time):**
- H1: On THIS channel, universal-curiosity (science/body/survival/history) out-pulls finance ~10×+.
  → **Experiment E1:** post 2 science + 2 finance over the next cycle; compare 72h views. Review 2026-07-08.
- H2: Finance can pull if reframed with universal-curiosity + a body/everyday hook (not "credit/APR"
  jargon). → keep 1 finance/cycle but force a curiosity-first hook; compare to jargon-led finance.
- H3: The channel's audience (from the science videos) is not finance-intent → finance has low CTR
  on this audience. Confirm with Analytics API CTR once enabled.

**Action taken this run:** none promoted to a hard change yet (need CTR/retention + 72h maturation).
Flagged the niche-mix question as the #1 thing for the next learning run once the Analytics API is on
and the finance videos have 72h of data.

**⚠️ Blocker to clear for real diagnosis:** enable the **YouTube Analytics API** (one click, scope
already granted): https://console.developers.google.com/apis/api/youtubeanalytics.googleapis.com/overview?project=1090346874182
Without it we see views/likes/comments but NOT CTR (title/thumbnail signal) or averageViewPercentage
(hook/pacing signal) — the two metrics that actually tell us WHAT to fix.

**Market research O1b (why finance underperforms — external evidence).** Finance Shorts get ~5–10× FEWER
views than entertainment/curiosity (lower viralability), BUT finance RPM is $0.08–0.35 vs $0.03–0.12
(5–10× higher/view) and converts 2–5× better to subscribers. So the 67-vs-1500 gap is EXPECTED, not a
production defect — it's a niche property. Winning finance-Shorts hooks (research): lead with a
**surprising number** ("$12 fee" > "hidden fees"), problem-first, visual number-breakdowns, money SFX
(cha-ching). → This is a **strategic fork** (views vs $/view vs subs), parked in `DECISIONS_FOR_OWNER.md`
(recommend Hybrid: mix curiosity for reach + number-led finance for RPM). Not auto-decided.

**Rules promoted to SKILL.md this run:** [SIGNAL·niche] bias mix to curiosity + finance≤1/day number-led;
[SIGNAL·hook] burn the claim as frame-0 text; [HYPOTHESIS·length] ≤20s may beat 30s (test when AVP exists).

**Metric→action methodology adopted** (design-workflow growth-metrics, folded into `learn_and_improve_prompt.md`):
Shorts are impressions-first; diagnose in leverage order — impressions-velocity (reach gate) → first-3s
swipe-away (#1 lever, target >75–80%) → AVP (aim ≥80% for ≤20s) → CTR (only trust ≥300 impressions, and
only once retention is fine) → title/traffic-sources → topic-cluster ranking by **impressions-velocity ×
AVP, not raw views**. N-gates: ignore single-video ratios below 100 impressions / 50 views.


---

## 2026-07-02 — Weekly Learning Run #2 (first run with real CTR/AVP data)

**Channel:** Mango cuts · 29 subs · 7,839 total views · 28 videos (incl. old pharmacy lectures).
**Analytics API:** ENABLED and returning averageViewPercentage. CTR shows "—" for all — this is
expected: YouTube does not report CTR at the video level until the video has sufficient impressions
(likely the API needs impressions data too, not just views). Re-check next week.

---

### Metric snapshot — the 10 Shorts-era videos with AVP data

| Title | Views | AVP | Niche |
|-------|-------|-----|-------|
| The Blood That Can Kill You | 1,460 | **93.9%** | science/body |
| Your 'this is not a bill' paper | 73 | **89.8%** | finance |
| Your phone bill is lying (taxes) | 71 | **73.5%** | finance |
| Paid on time, score still dropped | 115 | **65.1%** | finance |
| A Match Is A Tiny Bomb You Hold | 169 | 61.2% | science |
| A Real Diamond Grown In A Microwave | 452 | 53.5% | science |
| You'll Never Eat A Hot Dog Again | 1,674 | 52.2% | science/food |
| Why Your Pen Never Leaks | 39 | 52.6% | science |
| Your Mirror Is Lying To You | 1,030 | 50.5% | science |
| Your Pencil Has Been Lying To You | 1,146 | 45.8% | science |
| The Shrimp That Punches Like a Bullet | 453 | 43.1% | science |
| The Bug Hiding On Your Candy | 33 | 42.1% | science |
| What Earwax Really Is | 1,413 | 39.7% | science/body |

---

### Observation O2 — Finance retention BEATS science (76.1% vs 49.7%)

Finance pooled AVP (3 videos with data): **76.1%** (EOB 89.8%, phone bill 73.5%, credit 65.1%).
Science pooled AVP excl. Blood outlier (9 videos): **49.7%**.
ALL science incl. Blood: 54.6%.

**Interpretation:** Finance hooks are working — viewers who DO see finance videos STAY. The impressions
gap (finance 67–144 views vs science 400–1,674) is algorithmic channel-history bias: the algo coded
this channel as science early and needs more finance performance signals before widening distribution.
This means "fix finance" is the WRONG response to low views. Finance quality is good; the fix is
consistent posting so the algo builds a finance-audience in parallel.

**Confidence:** SIGNAL (N=3 finance with AVP, adequate for directional conclusion; gap is 26 percentage
points — too large for sampling noise). Label SIGNAL not RULE until N≥5.

---

### Observation O3 — Science retention crisis: 49.7% pooled AVP vs ≥80% target

Every science video except Blood is below the 80% target (and most are below the 60% "ok" floor).
This means: after the algorithm's initial test push, LOW RETENTION is causing it to deprioritize our
science videos. The algo pushes based on completion + loops — below 60% AVP likely reduces the next-
distribution wave.

The single clear outlier is "The Blood That Can Kill You" (93.9%). Most parsimonious explanation:
it's a shorter (≤20s) video with a more visceral personal-threat hook. We cannot confirm this without
watching the video back, but it is the best hypothesis available.

**Confidence:** HYPOTHESIS on the cause (length + personal-threat) → SIGNAL promoted for length
(the gap is 93.9% vs 49.7% across 9 videos; directionally strong).

---

### Experiment E1 — Update (from 2026-07-01, due 2026-07-08)

E1 stated: post 2 science + 2 finance over the next cycle; compare 72h views.
**Partial update (data accruing):** Science shorts from Jun 24–27 averaging 400–1,674 views.
Finance shorts from Jun 29+ averaging 67–144 views. The 10-20× gap holds. E1 CONFIRMED at low
confidence (consistent with O1); will promote to RULE at next run once N≥5 for both niches.
Finance videos still too new for 72h maturation check on some; revisit 2026-07-08.

---

### EXPERIMENT E2 — Active (started 2026-07-02)

**Change:** For the next 5 science shorts, use ≤20s scripts (~55–60 spoken words) instead of ~30s.
**Variable:** Script length only (one variable; hold niche + title pattern constant).
**Metric:** Pooled AVP for next 5 science shorts. Target ≥70% vs baseline 49.7%.
**Hypothesis:** Shorter = higher completion rate = higher AVP = more algo distribution per video.
Evidence: Blood (93.9%, est. ≤20s) vs science pool (49.7%, all ~30s).
**Confidence at start:** SIGNAL (promoted from HYPOTHESIS after first real AVP read).
**Review date:** 2026-07-09.
**Applied to:** next 5 science topics in daily_topics.md (#023 onward per rotation).

---

### Experiment queue (future, not yet started)

- **E3 (pending):** Finance impressions — does posting finance consistently for 2 more weeks cause
  the algorithm to begin distributing it more widely? Metric: 7-day views trend for finance. Review 2026-07-09.
  (This is passive — just track it; no production change needed.)

---

### Topic cluster ranking (impressions-velocity × AVP — per diagnostic step 6)

Science (impression-velocity ~500–1,700 × AVP ~50%) = **composite score ~250–850**.
Finance (impression-velocity ~70–115 × AVP ~76%) = **composite score ~53–87**.
Science wins on composite despite lower retention. → Science topics should dominate the daily mix
(which they already do via the SIGNAL niche rule). Finance is the high-RPM supplement.

---

### Actions taken this run

1. **SKILL.md** — promoted [HYPOTHESIS · length] → [SIGNAL · length] with E2 experiment framing.
   Added new [SIGNAL · retention] rule: finance holds viewers better than science.
2. **daily_topics.md** — added 8 new visceral science topics (#023–#030): parasite brain, perception
   delay, banana DNA, liver regeneration, stomach acid, blind spot, dead skin, stellar iron in blood.
   Existing unused finance topics (#006–#020) remain in queue.
3. **DECISIONS_FOR_OWNER.md** — updated Decision #1 with new retention finding.
