---
name: ultimate-short
description: The ONE end-to-end skill for a <=20s (or ~30s explainer) vertical short — GENERATE the transcript (viral hook, high-CPM optional), VALIDATE it before producing, prepare a shot-by-shot PLAN, act as DIRECTOR, RENDER (bespoke code-drawn Remotion SVG explainer = default house style; Z-Image stills / HyperFrames / Three.js / Chatterbox VO / dynamic karaoke captions), then FINISH with the punchy-recut pacing + scene-matched SFX pass and optional gameplay split-screen stack. Absorbs the old punchy-recut skill — plus a /loop "refine until perfect" mode that self-paces with min-3/max-10 rubric-gated iterations across every process (hook, script, validation, visuals, sound, captions, pacing) until each clears an objective quality bar. Use for "make the ultimate short", "write a viral 10s script", "/loop refine until perfect", "build/animate a short from this script", faster pacing / fast cuts / add SFX / sound design, or a gameplay "brainrot" stack.
---

This is the **single master skill** for short-form video on this box: transcript →
finished **1080x1920** vertical short. It **generates the transcript** (the script),
**validates it before producing**, **prepares the plan** (one `brief.json`), **acts as a
director**, **renders** (default = a bespoke code-drawn Remotion SVG explainer; plus Z-Image /
HyperFrames / Three.js / avatar layers), and **finishes** with the pacing + scene-matched-SFX
recut and optional gameplay stack. **It absorbs the former `punchy-recut` skill** — all of that
pacing/SFX/gameplay knowledge now lives here.

```
.claude/skills/ultimate-short/        <- THE skill
  SKILL.md            <- this file (director + validate + render + finish playbook)
  director_brief.py   <- schema, validate_brief(), timeline, SFX cue map, styled-ASS captions
  pipeline.py         <- orchestrator (brief.json -> finished short; --recut, --gameplay-dir)
  renderers/          <- HyperFrames / Remotion(R3F) / avatar / micro-video beat renderers
  briefs/  output/
.claude/skills/punchy-recut/          <- FINISHING SCRIPTS (kept here for path-compat; docs now in THIS file)
  recut.py            <- pacing speed-up + fast cuts + scene-matched SFX bed
  stack_gameplay.py   <- split-screen gameplay "brainrot" stack
```
Shared heavy resources (the `chatterbox-env`/`imggen-env` venvs, `zimage_gen.py`, the 567-file
`assets/sound_effects/` library, the `ClipPilot/remotion_explainer/` project) are referenced by
path, never duplicated. The recut/stack scripts stay under `.claude/skills/punchy-recut/` so the
many existing `…/punchy-recut/recut.py` path calls (incl. the reimagined-shorts build pipeline)
keep working; their canonical docs are now the "FINISHING LAYER" section below.

## Hard rules (non-negotiable)

1. **<=20 seconds for the ultimate-short pipeline** (Z-Image/HyperFrames path), enforced 3×:
   director targets ~17s; `cap_narration()` atempo-ramps if >~19s; orchestrator asserts <=20.0s.
   (The bespoke Remotion explainers are the ~30s long-form house format — different slot, same
   style rules below.)
2. **One GPU model at a time** on 6GB VRAM. Chatterbox, Z-Image, Wav2Lip, wan2gp each load in
   their own venv subprocess and fully **exit** before the next. CPU/Chromium tools (ffmpeg,
   Remotion, HyperFrames, Manim) run after the GPU stages.
3. **Every video gets the full creative treatment** — planned hook, palette, dynamic colorful
   captions, scene-matched SFX, and (when enabled) animation/3D/avatar. Never a bare slideshow.
4. **Audio is Chatterbox-only** for the ultimate-short pipeline — the *sole* audio-generation app;
   no audio diffusion, no music generation, **no default edge-tts** (`--allow-edge` is an explicit
   emergency override). Sound design uses the pre-cleared `assets/sound_effects/` library (licensed
   *assets*, not a generative app). (The reimagined-Remotion build pipeline uses edge-tts by its own
   documented exception — see [[reimagined-shorts-pipeline]].)
5. **The hook MUST open with a question, a hook, or a "what if"** (owner rule). Never a flat
   statement or slow wind-up — `b0` / `brief.hook` is interrogative, a pattern-interrupt, or a
   "What if…". The first 1–2s decide scroll-stop. See [[shorts-hook-and-validate]].
6. **Validate BEFORE you render** (owner rule). No video is produced until its transcript clears
   the validation **GATE** (real competitive view-count proof + saturation check + simulated
   swipe-test) — run the GATE right after generating the transcript, before planning. Produce-then-hope is banned.
7. **Bespoke code-drawn visuals every time — but ROTATE THE SKIN** (owner rule + YouTube anti-repetition).
   Every video is hand-coded Remotion SVG (NEVER stock/slideshow — that IS the anti-template edge), but the
   specific look (palette / hero family / motion / captions) **rotates across `variation/visual_skins.md`**
   (6 skins; S1 = the original gold/dial "House Animation Style" below). The house-QUALITY bar is mandatory;
   visual SAMENESS across videos is banned (see the VARIATION & AUTHENTICITY ENGINE section + [[shorts-self-learning]]).

## ★ SELF-LEARNED RULES (auto-maintained by the weekly LEARNING RUN — only it edits between the markers)

Evidence-based rules the **LEARNING RUN** (see the "SELF-LEARNING SYSTEM" section near the end) promotes
from `learnings.md` after reading YouTube analytics + competitor research. **The hard rules above always
override these.** Confidence tiers: **RULE** (validated by an experiment — the producer MUST apply) ·
**SIGNAL** (supported by our own data at adequate N — apply as an active experiment) · **HYPOTHESIS**
(a candidate to test). Each item cites its evidence + a review date. The learning run may edit ONLY
between the two markers below and must back up SKILL.md first; never hand-edit inside the markers.

<!-- LEARNED-RULES-START -->
- **[SIGNAL · niche] Universal-curiosity beats finance on THIS channel (~10–20×).** Science/body/
  survival/history videos pull 1,000–1,500 views; the first finance video pulled ~67 (baseline
  2026-07-01, `learnings.md` O1). The "YOUR X is lying to you" title pattern helps *within* a niche
  (Pencil 1095, Mirror 995) but did NOT rescue finance. → Bias the daily topic mix toward
  universal-curiosity, high-retention topics; keep finance ≤1/day and only with a curiosity-first,
  jargon-free hook. **This is a strategic fork — surface it to the owner; do not silently abandon the
  high-CPM money goal.** Review 2026-07-08 once 72h data + CTR/retention exist. (see DECISIONS_FOR_OWNER.md)
- **[SIGNAL · hook] Burn the "YOUR X is lying to you" claim as on-screen text on frame 0.** Shorts
  live/die on first-3s retention; a static wind-up or logo loses viewers before the narration lands.
  → Every short opens with the hook claim as a bold burned-in caption on frame 0 (with/just before the
  narration), no intro/title-card, opening on motion or a big number. The first rendered frame doubles
  as the cover. (design-workflow growth-metrics; established Shorts practice; owner hook-first rule.)
- **[SIGNAL · length] ≤20s beats ~30s on retention — EXPERIMENT E2 active (review 2026-07-09).**
  Analytics API first real read (2026-07-02): "The Blood That Can Kill You" at 93.9% AVP (estimated
  ≤20s) vs pooled science AVP of 49.7% across 9 ~30s videos (Earwax 39.7%, Pencil 45.8%, Mirror 50.5%,
  Bug 42.1%, Shrimp 43.1%, Diamond 53.5%, Hot Dog 52.2%, Pen 52.6%, Match 61.2%). The ~30s pool is
  well below the ≥80% target for short content. HYPOTHESIS promoted to SIGNAL. → EXPERIMENT E2: For
  the next 5 science shorts, use ≤20s scripts (~55–60 spoken words). Metric: pooled AVP target ≥70%
  vs 49.7% baseline. If confirmed at N≥5, cap science at ≤20s permanently. Review 2026-07-09.
