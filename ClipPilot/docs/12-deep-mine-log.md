# 12 — Deep-mine log (every app's SOURCE, app by app)

**Owner directive:** go through every `reusablecode/` app's **source code** (not just READMEs), one by one, and integrate any portable functionality ClipPilot doesn't already have. This log records each app's pass: what was found, what was integrated, what was deferred/excluded (with reason). Each batch uses a parallel deep-read Workflow that's given ClipPilot's full current capability list so it only surfaces what's **missing**.

## Batch 1 — permissive earners (2026-06-23)
Deep-read MoneyPrinterTurbo, ShortGPT, Pixelle-Video, remotion, hyperframes source (workflow `wefafbftb`, 5 readers). 25 additive candidates surfaced; triaged by value+portability+fit.

### ✅ Integrated
| Technique | From | Where |
|---|---|---|
| **Keyframe simplification (Ramer-Douglas-Peucker)** | hyperframes `audioMixer.simplifyVolumeKeyframes` | `editor/keyframes.py simplify_rdp` + capped in `ffmpeg_expr` (dense GSAP-style keyframe lists can't overflow the nested-if() filtergraph). **Also fixed a real RDP loop-bound bug found while verifying.** |
| **Chroma key / green-screen removal** | ShortGPT `core_editing_engine` green_screen action | `Clip.chroma_key` {color,similarity,blend} → `render._video_chain` ffmpeg `chromakey`; settable via `set_clip_properties`/MCP. **Render-verified** (green removed, content composited over background). Enables overlays: subscribe buttons, avatars, watermarks. |
| **Spring-physics easing** | remotion `spring-utils` | `keyframes.spring_curve` (damped-harmonic) + `spring` interp; in the ffmpeg-expr it bakes the curve → RDP-simplify → linear (uses the RDP work above). **Verified**: overshoots to 1.09 then settles, renders. Natural 'bounce' on moves/fades. |

### 🔜 Queued (high-value, larger or needs a dep — next batches)
| Technique | From | Note |
|---|---|---|
| **Content translation engine** | ShortGPT `content_translation_engine` | transcribe→translate→TTS-at-matched-duration→splice — multilingual DFY (high $ reach). Multi-step; own iteration. |
| **Beat-synced cuts (BPM octave-align + regularize)** | hyperframes `beatDetection` | snap clip cuts to music beats; needs a beat-detection step (librosa/onset). |

### ⛔ Deferred / not a fit
- **Spleeter stem separation** (ShortGPT) — heavy TensorFlow dep; marginal for generated faceless narration (we already duck BGM). Document as optional.
- **Gender-aware voice / silence caption grouping** (ShortGPT) — medium value; minor variants of what we have. Low priority.
- **MoneyPrinterTurbo / Pixelle-Video** — 0 additive techniques (their pipelines are already covered by ClipPilot's b-roll/caption/compose/metadata/upload integrations).
- **remotion TikTok caption grouping** — already integrated (`media/captions.py`).

## Batch 2 — MoneyPrinter / MoneyPrinterPlus / moviepy / Open-Generative-AI / ViMax (2026-06-23)
Deep-read source (workflow `wfp6d5gwg`). 29 candidates; top wins triaged.

### ✅ Integrated
| Technique | From | Where |
|---|---|---|
| **Clip-to-clip transitions (crossfade + slide)** | MoneyPrinterPlus `texiao_service` / moviepy `CrossFadeIn`; ffmpeg `xfade` family | `Clip.transition` {type,duration_frames} → `render`: the incoming clip starts `lead` frames early (overlapping the previous clip on the base), `fade`/`dissolve` → crossfade (alpha), `slide_left/right/up/down` → animated overlay position. Settable via `set_clip_properties`/MCP. **Render-verified** (mid-transition frame blends both clips). The #1 editor gap. |

| **Multi-intent script router** | ViMax `script_planner` (narrative/motion/montage) | `script.classify_intent` (Claude or keyword heuristic) + `build_intent_prompt` + `generate_script(mode=narrative/motion/montage/auto)` — genre-specific script styles; CLI `--mode`. Improves script variety/structure. |

### ⏸ Deferred (hard in pure ffmpeg — low ROI vs effort)
| Technique | From | Why deferred |
|---|---|---|
| **Speed ramp / AccelDecel** | moviepy `AccelDecel` | non-linear within-clip speed needs per-frame time-warp + input-duration bookkeeping + matching audio warp — brittle in ffmpeg setpts (moviepy does it frame-by-frame in Python). Editor already has constant per-clip `speed`. Revisit only if a clear money use-case appears. |
| **Wipe transitions** | ffmpeg xfade wipe/circle | animated `crop` (w/h aren't `eval=frame` in the crop filter) → needs a moving-mask overlay. fade + slide already cover the common transitions. |
| **Beat-synced cuts** | MoneyPrinter pipeline / hyperframes | cut clips on music beats; needs a beat-detection step. |
| **Wipe transitions** | ffmpeg xfade wipe/circle | extend `transition` types with crop-based wipes. |

### ⛔ Not a fit
- Open-Generative-AI — 0 additive (cinematic vocab already mined).
- moviepy HeadBlur (moving-region blur) — niche; needs per-frame trajectory.
- Transition video generation (ViMax) — needs a gen API; covered by the gen-video hook.

## Batch 3 — excluded-repo rescan: manim / OpenShot / LosslessCut / GPUImage / diffusers (2026-06-23)
Workflow `wgq0l3n24` — rescanned EXCLUDED repos for portable NON-model utilities (recipe-only for GPL/iOS).

### ✅ Integrated
| Technique | From | Where |
|---|---|---|
| **Per-clip color grading + film grain** | OpenShot `color_presets` / `film_grain_presets` (recipe) | `Clip.color` {brightness,contrast,saturation,gamma,temperature,grain} → `render._color_filters` ffmpeg `eq`/`colortemperature`/`noise`; `COLOR_PRESETS` (warm/cool/vivid/cinematic/bw/film35); settable via `set_clip_properties`/MCP. **Render-verified** (bw grade → grayscale). |
| **5 more easing functions** | manim `rate_functions` (MIT) | `keyframes`: `ease_in`/`ease_out`/`ease_in_out`/`there_and_back`/`rush_into`/`overshoot` added to `INTERP`; generalized the spring "bake → RDP → linear" path to all eased curves (`_curve` + `_BAKED`). **Verified** (ease_in slow-start, there_and_back pendulum). |

### ⛔ Not integrated (with reason)
- **manim bezier / smooth-quadratic-path** — needs scipy/fontTools; the existing easings + Ken-Burns cover the need. Low ROI.
- **manim color interp** — needs the `colour` package; ffmpeg `colortemperature`/`eq` already covers grading.
- **LosslessCut smart-cut / segment recipes** — keyframe-aware lossless trimming; ClipPilot's clip/trim/concat covers the gen use-case (lossless re-cut is an editing-app nicety, lower value for generated shorts). Documented.
- **GPUImage shaders** — iOS GLSL; the useful color math is already covered by the `eq`/`curves`/`colortemperature` grading above.
- **diffusers** — model code only; no portable non-model utility.

## Sweep status — COMPLETE
Every `reusablecode/` app's SOURCE has now been mined: **palmier** (deep dive → full timeline editor), **batch 1** (MoneyPrinterTurbo/ShortGPT/Pixelle/remotion/hyperframes), **batch 2** (MoneyPrinter/MoneyPrinterPlus/moviepy/Open-Generative-AI/ViMax), **batch 3** (manim/OpenShot/LosslessCut/GPUImage/diffusers) — on top of the original code-verified audit in [`03-tool-inventory.md`](03-tool-inventory.md) + [`08-reuse-map.md`](08-reuse-map.md). The pure **GPU-model** repos (Open-Sora, Wan2.2, LTX-Video, AnimateAnyone, Deep-Live-Cam, video-retalking, Duix-Avatar, diffusers) are model-inference pipelines with no portable non-model utility — their *capability* is offered via the opt-in hosted-API gen hooks. Learning repos (Hello-Python, open-source-cs) and the MoneyPrinterTurbo duplicate carry nothing to integrate. **All portable functionality across all 32 repos is now integrated or documented-excluded.**
