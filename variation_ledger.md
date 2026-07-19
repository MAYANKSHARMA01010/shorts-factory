# Variation ledger — per-video attributes (the DIVERSITY GATE reads this; the producer appends 1 row/video)

Before rendering, the producer picks title-shape / format / skin / voice / length / pace / cluster / hook so
the new video differs from the **last 6 rows** on **≥3 of these axes** (never repeat title-shape within 6,
format within 5, skin within 4, voice within 4, or topic-cluster back-to-back). Then it appends its row here.

Axes: **title** (title_shapes id) · **fmt** (formats id) · **skin** (visual_skins id) · **voice** (voices id) ·
**len** (L1–L4) · **pace** · **cluster** (credit/debt/savings/insurance/telecom/tax/retirement/science/…) ·
**hook** (question/whatif/claim/story/number/mythbust).

| Date | Slug | title | fmt | skin | voice | len | pace | cluster | hook |
|---|---|---|---|---|---|---|---|---|---|
| 2026-06-29 | daily001_creditscore | T01 | F1 | S1 | V1 | L3 | -4% | credit | question |
| 2026-06-29 | daily002_eob | T01 | F1 | S1 | V1 | L3 | -4% | insurance | whatif |
| 2026-06-29 | daily003_phonebill | T01 | F1 | S1 | V1 | L3 | -4% | telecom | question |
| 2026-06-30 | daily004_debttrap | T01 | F1 | S1 | V1 | L3 | -4% | debt | claim |
| 2026-07-01 | daily005_savings | T01 | F1 | S1 | V1 | L3 | -4% | savings | claim |
<!-- ^ note the sameness (all T01/F1/S1/V1) — exactly what the Variation Engine now prevents -->
| 2026-07-01 | daily006_tonguemap | T05 | F2 | S3 | V6 | L2 | 0% | body | mythbust |
| 2026-07-02 | daily007_babymemory | T04 | F8 | S2 | V7 | L3 | +4% | psychology | question |