- **[PATTERN · pacing/retention] Change the visual on EVERY narration phrase (~1 transform / ~2s),
  literally depict the words, and highlight the phrase's key noun/number in gold.** FOUR biggest
  Shorts winners (Gohar Khan 19.5M finance, Mark Tilbury 10M finance, Zack D. Films 128M science,
  Terra Mystica 63M science) ALL cut/change the visual on every phrase and act out each spoken claim —
  never a static beat, keyword highlighted each line. Our 6-scenes-over-30s (~5s/scene) lingers → retention
  leak (some of our videos hold only 39–52% AVP). → In the house explainer, sub-animate/transform the hero
  on EVERY phrase (new prop/number/state per clause); captions change per phrase with the key word in gold
  `#FFD23F`. Verify with AVP; review 2026-07-15. (competitor_playbook.md §3–4,§7)
- **[PATTERN · frame 0 / cover] COLD-OPEN on the mystery itself — no title card, no logo, no wind-up.**
  Five winners (Zack D. 128M open extreme close-up of the trick happening; Terra Mystica 63M open on the
  girl already "compressed"; AdviceWithErin 12.9M open mid-conversation "I quit"; Gohar 19.5M open on
  hand fanning the cards; Mark 10M open with wall-of-trophies + POV card extend) — all land IN the story
  by t=0. Our habit of a "gold badge over static hero" can read as a subtle title-card that costs the
  swipe. → Scene 1 must be the mystery ITSELF (an extreme close-up of the object, or mid-motion in the
  story) with the hook claim burned in as caption — the gold badge, if used, must sit ON the mystery
  visual, not above a still hero. Review 2026-07-15. (competitor_playbook.md §1–2)
- **[PATTERN · end-CTA] End-CTA is an ALGORITHM ACTION matched to the video shape, not a generic
  subscribe.** Zack D. 128M: *"watch it again and see if you can notice"* (LOOP — hidden-reveal videos).
  Gohar 19.5M: *"screenshot this"* (SAVE — recap/listicle videos). AdviceWithErin 12.9M: *"Follow for
  more ✨"* on a soft POV smile (FOLLOW — series-hook videos). Terra Mystica 63M: payoff frame IS the
  CTA (no explicit ask — hard-payoff videos). → Producer picks the CTA per video-shape: hidden-mechanism
  reveal → *"watch it again"*; recap/listicle → *"screenshot this"*; series-hook → *"follow for
  more"*; hard payoff → payoff frame only, no generic subscribe. Review 2026-07-15. (competitor_playbook.md §8)
- **[SIGNAL · retention] Finance retains viewers 54% better than science (76.1% vs 49.7% avg AVP).**
  First Analytics API read (2026-07-02, N=3 finance with data): EOB paper 89.8%, phone bill 73.5%,
  credit score 65.1% — vs science pool 49.7% (excl. Blood outlier). The impressions gap (finance
  67–144 views vs science 400–1,500) is algorithmic channel history (the algo coded this channel as
  science early), NOT a production/hook quality problem. Finance hooks ARE working — the viewers who
  see the videos stay. → Do NOT change finance hooks/scripts based on low views. Post consistently;
  the algo will build a finance audience in parallel. Review 2026-07-09.
<!-- LEARNED-RULES-END -->

## ★ HOUSE ANIMATION STYLE — use every time (owner rule, hard rule 7)

The default, signature look for every short is the **bespoke code-drawn Remotion motion-graphics
explainer** proven across 30 published videos (R001–R030). NO stock photos/video ever — every
visual is hand-coded SVG, springs, gradients, masks. Project: `ClipPilot/remotion_explainer/`.

**Canvas & timing**
- 1080×1920, 30fps, Remotion/TSX. ~30–34s explainer (or <=20s via the ultimate-short pipeline).
- **6 scenes**, each mapped to one narration sentence boundary. Get boundaries from
  faster-whisper word timings: `python make_narration.py --txt <transcript> --slug <slug>` →
  `<slug>_narration.mp3` + `<slug>_words.json` (prints sentence-end frames @30fps).
- `const S = { hook:0, sceneB:<frame>, … }`; `DURATION_IN_FRAMES = lastWord + ~10`.

**Structure (always)**
- **Scene 1 = HOOK:** one bold central code-drawn hero object + a **gold `#FFD23F` badge** (a "?",
  "!", or short label pill) posing the mystery. Opener obeys hard rule 5 (question/hook/what-if).
- **Exactly ONE HERO REVEAL scene** — the richest, most-detailed "money shot" of the mechanism;
  visually louder than every other scene.
- **Final scene = PAYOFF:** the punchline slams in **word-by-word** with spring overshoot (<=6 words).

**Motion vocabulary (the signature)**
- `SceneWrap` on every scene: 8-frame fade-in + a `1.06→1.0` scale-settle.
- Spring entrances: `spring({ frame: frame - delay, fps, config: { damping, mass: 0.5–0.6, stiffness: 180–220 } })` —
  `damping ~45–60` for snappy pops, `~110–120` for soft settles. Counters roll up; paths draw-on via
  `pathLength={100} strokeDasharray={100} strokeDashoffset={100*(1-p)}`; elements sweep/wipe/fill.
- **Calm-but-fast pacing:** energy comes from fast in-composition animation, NOT a recut zoom-pulse
  (owner dislikes constant zoom + whoosh-on-every-cut).
- Reusable helpers: `mix()` color-lerp, `spiralPath`, `sinePath`/`wavePath`, etc.

**Captions (always, at ROOT)**
- 3-word karaoke pages; active word **gold `#FFD23F`**, `scale 1.13`; inactive white; Poppins/Arial
  Black 900; bottom ~168px; `textShadow 0 3px 16px rgba(0,0,0,.9)`.
- **`<Captions/>` MUST live at the ROOT** (after all scene `<Sequence>`s), never inside a Sequence
  (`useCurrentFrame()` rebases inside a Sequence → wrong words). Exactly one `<Captions/>` per comp.

**Audio (always, at ROOT)** — right after the root `<AbsoluteFill>`:
`<Audio src={staticFile('<slug>_narration.mp3')} />` + `<Audio src={staticFile('music.mp3')} volume={0.12} />`.
Bake topic-matched HERO SFX at exact frames via `<Sequence from={F}><Audio src={staticFile('sfx_<n>.wav')} volume={...}/></Sequence>`.

**Palette** — dark cinematic bg radial gradient, EXACTLY one gold accent `#FFD23F`, one key color, 3–5 topic colors.

**Gotchas (each cost a re-render):** missing root `<Audio>` → silent narration (verify mean ≈ −17 dB);
`<Captions>` inside a Sequence → wrong words; SVG transforms are `scale(x y)` NOT CSS `scaleX/scaleY`;
when a comp is named after its subject, rename the inner helper (e.g. `Axolotl`→`Axo`) to avoid an
export name-clash; `interpolate` input ranges must be monotonically increasing.

**Build → finish:** register in `Root.tsx` → `npx remotion render src/index.ts <Comp> out/<slug>.mp4`
→ QA contact sheet → the FINISHING LAYER recut → loudnorm `-14 LUFS` → **WATCH-BACK QA (review the
finished mp4 with the `/watch` skill, fix retention leaks, re-render until clean)** → publish. Full flow
in [[reimagined-shorts-pipeline]]; gotchas in [[clippilot-shorts-gotchas]].

## ★ VARIATION & AUTHENTICITY ENGINE (avoid YouTube's "inauthentic content" termination)

YouTube **terminates channels** for templated/mass-produced sameness (July-2025 inauthentic-content policy;
Jan-2026 enforcement wave removed 16 channels / 4.7B views). We post 3/day autonomously, so EVERY video must
VARY across videos AND carry unique human value. The producer runs **STEP 0 — PICK YOUR VARIATION** before
building (see `daily_shorts_prompt.md`):
- **Rotate 6 axes**, each from a library, none repeating recently: **title-shape** (`variation/title_shapes.md`
  ~25, not within 6) · **format** (`variation/formats.md` 8, not within 5) · **visual-skin**
  (`variation/visual_skins.md` 6 distinct looks, not within 4) · **voice + length + pace** (`variation/voices.md`
  8 voices, not within 4) · **topic-cluster** (not back-to-back) · **hook-type** (varied).
