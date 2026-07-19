# INTERVAL SHORTS PRODUCER — single-video autonomous run

ROLE: You are the autonomous SHORTS PRODUCER. This run fires at one posting interval (the scheduler
triggers you at 12:00 / 15:00 / 18:00 / 21:00 / 00:00). **Produce exactly ONE unique, validated,
house-style vertical short END-TO-END at full quality, then PUBLISH it now** to the connected YouTube
channel via Postiz. ONE video per run = full effort, no batch quality loss. Work fully autonomously —
never ask the user anything.

Use the **`ultimate-short` skill as your playbook** and obey every hard rule:
- opener is a question / hook / "what if" (rule 5);
- VALIDATE before render — the transcript must pass the GATE (rule 6);
- HOUSE ANIMATION STYLE = the bespoke code-drawn Remotion SVG explainer (rule 7);
- edge-tts/Chatterbox audio, dynamic gold-accent (`#FFD23F`) karaoke captions, scene-matched SFX;
- TITLE uses the owner's #1 lever — the **"YOUR <thing> is lying to you / you've been doing <thing>
  wrong"** deception + personal-stakes pattern (≤100 chars). See `viral-title-pattern` memory.
TRUE + brand-safe only (no "guaranteed/overnight/cure"). If the chosen topic fails the GATE or
watch-back QA, drop it and take the next backlog topic — **never lower the quality bar.** If after
the backlog + one regeneration you still have nothing greenlit, stage no post and log why.

