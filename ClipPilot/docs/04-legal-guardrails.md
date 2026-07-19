# 04 — Legal Guardrails

**Status:** ✅ written from research · **Date:** 2026-06-22
**Not legal advice** — a risk map to bake into the app. For anything high-stakes (real-person likeness, large spend), confirm with a media/IP lawyer.

> One-line verdict: the **production/editing** layer is largely green; the **clip-other-people's-videos** and **swap-real-faces** layers are red and are the parts most likely to get you terminated or sued. **"100% automated, no review, no filter, monetized" is itself the risk multiplier** — it's the exact fingerprint every 2025–2026 enforcement wave and deepfake law was built to catch.

---

## 4.1 🟢 GREEN — safe to automate (with AI disclosure)

- Editing / captioning / subtitling **your own or properly licensed / CC** footage (FFmpeg, moviepy, VideoCaptioner, ffsubsync, hyperframes/remotion).
- **Fully synthetic or your-own** avatar + voice (Duix-Avatar on yourself or a non-existent person), with AI-disclosure labels applied automatically.
- Music from a **commercially-licensed / royalty-free** library (Epidemic, Artlist, Meta Sound Collection) **embedded pre-upload** — verify the license covers *monetized/ad* use, not just personal.
- **Posting via official APIs** (YouTube Data API; IG **Business**-account Content Publishing API) at human-like cadence.

## 4.2 🟡 YELLOW — only with guardrails (these break "100% automated")

- **AI shorts at scale** — *legal to make*, but demonetized/terminated as "mass-produced" unless each video has **genuine original commentary/value** and substance is **materially varied**. **Mandatory:** auto-apply the **"Altered or synthetic content" disclosure** (YouTube's rule has been live since **March 2024** — older and more entrenched than commonly stated).
- **Real-person avatar/voice** — only with a **signed, scoped consent/release** on file, plus disclosure.
- **EU AI Act Art. 50** deepfake-transparency becomes a **hard legal obligation on Aug 2, 2026** if you have *any* EU viewers (~6 weeks out from this doc's date).
- **Automation mechanics** — official APIs only, throttled, single account. **Never** browser-automation or multi-account farming (TikTok ToS explicitly bans non-approved bots).

## 4.3 🔴 RED — don't (termination / civil / criminal exposure)

- **Fully automated clipping + re-upload of third-party copyrighted video for monetization.** Fair use is an *after-the-fact defense*, not a shield; an auto-cropper-with-captions is the weakest possible posture. **3 DMCA strikes in 90 days = permanent channel termination + all videos deleted + no new channels.** This is the **#1 termination path** in the whole plan.
- **Face-swap / voice-clone of any real, identifiable person without explicit consent** (Deep-Live-Cam on celebrities/politicians/private people): right-of-publicity, **TN ELVIS Act** (Jul 2024), **CA AB 1836 / AB 2602** (in force 2025), ~40+ state deepfake laws, platform bans. **Intimate deepfakes carry federal criminal exposure** under the **TAKE IT DOWN Act** (platform compliance live May 19, 2026). *(NO FAKES Act advanced past Senate Judiciary June 2026 — not yet law, but imminent.)*
- **Deceased-person likeness** for commercial use without estate consent.
- **The MuAPI "no content filters" path with no human review** — verified in the local repo (`Open-Generative-AI-main/.../src/lib/muapi.js` proxies to `api.muapi.ai`; README pitches "no guardrails"). It strips the one automated safety net and routes all liability to you. If used at all, you **must** re-impose your own filter + human gate.
- **Auto-pulling trending / in-app music** for monetized or API posts.

## 4.4 Non-negotiable guardrails to bake into the app

These are **engineering requirements**, enforced in code — not policy you "try to remember":

1. **Ingest allow-list.** `ingest_source` accepts **owned / licensed / CC** sources only. No scraping arbitrary creators. *(Single biggest risk-killer — eliminates ~90% of legal + ban exposure.)*
2. **Mandatory human approval gate** before every `publish_*`. No auto-publish until a template has earned trust, and even then only for low-risk, owned-source content.
3. **Auto-apply AI-disclosure labels** in the publish step (YouTube "altered/synthetic" toggle; Meta AI-Info).
4. **Cleared-music-only enforcement** — the pipeline can **never** attach trending/catalog audio to a monetized/API post.
5. **No real-person likeness without a stored signed release.** Default avatar = synthetic or yourself.
6. **No Deep-Live-Cam, no unfiltered MuAPI**, in any published path.

## 4.5 How the guardrails map to the architecture

| Guardrail | Enforced at | Mechanism |
|---|---|---|
| Ingest allow-list | `ingest_source` MCP tool | Source must carry a `rights` tag (`owned` / `licensed:<ref>` / `cc`); reject otherwise |
| Approval gate | `request_approval` before `publish_*` | Queue state `AWAITING_APPROVAL`; publish blocked without human/owner sign-off |
| AI disclosure | `publish_youtube` / `publish_reels` | Disclosure flag set true by default for any AI-generated/altered asset |
| Cleared music | `compose` / `publish_*` | Music must reference a license entry; embedded pre-upload; trending-audio API path disabled |
| Likeness release | `avatar_present` | Requires a stored `release_id` for any non-synthetic/non-owned face |
| Banned tools | build config | Deep-Live-Cam + unfiltered-MuAPI excluded from the published pipeline entirely |

→ These constraints are scheduled into the build in [`05-build-plan.md`](05-build-plan.md) (the allow-list and approval gate land in **Phase 1**, before any publishing exists).