- **★ DIVERSITY GATE:** the new video must differ from EACH of the last 6 (`variation_ledger.md`) on **≥3
  axes**, else re-pick. The producer appends its attribute row to `variation_ledger.md`.
- **★ UNIQUE-VALUE layer (authenticity):** every script must add an original take + a "what most people miss"
  insight + **≥1 specific real number/example** + a **cited source** — this is what makes it "genuinely
  human-created," not templated.
- Our bespoke hand-coded visuals HELP here (the policy specifically flags generic slideshows / scrolling text
  — the opposite of us); the risk is cross-video sameness, which this engine + skin rotation kill. All
  SELF-LEARNED RULES + the competitor playbook apply ON TOP of the chosen skin/format. Files: `variation/`.

## Tool roster — best tool that runs on this box (RTX 2060, 6GB)

| Creative role | Tool | Notes |
|---|---|---|
| Director / brief | LLM (you) -> `brief.json` | the only creative decision point |
| **Default animation** | **bespoke Remotion SVG explainer** | the house style above — use every time |
| Narration (ultimate-short) | `chatterbox_engine.py` | Chatterbox only |
| Narration (reimagined build) | edge-tts (documented exception) | en-US-AndrewMultilingualNeural -4% |
| Stills | `zimage_gen.py` (`imggen-env`) | 4-bit/fp16 Z-Image |
| Animation engines | HyperFrames / Remotion | headless HTML/CSS->MP4 beats |
| 3D structures | Remotion+R3F / Three.js | real geometry; Manim fallback |
| Avatar | living-portrait (Z-Image face + ffmpeg head-bob) | headless, 6GB-safe |
| Captions | `write_styled_ass()` / Remotion `<Captions>` | colorful, animated, voice-synced |
| SFX / non-voice | `assets/sound_effects/` via cue map | licensed assets; per-beat bed + recut impacts |
| Fast-cut / pacing / SFX | `punchy-recut/recut.py` | the FINISHING LAYER (below) |
| Gameplay split-screen | `punchy-recut/stack_gameplay.py` | optional final stage |
| Trim / compose | ffmpeg | |

## Pipeline order (end-to-end)

**STEP 1 generate the transcript → GATE validate → STEP 2 prepare the plan (brief) → STEP 3 render
→ FINISHING LAYER → STEP 4 WATCH-BACK QA → STEP 5 PUBLISH & SCHEDULE.** Write the script, prove it
before spending a render, plan it shot-by-shot, render in the house animation style, finish (pacing +
SFX + optional gameplay), **watch the finished video back like a viewer and fix every retention leak**
(the WATCH-BACK QA section below — non-optional; it caught the dead-air / weak-hook / spoiled-reveal
bugs on the credit-score short), then **auto-post or schedule it to the connected channel via Postiz**
(STEP 5) — but only when the command asks for it, and only after the video is clean.

## STEP 1 — Generate the transcript (the script)

If a script isn't supplied, **generate one first** — the spoken transcript, in the house format.
- **Topic:** for revenue pick a HIGH-CPM niche (finance/credit/insurance/legal/AI-tools); for reach
  a broad universal topic; best = the intersection (the map→generate→judge→verify method + full
  audit trail live in `viral_10s_transcript.md` at repo root).
- **Structure:** opens with a question / hook / "what if" (hard rule 5); a curiosity-gap setup; a
  do-it-now / test-it participation moment where possible; ONE hero reveal; a word-by-word payoff /
  loss-aversion button (<=6 words). Must be TRUE + brand-safe (no scam / guarantee / medical-cure).
- **Title / hook framing — owner's #1 virality driver, proven on their OWN channel (beats timing &
  frequency):** use the **deception/revelation + PERSONAL-stakes** pattern. Winners: "Your mirror is
  lying to you", "Your pencil has been lying to you", "You'll never eat a hot dog again". So:
  `Your <familiar thing> is lying to you` · `You've been doing <thing> wrong` · `You'll never <do
  familiar thing> the same way again` · or a personal-threat reveal. Put **`YOUR`/`YOU` in the first
  ~3 words**, and make the spoken hook PAY OFF the accusation within the first 2s. Impersonal-trivia
  titles ("This beetle fires a boiling gun", "Why this fish can stop your heart") FLOP — true but no
  personal stake, so viewers swipe. Stays TRUE + brand-safe (metaphorical "lying" is fine; no false
  claims). See [[viral-title-pattern]].
- **Length:** ~24–30 words + a `(beat)` for a true 10s; ~6 sentences / ~68+ words for the ~30s
  explainer (one sentence → one scene, so it maps cleanly to the 6-scene house structure).
- **Save** to `reimagined_transcripts/<NNN>_<slug>.txt` (or a slug file), then
  `python make_narration.py --txt <file> --slug <slug>` for word timings. For maximum virality /
  many candidates, fan out with the **Workflow** tool (ideate → judge on virality×CPM×brand-safety →
  adversarially verify → synthesize) as captured in `viral_10s_transcript.md`.
- **→ When the transcript is READY, run the GATE next — never skip straight to planning.**

## STEP 2 — Prepare the plan (be the director): write `briefs/<slug>.json`

**Once the transcript is ready AND has passed the GATE, prepare the plan** — the shot-by-shot brief
that builds the video. Plan it as ordered **beats** + global direction. Decide:
- **hook** — the first ~2s line that stops the scroll. **MUST be a question, a hook, or a "what
  if"** (hard rule 5). e.g. "Paid on time? Score still dropped." / "What if your last bill has a
  charge you never owed?"