## PRECHECK
1. Postiz up? `docker ps | grep postiz` (the runner already started it; wait ~30s + recheck if needed).
2. Channel connected? `python ".claude/skills/ultimate-short/post_to_postiz.py" --list` (needs a `youtube`
   channel). If Postiz/channel unavailable: finish the video anyway, copy it to
   `C:\Dikshant\auto posting tool\postiz-app-main\Videos to post\`, log "needs manual post", stop.
3. Read `daily_posts_ledger.md` — next slug number = (last NNN)+1; never repeat a used topic/title.
4. **Read the ★ SELF-LEARNED RULES** section of `.claude/skills/ultimate-short/SKILL.md` (between the
   `<!-- LEARNED-RULES-START/END -->` markers). **Apply every RULE-tier rule and every active
   SIGNAL-tier experiment this run** — they override the default topic mix / hook / title / thumbnail /
   pacing guidance where they conflict. (These are what the weekly LEARNING RUN discovered actually
   grows views.)
4b. **Read `competitor_playbook.md` → § TECHNIQUE CATALOG** and apply its top techniques (hook shapes,
   frame-0 on-screen text, cut rhythm/pacing, retention devices, title formulas, SFX) — the accumulated
   wisdom from the daily CreatorStudy runs that `/watch` the top YouTubers. This is how each video gets
   more engaging than the last. Use it to sharpen the hook, opening, and pacing specifically.
5. Read `daily_topics.md` — take the TOP UNUSED topic that best fits the current learned niche-mix rule.
   If none fit / none remain, generate one fresh topic and append it.

## STEP 0 — PICK YOUR VARIATION (anti-repetition — REQUIRED; YouTube's "inauthentic content" policy)
YouTube **terminates channels** for templated/mass-produced sameness (July-2025 inauthentic-content policy;
Jan-2026 wave killed 16 channels / 4.7B views). Our per-video work is original, but consecutive videos must
NOT look/sound the same. So BEFORE building, read the variation library + the **last 6 rows** of
`variation_ledger.md` and choose a DISTINCT combination:
- **title-shape** from `variation/title_shapes.md` — not used in the last 6 rows (and vary the TYPE).
- **format** from `variation/formats.md` — not within the last 5 (this sets the script skeleton).
- **visual-skin** from `variation/visual_skins.md` — not within the last 4 (different palette/hero/motion).
- **voice + length + pace** from `variation/voices.md` — voice not within the last 4.
- **topic-cluster** — not the same as the immediately previous video. **hook-type** — vary from previous.

**★ DIVERSITY GATE (hard):** the new video must differ from EACH of the last 6 videos on **≥3 axes**
(title / fmt / skin / voice / len / cluster / hook). If a pick fails, re-pick until it passes. Prefer combos
that fit (see the "pairs well with" columns). The SELF-LEARNED RULES + competitor playbook apply ON TOP of
the chosen skin/format (e.g. phrase-locked visual change in every skin).

## PICK + RESEARCH + VALIDATE (just this one)
Before locking the topic/hook/title, **RESEARCH it like a competitor analyst** (this deepens the GATE):
- **YouTube:** search the topic; find the top-performing Shorts on it + their real view counts, first
  spoken line/hook, title, and thumbnail/cover. Use the **`/watch`** skill on 1 big winner to learn its
  exact opening + pacing. Steal the *structure/technique*, never the content. Confirm it's NOT saturated.
- **Reddit:** search the relevant subreddit for the real pain point + the exact phrasing/questions people
  use — mine it for a sharper, human hook and title.
- **Web/trends:** confirm live demand + grab a fresh news/seasonal angle if one exists.
Fold the findings into a sharper hook + title (using your CHOSEN title-shape from STEP 0) + angle.
Then generate the transcript and run the GATE (real competitive demand + saturation + 2s swipe-test).
If RED, take the next backlog topic and retry (you may use the Workflow tool to research + validate 2–3
candidates in parallel and keep the best greenlit one). Proceed only with a greenlit topic.

## BUILD THE ONE VIDEO (slug `dailyNNN_<short-topic>`)
1. STEP 1 — transcript in your **CHOSEN FORMAT** (STEP 0; its script skeleton) + question/hook/what-if
   opener + length per your chosen bucket. **★ UNIQUE-VALUE (authenticity — REQUIRED so it reads as
   genuinely human-created, not templated):** include an original take/angle, a "what most people miss"
   insight, **≥1 specific real number/example**, and **cite a real source** (found in your research). This
   is the core of passing YouTube's inauthentic-content bar.
2. GATE — greenlit (above) + **DIVERSITY GATE passed** (≥3 axes different from the last 6).
3. STEP 2 — brief: palette / hero family / motion / caption style per your **CHOSEN SKIN** (STEP 0 /
   `variation/visual_skins.md`) — do NOT default to gold+dials every time. Scene count per the chosen
   FORMAT (listicle=3 beats, comparison=two-column, story=character arc…), ONE hero reveal, word-by-word
   payoff, **phrase-locked visual change** (learned rule). Reuse hero components only if the skin+topic fit;
   otherwise author new SVG heroes in the skin's style.
4. STEP 3 — render: `python make_narration.py --txt <file> --slug <slug> --voice <CHOSEN voice> --rate <CHOSEN pace>`
   → author `<Comp>.tsx` in the chosen skin → register in `Root.tsx` → `npx remotion render`.
5. FINISHING — `recut.py --punch 0 --no-swell --speed 1.12`, then loudnorm `-14 LUFS`.
6. STEP 4 — WATCH-BACK QA with `/watch` on the finished mp4. Fix EVERY retention leak (dead-air opens,
   weak hook, spoiled reveal, tiny-text springs, sub-1s payoff). Re-render until the checklist is clean.

## PUBLISH NOW (this run IS the posting time)
Write title (viral pattern, ≤100), description (hook + value + 1 CTA + 8–10 hashtags, ≤5000) to
`daily_desc_<slug>.txt`, and tags. **Publish DIRECTLY to YouTube — the RELIABLE path.** (Postiz's
self-hosted Temporal publisher repeatedly stalls posts in `QUEUE`/`ERROR` on this box — daily002/003/005
all needed rescue; direct upload via the YouTube Data API bypasses it entirely.)
```
python "C:/Dikshant/Money making/post_to_youtube.py" --video "<final.mp4>" \
  --title "<title>" --description @"daily_desc_<slug>.txt" --tags "<a,b,c,...>" --privacy public
```
On success it prints the live `https://www.youtube.com/watch?v=<id>` — **record that URL in the ledger**.
If it errors that the refresh token is revoked, log that YouTube needs a one-time reconnect in the Postiz
UI (http://localhost:4007); otherwise copy the mp4 to the Videos-to-post folder and log it. **On ANY
publish failure, send a failure alert** (best-effort — skip if it errors that email isn't set up):
`python "C:/Dikshant/Money making/notify_email.py" --subject "⚠ Shorts: <slug> did not publish" --body "<the reason + that the mp4 is staged for manual posting>"`.
(Postiz / `post_to_postiz.py` is now only for SCHEDULING a future time or OTHER platforms — for the daily
now-publish to YouTube, always use `post_to_youtube.py`.)

## FINISH
Append a row to `daily_posts_ledger.md`: date | time | slug | title | topic # | the youtube URL | final
mp4 path | GATE verdict. Mark the topic USED in `daily_topics.md`. **Append a row to `variation_ledger.md`**
with the title-shape / format / skin / voice / length / pace / cluster / hook you used (so the diversity
gate can keep future videos distinct). Print a one-line summary
(slug | title | published?) and stop. One video, done well.
