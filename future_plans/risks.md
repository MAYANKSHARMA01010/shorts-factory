# RISKS — what could kill this, ranked by (likelihood × damage), with mitigations

An honest pre-mortem. Items marked ✅ already have a live mitigation in the system.

## 1. YouTube "inauthentic content" termination — HIGH damage, MEDIUM likelihood
The July-2025 policy targets templated/mass-produced channels; the Jan-2026 wave killed 16 channels
(4.7B views). We post 3/day autonomously — exactly the profile they scan for.
- ✅ **Variation & Authenticity Engine** (6-axis rotation + diversity gate + unique-value layer with cited sources)
- ✅ Hand-coded SVG visuals (the policy explicitly flags slideshows/scrolling-text — we're the opposite)
- **Residual risk:** volume itself. If any strike/warning appears → drop to 1–2/day immediately and appeal
  with the human-authorship evidence (every comp is bespoke TSX code — we can literally show the source).
- **Extra insurance (todo):** keep `variation_ledger.md` + comp source files as an "authorship dossier."

## 2. Google OAuth token death — LOW damage each time, HIGH likelihood if unfixed
If the consent screen is still "Testing," Google expires the refresh token **every 7 days** → uploads
silently fail until manual reconnect.
- **Fix (5 min, owner):** Google Cloud Console → OAuth consent screen → **Publish to Production**.
- ✅ Failure alerts wired (once Gmail is set up) + dashboard shows token state.

## 3. Claude subscription usage cap — MEDIUM damage, MEDIUM likelihood
3 video runs + 1 study run/day + weekly learn run = heavy usage. If the cap hits mid-day, later runs
fail silently.
- ✅ Each run is independent (a failed slot skips; next slot recovers).
- **Watch for:** repeated "nothing posted" days in the digest → reduce to 2/day or upgrade plan.
- **Framing:** subscription cost is the platform's COGS. At current Max-tier pricing the channel needs
  roughly its first ~$100–200/mo revenue just to break even — this belongs in the P&L (see MASTER_PLAN).

## 4. Single-channel dependency — HIGH damage, LOW likelihood short-term
Everything rides on one YouTube channel. A ban/algorithm shift zeros the asset.
- **Mitigation path (Horizon 2):** multi-platform repurposing (TikTok/Reels) + a second channel clone
  — the *factory* is the durable asset, not the channel. See `expansion_ideas.md`.

## 5. Algorithm channel-history bias — already happening (finance gets 67–144 views vs science 400–1,700)
- ✅ Diagnosed correctly by the learning run (retention proves finance quality; reach is the algo, not us).
- ✅ E3 tracks whether consistent posting lifts finance impressions. If not by ~4 weeks → consider a
  **separate finance-only channel** so each channel has a clean niche signal (also better for YPP review).

## 6. Topic exhaustion / quality drift — MEDIUM, gradual
- ✅ CreatorStudy feeds fresh winning formats daily; learning run replenishes `daily_topics.md`.
- **Watch for:** GATE rejections rising or AVP trending down in the weekly digest.

## 7. Windows-box fragility — the whole factory runs on one PC
Reboots, Docker updates, disk full (renders accumulate in `out/`), power cuts.
- ✅ All tasks are `StartWhenAvailable` + WakeToRun; dashboard self-heals; publish path has no Postiz dependency.
- **Todo (cheap):** monthly `out/` cleanup of old renders; keep ledgers + SKILL.md in a git repo or cloud
  backup — the *intelligence* (rules, playbook, learnings) is the irreplaceable part, not the mp4s.

## 8. Monetization-policy edge cases (finance niche)
Finance content triggers stricter ad suitability (get-rich-quick adjacency) and, later, affiliate
disclosure rules (FTC).
- ✅ Brand-safety guardrails baked into every topic ("flag, don't promise", no guarantees).
- **When affiliates start (Horizon 2):** add "affiliate link" disclosure in descriptions — non-negotiable.

## What we deliberately do NOT worry about
- Shorts RPM being low — that's structural; the plan monetizes around it (affiliates, long-form, portfolio).
- Individual video flops — the system is a portfolio machine; the learning loop only needs aggregates.