- **palette** — bg/primary/accent/text hex (one gold `#FFD23F` accent) carried through captions+graphics.
- per beat: `visual` type, `scene_prompt`/`three_d`/`animation` spec, punchy `caption` + `caption_style`, `sfx.cue`.
- **t_weight** per beat (rough word count of that beat's narration); renderer rescales to real TTS duration.
- whether to enable `avatar` / `micro_video`.
- Keep narration ~68 words / ~17s for the <=20s pipeline (Chatterbox ~4 w/s); the reimagined
  explainer house format runs longer (~30s).

`brief.json` schema (superset of the z-image spec): `slug`, `schema_version`, `target_seconds`,
`narration`, `brief{hook,palette,music_bed,cut_style,avatar,micro_video}`, `beats[]`
(`id,t_weight,visual,scene_prompt|animation|three_d,caption{text,style},impact?,sfx{cue,at,gain}`),
`caption_styles{}` (`size,color,highlight,anim∈pop|spring|pulse|shake|fade|slide_up,y,font`),
`gen_w,gen_h,seed,style`. `visual ∈ still|animation|three_d|micro_video|avatar`. `sfx.cue` vocab:
`riser,whoosh,swoosh,slide,ui_click,click,beep,chime,bling,success_sting,boom,impact,cannon,punch,splash,water,glass,break,coin,laser`. `impact:true` = real reveal (cosmic-boom accent).
Validate: `python ".claude/skills/ultimate-short/director_brief.py" --brief ".../briefs/<slug>.json"`.

## GATE — Validate the transcript BEFORE you render (run right after STEP 1, before STEP 2; owner rule, hard rule 6)

A pre-production **greenlight gate** — never produce a video that hasn't cleared it. A gate can't
prove real views (only publishing can), but it proves *demand* and ranks the hook. Three checks:
1. **Real competitive proof (web).** Search YouTube/TikTok/Reels for existing shorts on the same
   hook/topic; pull actual view counts. 100k–10M+ existing = the topic pulls; **saturated (named
   creators own it, crowded discover pages) caps the ceiling — reject or find a fresher wedge.**
2. **Search/trend demand** — are people actually searching the phrase/question.
3. **Simulated swipe-test** — diverse general-public personas react to ONLY the first 2s of the hook
   (test 2–3 opener variants: a question, a "what if", a pure hook); pick the highest-hold opener
   (still a question/hook/what-if).

**Greenlight only if** demand is proven AND not saturated AND the winning opener holds a strong
majority. Record verdict + predicted tier + honest caveats. For scale, the **Workflow** tool fans
this out (map niches → generate → judge virality×CPM×brand-safety → adversarially verify →
synthesize); converged example + audit trail in `viral_10s_transcript.md` at repo root. Rules in
[[shorts-hook-and-validate]].

## STEP 3 — Render

```bash
# core render (TTS -> visuals -> captions+SFX bed -> compose), guaranteed <=20s
python ".claude/skills/ultimate-short/pipeline.py" --brief ".../briefs/<slug>.json"
python ".../pipeline.py" --brief ".../<slug>.json" --recut                       # + finishing pass
python ".../pipeline.py" --brief ".../<slug>.json" --recut --gameplay-dir "downloads/gta5-gameplay"  # + gameplay stack
python ".../pipeline.py" --brief ".../<slug>.json" --skip-images                 # reuse stills while iterating
```
Outputs: `output/<slug>_short.mp4`, `_short_punchy.mp4`, `_short_punchy_gameplay.mp4`; scratch in `output/_work_<slug>/`.

Pipeline stages: 0 DIRECTOR(you) → 1 NARRATION(GPU, chatterbox) → 2 <=20s atempo CLAMP → 3 PER-BEAT
VISUALS(GPU Z-Image / renderers) → 4 Ken-Burns/motion → 5 CAPTIONS(styled-ASS) → 6 SFX BED(cue map)
→ 7 LOUDNESS(I=-15) → 8 FINISH(recut→gameplay) → 9 GUARD assert <=20.0s.

---

# FINISHING LAYER — pacing + scene-matched SFX + gameplay  (absorbed from punchy-recut)

The editing/sound-design/retention pass for an already-rendered short. Driver:
`.claude/skills/punchy-recut/recut.py` (pure stdlib + ffmpeg). Re-cuts to feel fast: pitch-preserving
speed-up, optional zoom-punch cuts, **scene-matched** SFX over the untouched narration. Output lands
as `<stem>_punchy.mp4`. It NEVER sources footage — finishing only.

## ⚡ Owner pacing preference — energy from ANIMATION, not the recut
A constant zoom-pulse + a whoosh on every beat is **annoying (rejected)**. For the house Remotion
explainers (which already animate richly + cut between scenes), the zoom-punch is redundant:
- **`--punch 0`** (no zoom pulse) — energy is the composition's own fast springs.
- **Cut SFX sparingly:** `--sfx-every 2`+ (a whoosh every 2nd–3rd cut, not all), and/or `--cuts-file`
  scene-boundary timestamps. Keep `--impact-file` for the 2–3 genuine reveals.
- **`--speed ~1.12`** (don't exceed ~1.2 or the narrator rushes).
**Recipe for a Remotion explainer:** `--punch 0 --no-swell --speed 1.12 --sfx-every 2`.
Bare slideshows still use the legacy punchy look (`--punch 0.05`).

## 🔊 VARY the SFX per video (owner ask) — two levers, use both
1. **Bake scene-matched HERO SFX into the comp** at exact frames (best lever, stays in sync since the
   recut speeds video+audio together): copy file to `remotion_explainer/public/sfx_<n>.wav` →
   `<Sequence from={SCENE_FRAME}><Audio src={staticFile('sfx_<n>.wav')} volume={0.45}/></Sequence>`.
2. **Rotate a different `--cut-sfx` list per video**, topic-flavored. When the comp already has rich
   baked SFX, keep cut whooshes sparse+quiet (`--sfx-every 2 --whoosh-gain 0.4`).
**SFX library map** (`assets/sound_effects/`, license-clean): whooshes/slides
`soundfx-rse/soundfx.d/{whoosh1..5,slide1..6}.mp3`; water `game-sound-effects/Sounds/{water_ripples,Splash_Small,Splash_Big}.wav`,
`zulubo-sounds/Environment/toilet_flush.wav`; impacts/booms **`derived/cosmic_boom.wav`** (the boom is
HERE, not a non-existent `impacts/` dir), `zulubo-sounds/Destruction/**`; metal/UI/zap
`zulubo-sounds/Footsteps/Metal/*`, `game-sound-effects/Sounds/{donk,smack,chime1,coin,laser_shot,complete}.wav`.

## Sound design — match SFX to the scene (don't default to whooshes)
Pick `--cut-sfx` + `--impact-file` from the scene's emotion. ✅ = monetization-safe (soundfx-rse CC0/CC-BY,
zulubo MIT, `derived/`); ⚠️ = check `materialfoundry-soundfx/Attribution.xlsx` first.
- generic cut → `whoosh3/4/5,slide2` ✅ · tech/finance/UI → `click3/6/7,beep5` ✅ · myth-bust/"breaks" →
  `Destruction/Glass/glass_break_*,Window/windowBreak_3,Can/can_crush_0` ✅ · water → `splash1/2` ✅ ·
  success/payoff → `bling3,chime2,bling5`; sting `fanfare1` ✅ · big reveal/climax → `derived/cosmic_boom`,
  `cannon1/2,punch3` ✅ · space → `cosmic_boom` ✅.
- Build a clean cosmic boom (once, library-sourced): `ffmpeg -i whoosh2.mp3 -af "asetrate=22050,aresample=48000,lowpass=f=300,atrim=0:2.6,volume=1.25,afade=t=in:st=0:d=0.04,afade=t=out:st=1.5:d=1.1" -ac 2 -ar 48000 derived/cosmic_boom.wav`.

## recut.py flags
`--input`(req) · `--out`(`<stem>_punchy.mp4`) · `--interval`(1.4, lower=faster) · `--cuts-file`(explicit
cut timestamps, orig timeline) · `--speed`(1.1, [0.5,2.0]) · `--punch`(0.06; **0 = no zoom, use for
Remotion**) · `--punch-every`(2) · `--sfx-every`(1; 2+ sparser) · `--sfx-dir`(`assets/sound_effects`) ·
`--cut-sfx`(scene-matched files/dir, rotated — how you stop defaulting to whooshes) · `--whoosh-gain`(0.5;
raise to ~0.55 when also using a loud impact) · `--lead`(0.18) · `--impact-file` · `--impact-every`(4) ·
`--impact-at-file`(timestamps for narration reveals) · `--no-swell`/`--no-sfx` · `--keep-work`.
Content-matched example (space): `--interval 1.15 --speed 1.15 --punch 0.05 --whoosh-gain 0.55 --impact-file derived/cosmic_boom.wav --impact-at-file _reveals.txt`.

## 🎮 Split-screen gameplay (the "brainrot" stack — optional LAST stage)
Stack the finished short on TOP of a random, **MUTED** gameplay clip (bottom), one 9:16 video.
Driver `stack_gameplay.py`, also wired into recut via `--gameplay-dir`.
```bash
python ".claude/skills/punchy-recut/recut.py" --input "output/my_short.mp4" --gameplay-dir "downloads/gta5-gameplay"
python ".claude/skills/punchy-recut/stack_gameplay.py" --input "output/my_short_punchy.mp4" --gameplay-dir "downloads/gta5-gameplay"
```
Flags (recut uses a `--gameplay-` prefix): `--gameplay-dir` · `--split`(0.5) · `--top-fit`(`blur` default —
caption-safe; `crop` CUTS lower-third captions) · `--seed`. Gotchas: gameplay always muted (only the
short's audio is mapped); random clip+start (skips `.part`/<1MB stubs; loops if shorter); **default fit
`blur` not `crop`** because captions sit in the lower third; **Remotion safe-zone for `crop`:** keep all
elements in the center 1080×960 band (Y 480–1440), e.g. wrap scenes in `<g transform="translate(540,960) scale(0.85)">`;
output canvas = the top short's (1080×1920); run it LAST (re-encodes).

## How the recut works (4 stages) + gotchas
1 Speed (`setpts=PTS/speed` + `atempo`, pitch-preserved) · 2 fast-cut VIDEO only (alternating zoom; `-an`)
· 3 SFX bed (`anullsrc` + `adelay` per cut, `amix`) · 4 Mux (`-c:v copy` + sped narration + SFX bed).
**Only the VIDEO is cut, never the narration** (slicing it would desync). `--speed` speeds the voice too
(keep ≤1.2). Zoom-punch can't clip captions on the Remotion fixed viewport (verified) but DOES crop
text baked into a slideshow frame (keep ≤0.05 there). Whoosh peaks before the cut (`--lead`). Captions +
gameplay stack: comment out `<Captions/>` in the TSX, render/recut clean, stack, then burn the `.ass`
over the final stacked output.

## Verify
```bash
O="<output>.mp4"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$O"                  # duration
ffmpeg -i "$O" -af volumedetect -f null - 2>&1 | grep mean_volume                # narration ~ -15..-17 dB, not silent
ffmpeg -loglevel error -y -ss 1 -i "$O" -frames:v 1 /tmp/f.png                   # eyeball a colorful caption
```
A good short: under its slot, captions vary in size/color/anim per beat, each reveal has an audible SFX
hit, pacing is snappy (with `--recut`), and the look is the house code-drawn Remotion SVG style.

## Build status
ultimate-short pipeline Phases 0/1/2/4/5 built+verified (director schema, <=20s clamp, dynamic captions,
SFX-cue bed, Z-Image+Chatterbox+ffmpeg compose, HyperFrames animation + Remotion-R3F 3D beats, living-
portrait avatar, R3F camera-fly micro-video; every non-still engine falls back to a Z-Image still).
Finishing layer (recut + gameplay) built+verified. House Remotion explainer style proven across R001–R030.

---

# STEP 4 — WATCH-BACK QA (review the finished short like a viewer, with `/watch`)

**Non-optional. Rendering it is not the same as watching it.** A comp can pass the contact-sheet stills
and still leak retention in motion — dead-air on a scene open, a hook that doesn't punch, a reveal that
was already spoiled. So after the FINISHING LAYER produces the finished mp4, **watch it back frame-by-
frame as a scroll-stopping viewer would**, find the leaks, fix the comp, re-render, and **re-watch until
the leak list is clean.** This is the pass that turns a greenlit-but-flat execution into a viral one.

## How to run it
```bash
# you already authored the transcript + word timings, so skip Whisper (frames-only is the point here)
python "C:/Users/diksh/.claude/skills/watch/scripts/watch.py" "<finished>.mp4" --no-whisper
```
`/watch` extracts ~1 fps frames (≤30s → up to ~24–30 frames) at absolute `t=MM:SS`. **`Read` every
frame in order, in one message**, and replay it in your head against the narration. (Frames-only is
fine — pair them with the script you wrote. Delete the watch work dir when done.) Cheaper alternative
for a quick re-check: `ffmpeg -ss <t> -i <mp4> -frames:v 1 f.png` at the few suspect timestamps.

## The retention-leak checklist (what to hunt — each is a swipe trigger)
1. **Dead-air / near-empty frames** — the #1 killer on a vertical short. Most common cause: a scene's
   hero element **springs in from `scale 0`**, so the first ~0.5–1s is a tiny element (or nothing) on a
   near-black frame. **Fix:** populate fast (land the main objects in <1s), keep a substantial anchor
   object on screen **from frame 0** of every scene, and drive entrances by **opacity + a min-scale
   floor** (`scale(${0.82 + 0.18*spring})`), never bare `scale(${spring})` from 0.
2. **Weak hook** — the first-2s reveal must be **visceral**, not merely informative. (Credit-score fix:
   the score didn't just dip into the "still-good" gold zone — it **crashed into deep RED** with a big
   drop arrow.) If the hook frame doesn't make *you* react, it won't stop a thumb.
3. **Reveal stepped on** — make sure no earlier scene **pre-spoils the ONE hero reveal**. (Fix: the
   utilization scene was pushing the bar past 30% into red — exactly the hero's job — so it was retuned
   to settle **green, under the line**, leaving the over-30% crossing exclusive to the hero.)
4. **Punchline too brief** — the emotional-core line (the loss-aversion button, the "…but too late")
   must appear **early enough to HOLD ≥~1.5s**, not spring in on the last few frames and get cut.
5. **Tiny / illegible text mid-spring** — anything containing text that scales from ~0 renders
   unreadable micro-text for a beat (looks like a glitch). Same fix as #1: opacity-fade + min-scale.
6. **Readability & caption sync** — text inside the safe band, active caption word lands on the spoken
   word (no drift), nothing clipped by the lower third.
7. **Sound in sync** — after retiming any visual event, **move its baked SFX to match** (the gut-punch
   must hit on the exact frame the score sinks), then re-verify loudness.

## The loop
Fix the comp → **eyeball stills at the changed frames first** (cheap) → full re-render → re-finish
(recut + loudnorm) → **re-watch the suspect timestamps** → repeat until every checklist item is clean.
Worked example (the credit-score short, 2026-06-29): one watch-back pass surfaced 6 leaks (weak hook,
two dead-air scene-opens, a spoiled reveal, a sub-1s punchline, tiny-text springs); all fixed in one
comp edit + re-render. See [[creditscore-finance-explainer]]. This is the same intent as `/loop`'s
visuals/pacing critics — run it by hand every build; let `/loop` automate it when you want convergence.

---

# STEP 5 — PUBLISH & SCHEDULE via Postiz (auto-post to YouTube)

The final step: push the finished, watch-back-clean short to the connected social channel — **immediately,
scheduled for a time, or staged as a draft** — driven by the command. Posting goes through the user's
**Postiz** install (open-source scheduler) at its verified **public API**, via the bundled driver
`.claude/skills/ultimate-short/post_to_postiz.py` (stdlib only). Contract + how it was mapped: [[postiz-autoposting]].

**This step runs ONLY when the command asks to post**, and **only after** the video passed WATCH-BACK QA.
Never publish on the user's behalf without an explicit post/schedule instruction.

## Prerequisites (one-time; the driver checks and tells the user if missing)
- **Postiz running:** `docker ps | grep postiz` → the `postiz` container up (launch: `Run Postiz Platform.bat`
  in `C:\Dikshant\auto posting tool\postiz-app-main`). UI at http://localhost:4007.
- **A channel connected** in the Postiz UI (Add Channel). Currently connected: **YouTube — "Mango cuts"**
  (`@dikshantbhatia4613`). Other platforms = connect their OAuth keys in `docker-compose.yaml` (see the repo's
  `SETUP-SOCIAL-ACCOUNTS.md`), then they post through the *same* driver with `--channel <identifier>`.
- **API key stored** at `~/.config/postiz/key` (already done). It's the org's `apiKey` from Postiz
  Settings → Developers → Access. The driver also reads `$POSTIZ_API_KEY` or `--api-key`.

## Command → what to run (map the user's words to a mode)
| Command intent | Driver mode | Effect |
|---|---|---|
| `--draft` / "stage it" / *(no explicit time given)* | `--draft` | creates a **draft** in Postiz (reviewable in UI, **never publishes**) — the safe default |
| `--schedule "2026-07-02 18:00"` / "schedule for 6pm tue" | `--when "2026-07-02 18:00"` | scheduled (local time → converted to UTC); Temporal publishes at that time |
| `--schedule slot` / "next free slot" | `--when slot` | Postiz picks the next open calendar slot |
| `--schedule "+2h"` / "in 2 hours" | `--when "+2h"` | relative schedule (`+30m`/`+2h`/`+1d`) |
| `--post-now` / `--post` / "post it now" | `--when now --yes` | **publishes immediately to the live channel** |

**SAFETY (outward-facing action):** an immediate publish (`--when now`) hits the real channel — the driver
**refuses it without `--yes`**. Before passing `--yes`, **confirm with the user** (show the title + channel).
Scheduling and drafts are reversible (deletable in the UI) and don't need a confirm, but still echo back what
you scheduled. If unsure which mode the user wants, default to `--draft` and tell them.

## Generate the posting metadata (you, the director)
- **Title** — use the owner's #1 virality lever, the **"YOUR thing is lying to you / you're doing it wrong"
  deception+personal-stakes** pattern (≤100 chars). See [[viral-title-pattern]]. e.g. *"Your credit card is
  lying to you"*.
- **Description** (`--description`, ≤5000) — front-load the hook, deliver the value in 2–3 lines, one CTA
  ("Follow for 60-second money tips"), a question to bait comments, then keyword hashtags. Pass inline or as
  `@path/to/desc.txt`.
- **Tags** (`--tags a,b,c`) — niche discovery tags (the driver wraps them in the `{value,label}` shape Postiz
  requires). **Privacy** `--privacy public|private|unlisted` (default public). **`--made-for-kids no`** unless
  it's kids content. **`--thumbnail <img>`** optional (1280×720).
- Keep it TRUE + brand-safe (no "guaranteed"/"overnight" — protects monetization).

## Invocations
```bash
# 0) sanity — list connected channels
python ".claude/skills/ultimate-short/post_to_postiz.py" --list

# 1) preview the exact payload without posting (recommended before a real schedule)
python ".claude/skills/ultimate-short/post_to_postiz.py" --video "<final.mp4>" \
  --title "Your credit card is lying to you" --description @desc.txt \
  --tags creditscore,creditcardtips,moneytok --when "2026-07-02 18:00" --dry-run

# 2) stage a DRAFT (safe default — review in the UI)
python ".claude/skills/ultimate-short/post_to_postiz.py" --video "<final.mp4>" \
  --title "..." --description @desc.txt --tags ... --draft

# 3) SCHEDULE (local time → UTC) or next free slot
python ".claude/skills/ultimate-short/post_to_postiz.py" --video "<final.mp4>" --title "..." \
  --description @desc.txt --tags ... --when "2026-07-02 18:00"
python ".../post_to_postiz.py" --video "<final.mp4>" --title "..." --when slot

# 4) PUBLISH NOW (confirm with the user first; --yes required)
python ".../post_to_postiz.py" --video "<final.mp4>" --title "..." --description @desc.txt \
  --tags ... --when now --yes

# other channels (once connected): --channel tiktok | instagram | x | linkedin | facebook ...
```

## Gotchas (already handled by the driver, but know them)
- **Base** `http://localhost:4007/api`, public routes `/public/v1/*`, auth `Authorization: <raw key>` (NO Bearer).
- **Pipeline:** GET `/integrations` (find `identifier=="youtube"`) → POST `/upload` (multipart field **`file`**,
  returns `{id,path}`) → POST `/posts` (`type` draft|schedule|now, **UTC** `date:"YYYY-MM-DDTHH:mm:ss"`,
  `settings.__type="youtube"` with `title`/`type`/`selfDeclaredMadeForKids`/`tags`/`thumbnail`; **description =
  `value[].content`**, video in `value[].image[]`).
- `settings.tags` must be **`{value,label}` objects** (the driver converts); date is **UTC** (driver converts
  from local); title ≤100, description ≤5000; immediate publish needs `--yes`; rate limit `API_LIMIT=30`/hr.
- A scheduled/queued post is published by Postiz's **Temporal** worker at its `publishDate` — Postiz must stay
  running for the scheduled job to fire.
- **⚠️ Self-hosted-localhost auto-publish fix (else posts stick on a manual "Post" click / QUEUE / ERROR):** this
  Postiz install has 3 publish bugs — a Temporal worker cold-start race, media unreachable at `localhost:4007`
  inside the container, and stale YouTube OAuth (`refreshNeeded`). Run **`bash "C:/Dikshant/Money making/postiz_yt_refresh.sh"`
  right before publishing** (refreshes the token + starts the in-container `4007→5000` forwarder), and the daily
  runner's `ensure_postiz.ps1` restarts the worker each run. Verify a publish actually went live via
  `SELECT state,"releaseURL" FROM "Post"` (PUBLISHED + youtube.com URL). Full detail in [[postiz-autoposting]].

---

# SELF-LEARNING SYSTEM — the channel improves itself to grow views

The pipeline doesn't just produce — it **learns from real YouTube performance + market research and
rewrites its own rules** to get more views over time. Two cadences:

**A. Per-video (every producer run):** the producer READS the `★ SELF-LEARNED RULES` section (top of
this file) and applies every RULE/active-SIGNAL, and RESEARCHES each topic like a competitor analyst —
YouTube (top Shorts' view counts/hooks/titles/thumbnails, `/watch` a winner for pacing), Reddit (real
pain points/phrasing), web/trends (demand + fresh angle) — folding findings into a sharper hook/title.
It also reads **`competitor_playbook.md` → § TECHNIQUE CATALOG** (the compounding wisdom from the daily
CreatorStudy) and applies its best hook/pacing/retention/title techniques. (Wired into
`daily_shorts_prompt.md` PRECHECK #4/#4b + PICK+RESEARCH+VALIDATE.)

**B. Weekly (the LEARNING RUN):** Windows task **`ShortsLearn`** (Sun 10:00) → `learn_shorts.bat` →
`claude -p "follow learn_and_improve_prompt.md"`. It:
1. `python yt_analytics.py` → `analytics/performance_latest.md` (channel + per-video views/likes/comments
   via Data API; **CTR + averageViewPercentage via Analytics API once enabled** — see blocker below).
2. Diagnoses (metric→action: CTR→title/cover, retention→hook/pace, views→topic/niche) by correlating
   each video's numbers with its niche/title/hook/topic.
3. Researches the market (YouTube/Reddit/web) for the "why" + fresh ideas.
4. Derives **1–3 one-variable EXPERIMENTS** (change · metric it should move · confidence tier · review
   date), adversarially vetted.
5. Applies safely: `bash backup_skill.sh` → edits ONLY between the `<!-- LEARNED-RULES-START/END -->`
   markers → reprioritizes `daily_topics.md` → appends to `learnings.md` (append-only lab notebook).
6. **Strategic forks** (e.g., niche pivot away from high-CPM money) go to `DECISIONS_FOR_OWNER.md`, not
   auto-applied. Tactical changes (hooks/titles/thumbnails/pacing/order) apply directly.

**C. Daily (the CREATOR STUDY run — compounding competitor intelligence):** Windows task **`CreatorStudy`**
(08:00) → `study_creators.bat` → `claude -p "follow creator_study_prompt.md"`. Each run: `yt_top.py` finds
the real top Shorts in a niche by views (e.g. Gohar Khan's credit-score Short at **19.5M**) → **`/watch`es
2–3 NEW winners** frame-by-frame → extracts WHY they hold attention (hook, frame-0, pacing, retention
devices, visuals, title, SFX) → grows `competitor_playbook.md` (§ TECHNIQUE CATALOG + § STUDY LOG),
dedups via `studied_videos.md`, promotes PATTERN/PROVEN techniques into the learned-rules. The producer
applies the catalog on every build, so quality compounds. (This proved finance CAN hit 10–20M views — the
gap is execution, which studying winners closes.)

**Safety (never violated):** hard rules + everything outside the markers are immutable; timestamped
backups in `skill_backups/`; **min-N gates** (no per-video conclusion below ~1k impressions / 300 views —
lean on external evidence + aggregates); **confidence tiers** (HYPOTHESIS→SIGNAL→RULE); one variable at
a time; no thrashing; ~12-rule cap; stays TRUE + brand-safe.

**✅ YouTube Analytics API: ENABLED** (2026-07-01) — the loop now reads **CTR + averageViewPercentage
(retention)**, not just views. First read showed "The Blood That Can Kill You" holding **93.9% AVP** vs
"What Earwax Really Is" at **39.7%** — so it can now pinpoint hook/pacing fixes, not just guess.

**Controls:** run now `Start-ScheduledTask ShortsLearn` / `CreatorStudy` · pause `Disable-ScheduledTask
<name>` · logs `learn_run.log` / `study_run.log`. Insights in `learnings.md`; competitor techniques in
`competitor_playbook.md`; owner decisions in `DECISIONS_FOR_OWNER.md`. See [[shorts-self-learning]].

---

# /loop — REFINE UNTIL PERFECT (self-paced convergence mode)

A **rubric-gated, adversarial-critic refinement** mode layered on the normal pipeline. Instead of producing each artifact once, `/loop` re-attacks **every** process — hook, transcript/script, validation, visuals/animation, sound design, captions, pacing — with skeptic critics whose only job is to find the single worst remaining flaw, and keeps grinding each until it clears an **objective** quality bar. Hard clamp: **min 3 / max 10** iterations per process. Early-stop only **after** the 3-iteration floor AND a met bar. It self-paces with `ScheduleWakeup` and persists everything in a per-slug refine log, so a long perfection run survives restarts. The three hard rules still bind every iteration: hook stays a question/what-if (rule 5), the GATE still runs before any render (rule 6), the house animation style is the default look (rule 7).

## 1. Invocation + self-pacing

```
/loop make the ultimate short about <TOPIC>      # cold start: generate -> GATE -> plan -> render, then refine EVERY process
/loop refine <slug>                              # resume/deepen an existing build; continues the non-converged processes
/loop refine <slug> --only hook,captions         # refine a subset (still min 3 / max 10 each)
/loop refine <slug> --min 3 --max 6              # override inside the hard clamp (3 <= min <= max <= 10; defaults 3/10)
/loop refine <slug> --threshold 9.2             # override the perfect bar (default 9.0/10)
```

This is the **`/loop` skill in dynamic (self-paced) mode**: it does **exactly one iteration of one process per wake**, appends the result to the refine log, then `ScheduleWakeup`s to continue — never a blocking busy-loop, never all-processes-in-one-turn. The log is the source of truth between wakes. Each wake:

1. **Read** `output/_work_<slug>/refine_log.json` (§8). Find the **current process** = first in PROCESS ORDER not yet `done`, and its iteration count `n`.
2. **Run one** iterate -> critique -> fix -> re-score cycle for that process (§3).
3. **Append** the iteration record (scores, worst flaw, fix, delta) to the log; recompute that process's `status` via the clamp logic.
4. If the process is now `done` (bar met after n>=3, OR 2 dry rounds, OR hit max 10): advance the cursor to the next process; if upstream changed, re-open downstream (§2).
5. **Reschedule:** any process still active -> `ScheduleWakeup` (short delay, longer when a Workflow round is queued). All processes `done` -> render the finished short, run the FINISHING-LAYER **Verify** block, write `final_report`, and **stop scheduling** (no further wake).

The loop also **gates on events**: a wake that needs the heavy Workflow panel (§5) schedules the Workflow, records `status: awaiting_workflow`, and the next wake resumes when the panel verdict lands.

## 2. Processes refined + order (follows STEP 1 -> GATE -> STEP 2 -> STEP 3 -> FINISHING)

Refine in **strict pipeline order** so an upstream fix can't be invalidated by a later stage (a perfect hook on a weak script is wasted):

| # | Process | Pipeline stage | Artifact it edits | Critic mode |
|---|---|---|---|---|
| P1 | **hook** | STEP 1 / `brief.hook` | first line of transcript + `brief.hook`/`b0` | heavy (cold pass) then inline |
| P2 | **script/transcript** | STEP 1 | `reimagined_transcripts/<NNN>_<slug>.txt` | **heavy** |
| P3 | **validation** | GATE | greenlight verdict + winning opener | **heavy** (reuses GATE fan-out) |
| P4 | **visuals/animation** | STEP 2->3 | `briefs/<slug>.json` beats + the Remotion comp | **heavy** |
| P5 | **sound design** | STEP 3 / FINISHING | baked HERO SFX + `--cut-sfx`/`--impact-file` choices | inline |
| P6 | **captions** | STEP 3 (ROOT `<Captions/>`) | caption pages, color/anim/timing | inline |
| P7 | **pacing/recut** | FINISHING | recut flags (`--speed`/`--punch`/`--sfx-every`/cuts file) | inline |

**Order is P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7.** Dependency rule: converging P1 or P2 **re-opens P3** (the GATE/swipe-test must re-pass the changed text) and marks P4–P7 *stale* — a stale process resets to `iter:0` and re-earns its floor of 3 against the new upstream. P3 is binary, not a polish loop: it re-runs the GATE; a red gate re-opens P1/P2. After P7, the loop runs **one** final cross-check pass on the hook + whole short; if it regresses, the hook re-opens for its remaining budget.

## 3. The per-process iteration loop

Every wake performs ONE cycle for the active process, clamped to **[min, max] = [3, 10]**:

```
iterate(n)  -> PRODUCE/MUTATE the artifact for variant n (n=1 = current artifact, scored as-is).
critique    -> score it on the process rubric (§6) AND name the single highest-leverage flaw,
               classed fatal | major | minor | none. Inline rounds: you self-score each dim + name
               the worst flaw. Heavy rounds: dispatch a Workflow judge panel (§5) -> consensus
               score + the worst fatal-or-best fix.
fix         -> apply ONLY that one worst flaw's fix (fatal first) -> variant n+1, so each iteration
               is attributable to one change.
re-score    -> re-run the rubric on n+1; record weighted total, per-dim scores, and delta in the log.
```

**Clamp + early-stop logic (evaluated after each re-score):**
- **Floor:** `n < 3` -> **always continue**, even if it already looks perfect. Non-negotiable.
- **Perfect (early-stop):** allowed only at `n >= 3`, and only when **all** hold — (a) weighted total **>= threshold (default 9.0)**, (b) **no single dimension below its floor (7.0)**, and (c) the critic gate is clean: **no fatal/major flaw** (heavy processes: the adversarial panel returns a `none`-majority — >=2 of 3, or >=3 of 5).
- **Dry-stop (loop-until-dry):** at `n >= 3`, **2 consecutive iterations with delta < +0.3 and no new fatal/major flaw** -> stop as `DRY` (squeezed dry; keep the best variant) even if the absolute bar isn't fully hit.
- **Max:** `n == 10` -> **hard stop = MAXED** regardless of score; log the best variant + the residual top flaw as a known limitation.
- **Keep-best:** always retain the highest-scoring variant seen (a fix can regress); on `done` the loop reverts to best.

No path runs fewer than 3 or more than 10 iterations of any process.

## 4. The quality bar — "perfect" (objective, per process)

A process is **PERFECT** when, at `n >= 3`: weighted total **>= threshold**, **no dimension below its floor (7.0)**, and the critic gate is clean (no fatal/major; heavy = `none`-majority from the panel). A **fatal flaw** is a binary disqualifier that alone fails the process regardless of average: untrue/unsafe claim; saturated/no-demand topic; flat non-interrogative hook (rule 5); silent narration / not −15…−17 dB; non-Chatterbox audio (rule 4); off-house-style visual (rule 7); `<Captions/>` not at root or wrong-word captions; >20s on the ultimate-short slot. P3 is purely binary — "perfect" = GATE **greenlight** on the current text.

| Process | Bar (weighted /10) | Per-dim floor | Hard gate (auto-fatal if violated) |
|---|---|---|---|
| P1 hook | >= 9.0 | 7.0 | is a question/hook/what-if (rule 5) |
| P2 script | >= 9.0 | 7.0 | TRUE + brand-safe, no fatal flaw |
| P3 validation | binary | — | greenlight: demand proven, NOT saturated, opener holds majority |
| P4 visuals | >= 9.0 | 7.0 | house style, exactly ONE hero reveal, on-topic (rules 7) |
| P5 sound | >= 9.0 | 7.0 | narration not silent (mean ≈ −15…−17 dB), Chatterbox (rule 4) |
| P6 captions | >= 9.0 | 7.0 | one root `<Captions/>`, words correct |
| P7 pacing | >= 9.0 | 7.0 | within slot (<=20s / ~30s), narrator not rushed (`--speed` <=1.2) |

## 5. Workflow (heavy rounds) vs. inline iteration

- **Inline self-critique** (cheap, single-threaded, default for iterations 1–2 of every process and for all of **P5 sound, P6 captions, P7 pacing**): you produce the variant, score the rubric, name the worst flaw, fix, re-score — all in one wake. Most minor/major flaws die here.
- **Workflow adversarial judge panel** (the heavy round, for the high-stakes **P2 script, P3 validation, P4 visuals** — and P1 on the cold pass to seed opener variants): fan out **3–5 skeptic critics** as parallel agents, each a distinct attack persona (script: *retention critic*, *fact/brand-safety hawk*, *craft purist*; visuals: *motion critic*, *composition critic*, *house-style-fidelity critic*), each returning per-dim rubric scores + the single worst flaw (with severity) + a one-line fix. Then an **adversarial-verify** pass tries to overturn the top score / find a flaw the panel missed. **Synthesize** the consensus score + the one fix to apply next. This is the same fan-out used in STEP 1 / the GATE (`viral_10s_transcript.md`). Visuals critics score off a **QA contact sheet** (frame grabs at scene boundaries) + the rendered MP4; sound critics off the muxed audio.
- **Cadence:** use a heavy round at iteration 1 (baseline) and at the **deciding** iteration (the one about to early-stop) to confirm the bar with the panel, not just self-score; inline rounds in between to save cost. A Workflow round counts as **one** iteration in the clamp. **Never declare a heavy process perfect on inline critics alone past iteration 3.**

## 6. Per-process rubrics (dimensions x weight; score 0–10 each; threshold 9.0, floor 7.0)

**P1 hook** — scroll-stop / first-2s hold `.40` · question/what-if compliance, rule 5 `.25` · curiosity gap `.20` · brevity (<=~12 words, zero wind-up) `.15`.

**P2 script** — retention arc (hook->setup->participation->ONE hero reveal->payoff) `.30` · truth + brand-safety (no scam/guarantee/medical-cure) `.25` · payoff strength (<=6-word button, loss-aversion/surprise) `.25` · maps to 6 scenes + length fits slot (~24–30w/10s or ~68w/30s) `.20`.

**P3 validation** — binary GATE: greenlight (demand proven, not saturated, winning opener holds a strong majority) or red. Not weighted.

**P4 visuals** — house-style fidelity (code-drawn SVG, gold `#FFD23F`, SceneWrap, springs; no stock/slop) `.30` · exactly ONE hero reveal, visually loudest `.25` · motion quality (springs/draw-on/timing, no jank/name-clash/scale bug) `.25` · scene<->narration sync `.20`.

**P5 sound** — scene-matched SFX (fits each beat's emotion, not default whooshes) `.35` · HERO hits on the 2–3 real reveals `.30` · mix/loudness (−15…−17 dB, music ducked, nothing clips/buries) `.25` · variety vs. prior videos, topic-flavored (owner ask) `.10`.

**P6 captions** — word-sync accuracy (active word pops on the spoken word, no drift) `.35` · style (gold active word, size/anim variety per beat, readable) `.30` · readability/safe-zone (bottom ~168px, no overflow, root `<Captions/>`) `.20` · no gotchas (not inside a Sequence, no WrapStyle/rebase bug) `.15`.

**P7 pacing** — snap/retention feel, fast but narrator never rushed (`--speed` <=1.2) `.40` · energy-from-animation, owner rule (`--punch 0`, no zoom-pulse on Remotion) `.30` · SFX cut placement (`--sfx-every 2`+, whoosh leads the cut) `.20` · duration in slot `.10`.

## 7. Worked example trace — P1 hook (topic: "your score dropped even though you paid on time")

Bar: weighted >= 9.0, every dim >= 7.0, opener-form gate passes.

| n | Round | Variant | scroll-stop | q/what-if | curiosity | brevity | **Weighted** | Worst flaw -> fix |
|---|---|---|---|---|---|---|---|---|
| 1 | heavy (panel+red-team) | "Credit scores can drop unexpectedly." | 3.0 | 1.0 | 4.0 | 8.0 | **3.05** | FATAL: flat statement, fails rule 5 -> rewrite as a question |
| 2 | inline | "Did you know your score can drop after you pay?" | 6.5 | 9.0 | 6.0 | 6.5 | **6.73** | "did you know" cliche, low tension -> sharpen the open loop |
| 3 | inline | "Paid on time — so why did your score drop?" | 9.0 | 9.5 | 8.5 | 8.0 | **8.83** | floor reached (n=3) but total < 9.0 -> add the stakes |
| 4 | heavy (confirm) | "Paid every bill on time. Score still dropped. Why?" | 9.5 | 10.0 | 9.5 | 8.0 | **9.30** | panel: no fatal/major; need it to hold -> tighten brevity |
| 5 | inline | "Paid on time? Score still dropped." | 9.5 | 10.0 | 9.5 | 9.0 | **9.55** | none -> **PERFECT** (n>=3, >=9.0, no dim<7, panel clean) |

Closes at n=5: floor cleared, total 9.55 >= 9.0, all dims >= 7, opener-form passes, red-team empty. Best variant (n=5) locked as `brief.hook`; logged `CONVERGED @ 9.55`. Because the hook changed, P3's swipe-test re-opens when the loop reaches the GATE. (Had n=4 and n=5 both shown delta < +0.3, the dry-stop rule would have closed P1 at n=5 too.)

## 8. State / bookkeeping — the refine log (persists across wakes)

All progress lives in **`output/_work_<slug>/refine_log.json`** (one per slug) so any `/loop` wake resumes exactly where it stopped. Each wake **appends** one iteration object (never rewrites history), updates `status`/`cursor`/`reopened`, then `ScheduleWakeup`s.

```jsonc
{
  "slug": "credit-score-drop", "topic": "...", "threshold": 9.0, "clamp": [3, 10],
  "order": ["hook","script","validation","visuals","sound","captions","pacing"],
  "cursor": "script",                      // first non-converged process in order
  "updated": "<iso8601>",
  "processes": {
    "hook": {
      "status": "CONVERGED",               // PENDING | IN_PROGRESS | AWAITING_WORKFLOW | CONVERGED | DRY | MAXED | STALE
      "stopped": "bar_met", "best_score": 9.55, "best_variant": 5, "dry_streak": 0,
      "history": [
        {"n":1,"round":"heavy","scores":{"scroll":3.0,"qwi":1.0,"curiosity":4.0,"brevity":8.0},
         "weighted":3.05,"fatal":["flat statement (rule 5)"],"fix":"rewrite as question","delta":null},
        {"n":5,"round":"inline","weighted":9.55,"fatal":[],"delta":0.25,"converged":true}
      ],
      "artifact": "Paid on time? Score still dropped."
    },
    "script": { "status": "IN_PROGRESS", "n": 2, "best_score": 8.4, "dry_streak": 0, "history": [ /* ... */ ],
                "top_unresolved": "hero reveal competes with payoff (major)" }
    // P3 validation entries store the GATE verdict (greenlight/red + caveats)
  },
  "reopened": [ {"process":"validation","reason":"hook changed at hook.n5","at":"..."} ],
  "stale_after_upstream_change": ["visuals","sound","captions","pacing"],
  "next_wake": { "process": "script", "n": 3 },   // what the next ScheduleWakeup runs
  "final_report": null
}
```

Conventions: `delta` = improvement vs. the previous best (drives `dry_streak`: two rounds with `delta < +0.3` -> `dry_streak:2` -> `stopped:"dry"`); `round ∈ inline|heavy`; `stopped ∈ bar_met|dry|max`; `best_variant` is the artifact reverted-to on `done`. When an upstream fix materially changes a downstream input, push to `reopened` and reset that process to `n:0, status:PENDING`. A human-readable mirror is appended to `refine_log.md` (one line per iteration: `P# proc nN weighted Δ status — fix`) so the owner can skim the whole run. The loop is **done** (no reschedule) only when every in-scope process is `CONVERGED|DRY|MAXED`; the final wake writes `final_report` (per-process final score + any `top_unresolved` limitations + path to the finished `output/<slug>_short_punchy.mp4`), runs the Verify block, and stops.
