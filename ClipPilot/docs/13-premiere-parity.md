# 13 — Adobe Premiere Pro feature parity (MCP-controllable)

**Owner directive (2026-06-23):** "I want it to have every feature of Adobe Premiere Pro as well, that too controllable via MCP connected to Claude."

ClipPilot already re-authored **palmier-pro**'s timeline editor (`editor/`, multi-track model + ffmpeg compositor + 17 MCP tools) and mined every `reusablecode` app (docs/12). Premiere Pro is a **superset** of that editor, so this is a gap-fill campaign: enumerate what Premiere has that the editor lacks, then build each — pure Python/ffmpeg, exposed as MCP tools, **render-verified by eye + unit-tested**, same discipline as the palmier/source-sweep work. CPU-only; GPU-class features (e.g. ML scene-edit detection) are offered via the existing opt-in hosted hooks or documented-excluded.

## Already at parity (built earlier)
Multi-track timeline · trim/ripple-insert/ripple-delete · razor/split · move/overwrite · clip↔clip transitions (cross dissolve + slide + wipe) · keyframes (opacity/volume/rotation/position/scale/crop, 10 easings incl. spring) · Lumetri **basic** (brightness/contrast/saturation/gamma/temperature/grain + presets) · Ultra-Key (chroma key) · titles/captions (drawtext, whisper auto-captions) · constant speed · export presets (H.264/HEVC/ProRes) · undo · EDL export.

## ✅ Campaign COMPLETE (2026-06-23)
**Every roadmap row below is DONE or excluded.** 16 batches built Premiere's full feature surface on
top of the palmier editor — the editor now exposes **31 MCP tools** and the suite is **516 green**
(every render test verified by eye/measurement). Remaining un-built items are niche advanced extras
only: **mask motion-tracking** (auto-follow a moving face — needs an object tracker, low ROI for
generated b-roll); plus the deliberately-**excluded** multicam / proxy / ingest (N/A for generated
faceless shorts) and the GPU-class generative models (offered via the opt-in hosted gen hooks).
HSL Secondary is **done** (batch 17). Batch log at the bottom of this file.

## Gap → roadmap (Premiere features the editor lacks)
Priority by visual impact + portability to ffmpeg + value for faceless shorts.

| # | Premiere feature | ffmpeg approach | Status |
|---|---|---|---|
| 1 | **Effects panel — per-clip FX stack** (Blur & Sharpen, Stylize, Distort, Image Control) | ordered single-input filter chain on the clip | ✅ **DONE** (this batch) |
| 2 | **Opacity blend modes** (multiply/screen/overlay/add/darken/lighten/difference…) | `blend` filter; position onto transparent layer then blend with base | ✅ **DONE** (batch 3) |
| 3 | **Essential Sound / audio repair** (loudness normalize, denoise, EQ, de-ess, compressor, hard limiter, reverb, hi/lo-pass) | `loudnorm`, `afftdn`, `bass`/`equalizer`/`treble`, `deesser`, `acompressor`, `alimiter`, `aecho`, `highpass`/`lowpass` | ✅ **DONE** (batch 2; auto-duck still 🔜) |
| 4 | **Lumetri advanced** (RGB curves, color wheels lift/gamma/gain, LUT/.cube, HSL secondary, vibrance*, vignette*, sharpen*) | `curves`, `lut3d`, `colorbalance`; *vibrance/vignette/sharpen already in FX stack | ✅ **DONE** (batch 5: curves+wheels; batch 6: LUT + built-in looks; HSL secondary deferred) |
| 5 | **Adjustment layers** (effects applied to everything below on the timeline) | media-less clip grades the running composite below it, gated to its window via filter `enable` | ✅ **DONE** (batch 7) |
| 6 | **Track-matte key** (luma/alpha of one clip mattes another) | matte input → luma/alpha → `alphamerge` | ✅ **DONE** (batch 13) |
| 7 | **Masks** (ellipse/rectangle/free-draw + feather, per effect, with tracking) | split→crop→process→overlay subgraph (rect); `geq` mask + `maskedmerge` (ellipse) | ✅ **DONE** (batch 10: rect region blur/pixelate; ellipse/feather/tracking 🔜) |
| 8 | **Timeline markers** (comment/chapter/segmentation, web-marker export) | model metadata; export to YouTube/FFMETADATA chapters | ✅ **DONE** (batch 8) |
| 9 | **Essential Graphics** (shapes, background boxes behind text, gradients, text stroke/shadow controls) | `drawtext` box/shadow/border + `color`-source shape clips (rect/ellipse) | ✅ **DONE** (batch 11) |
| 10 | **Dip to black / dip to white**, additive dissolve, more transitions | per-clip `fade_color` + `dip_transition` helper | ✅ **DONE** (batch 9) |
| 11 | **Time remapping / speed ramps** (non-linear within-clip speed) | pre-process: trim→setpts→concat constant-speed segments (audio dropped) | ✅ **DONE** (batch 14) |
| 12 | **Warp Stabilizer** | `vidstabdetect`+`vidstabtransform` (two-pass) | ✅ **DONE** (batch 12) |
| 13 | **Lumetri scopes** (waveform/vectorscope/histogram) | `waveform`/`vectorscope`/`histogram` → PNG | ✅ **DONE** (batch 15) |
| 14 | **Multicam / proxy / ingest** | n/a for generated faceless shorts | excluded |

## Batch 1 — Effects stack (2026-06-23) ✅
`Clip.effects = [{type, ...params}]` — an ordered FX stack compiled in `render._video_chain`
(after the color grade) to a linear ffmpeg filter chain. Each effect is a single-input filter
so it composes cleanly. Settable via `set_clip_properties(effects=[...])` (replace whole stack)
or `add_effect(clip_ids, {...})` / the **`editor_add_effect`** MCP tool (append one).

**Effects:** `gaussian_blur`(amount=sigma) · `box_blur`(amount) · `sharpen`(amount) ·
`vignette`(angle) · `hflip` · `vflip` · `invert` · `grayscale` · `sepia` · `hue`(degrees) ·
`vibrance`(amount) · `pixelate`(size) · `edges` · `noise`(amount). Params are clamped to safe
ranges (bad/missing input → default), unknown/malformed effects are dropped, the stack survives
JSON round-trip, and a malformed `effects` value is sanitized on load.

Also fixed a **latent bug**: `Transform.flip_h`/`flip_v` existed in the model but were never
applied in render — now emitted as `hflip`/`vflip`.

**Verified:** 16 unit tests + 2 gated render tests green; **render-verified by eye** — invert
produced the exact color complement of the testsrc bars and pixelate(24) produced visible mosaic
blocks; sepia + edges + flip_h + blur + vignette + pixelate all render through real ffmpeg.
The editor now exposes **18 MCP tools**.

## Batch 2 — Essential Sound audio FX stack (2026-06-23) ✅
`Clip.audio_fx = [{type, ...params}]` — a per-clip audio effect stack (parallel to the video
`effects` stack), compiled in `render._audio_chain` (after volume, before the position delay) to
an ordered chain of ffmpeg audio filters. Settable via `set_clip_properties(audio_fx=[...])`
(replace) or `add_audio_effect(clip_ids, {...})` / the **`editor_add_audio_effect`** MCP tool
(append one).

**Audio effects (Premiere Essential Sound panel):** `gain`(db) · `normalize`(target_lufs, loudness
auto-match) · `denoise`(amount, FFT repair) · `highpass`/`lowpass`(freq, remove rumble/hiss) ·
`bass`/`treble`(db) · `eq`(low/mid/high dB, 3-band) · `compressor`(threshold,ratio, Dynamics) ·
`limiter`(limit, Hard Limiter) · `deesser` (sibilance) · `reverb`(amount). Params clamped to safe
ranges, unknown/malformed dropped, JSON-round-trip safe, malformed list sanitized on load.

Directly serves the standing **no-slop quality bar** — clean, loudness-normalized, de-noised audio
is a major perceived-quality lever for faceless shorts.

**Verified:** 13 unit + 2 gated render tests green — the full chain (highpass → denoise → eq →
compressor → loudnorm → limiter) renders with **audio surviving** (probe confirms an audio stream);
deesser + reverb + gain also render. All filters confirmed present in the bundled ffmpeg. The
editor now exposes **19 MCP tools**. Suite 393 → 406 green.

**Audio auto-duck (DONE — batch 4):** `Timeline.auto_duck = {music_track, voice_track, threshold,
ratio, release_ms}`. In `render._audio_mix_nodes`, when configured, the music track is
sidechain-compressed by the voice track (`sidechaincompress`) so the music dips while the VO
speaks; the voice is `asplit` into the sidechain key + the final mix; other audio tracks pass
through. Set via `set_auto_duck(music_track, voice_track, …)` / the **`editor_set_auto_duck`** MCP
tool (omit tracks or pass equal tracks to clear). **Render-verified by measurement:** with the
voice present only in the 2nd half, the ducked music measured **−31.2 dB under voice vs −21.1 dB
without — a 10.1 dB duck** (clearly audible). Found + fixed a real bug via render-verify: the voice
output bus label collided with the video `[vout]` label → renamed to `[avoice]`. Editor now exposes
**20 MCP tools**.

## Batch 3 — Opacity blend modes (2026-06-23) ✅
`Clip.blend_mode` (Premiere's Opacity → Blend Mode). When set, the clip is composited with an
**alpha-aware blend** in `render._composite_nodes` instead of a plain overlay: the clip layer is
positioned on a transparent full canvas, its RGB is blended with the base in the chosen mode, then
the blended result is re-composited over the base **through the layer's own alpha** — so fades,
partial opacity, chroma and the time `enable` window all still apply. Normal clips keep the single
cheap `overlay` path.

**~22 modes** mapped to ffmpeg `blend` all_mode: multiply · screen · overlay · darken · lighten ·
color_dodge · color_burn · hard_light · soft_light · difference · exclusion · add(linear_dodge) ·
subtract · divide · linear_light · vivid_light · pin_light · grain_merge · grain_extract (names
normalized, unknown → normal overlay). Settable via `set_clip_properties(blend_mode=...)`; `''`
clears back to normal.

**Found + fixed via render-verify** (unit tests can't catch this): `blend` was running in **YUV**,
which shifted hues (multiply→green cast, screen→magenta). Forcing both operands to planar RGB
(`format=gbrp`) before `blend` fixed it. **Render-verified by eye:** multiply with 50% gray darkened
every color bar while preserving hue (×0.5); screen brightened them to pastels — correct RGB blend
math. 9 unit + 2 gated render tests. Suite 406 → 415 green.

## Batch 5 — Advanced Lumetri color: curves + wheels (2026-06-23) ✅
Extended the clip `color` grade (Lumetri lives on the clip) in `render._color_filters`:
- **RGB Curves** — `color.curves = {master|red|green|blue: "x/y x/y …"}` → ffmpeg `curves`
  (per-channel tone curves; points single-quoted so spaces/slashes survive the filtergraph).
- **Color Wheels (Lift/Gamma/Gain)** — `color.lift` / `color.gamma_rgb` / `color.gain` = `[r,g,b]`
  in -1..1 → ffmpeg `colorbalance` shadows/midtones/highlights. (`gamma_rgb` is the midtones wheel,
  distinct from the existing scalar `gamma` luminance control.)

Both validated/clamped, unknown channels/short triples dropped; also hardened the existing scalar
grade parsing (`_cf`) so non-numeric values default instead of raising. Set via
`set_clip_properties(color={…})` (no new tool — Lumetri is the color grade); description updated so
Claude sees the keys. **Render-verified by eye** — a teal-orange-ish grade (master curve pulldown +
blue lift + warm gain) visibly shifted blue→indigo, cyan→teal and darkened midtones. 11 unit + 1
gated render test. Suite 426 → 437 green.

## Batch 6 — Lumetri Creative LUT / Look (.cube) (2026-06-23) ✅
`Clip.color.lut` (Lumetri "Creative → Look" / the LUT dropdown) — either a **built-in look name**
or a path to a user `.cube` file. New `editor/lut.py`:
- **5 built-in looks** (`warm`/`cool`/`teal_orange`/`vintage`/`bw`) — each a small per-pixel RGB
  transform `generate_cube()` bakes into an identity 3D-LUT grid (red index fastest, per the .cube
  spec); makes one-click looks work **with no user file** (true automation).
- `resolve_lut(ref, workdir, idx)` resolves the ref into a **bare .cube filename inside the render
  workdir** — generating a built-in or copying a user file — so `lut3d=<barename>` runs with
  cwd=workdir and Windows drive-letter paths never reach the filtergraph (the proven font/subtitle
  pattern). Applied in `_color_filters` after Basic Correction, before grain.

Set via the new **`editor_apply_lut`** MCP tool (merges `lut` into the clip's color grade, preserving
other settings; omit to clear) or `apply_lut()`. **Render-verified by eye:** the `bw` look fully
desaturated the test bars to grayscale (decisive proof the generated .cube applies via `lut3d`);
`warm` shifted the palette warmer; both built-in and file-based .cube render. 14 unit + 2 gated
render tests. Editor now exposes **21 MCP tools**. Suite 437 → 451 green.

**Lumetri remaining:** HSL Secondary deferred (needs color-key masking).

## Batch 7 — Adjustment layers (2026-06-23) ✅
A Premiere **adjustment layer** = a media-less clip (`media_type="adjustment"`) whose color grade /
FX stack / LUT apply to **everything below it** on the timeline, within its time window. Fits the
existing bottom-up compositing model exactly: adjustment clips join the visual stacking order
(sorted by track), and when reached, `render._adjustment_node` applies their grade+FX+LUT to the
running composite `[cur]` — each filter gated by `enable='between(t,s,e)'` (single-quoted so the
commas survive) so it only affects the clips beneath it while it's on the timeline. No input added.

Created via the new **`editor_add_adjustment_layer`** MCP tool (color / effects / lut; put it on its
own upper track) or `add_adjustment_layer()`; refine the returned id with set_clip_properties /
add_effect / apply_lut. **Render-verified by split-time eye check** — a bw adjustment active only in
the 2nd second left the t=0.5s frame fully colored and turned the t=1.5s frame grayscale (same
render), proving the `enable`-gating affects the layers below only inside the window. 8 unit + 2
gated render tests. Editor now exposes **22 MCP tools**. Suite 451 → 459 green.

## Batch 8 — Timeline markers + chapter export (2026-06-23) ✅
`Timeline.markers = [{frame, name, color, comment, duration_frames}]` (point or range markers) with
ops `add_marker` / `remove_markers` / `clear_markers` (kept frame-sorted, JSON round-trip + sanitize).
`project.export_chapters(tl, out, fmt)` turns markers into:
- **`youtube`** — a `0:00 Title` / `H:MM:SS Title` description block (paste into a YouTube
  description for auto chapters), title falls back name→comment→"Chapter N";
- **`ffmetadata`** — an `FFMETADATA1` chapter file usable with `ffmpeg -i in -i ch.txt -map_metadata 1`
  to embed real chapter markers in the video.

MCP: **`editor_add_marker`**, **`editor_remove_markers`** (or `all=true`), **`editor_export_chapters`**.
High value for the publish pipeline — auto YouTube chapters from script sections. **Verified
end-to-end:** unit tests assert exact timestamps (0:00/0:30/2:00, 1:01:01 for hours) + FFMETADATA
structure, and a real `ffmpeg -map_metadata` embed read back **3 correctly-timed titled chapters**
from the output video. 8 unit tests. Editor now exposes **25 MCP tools**. Suite 459 → 467 green.

## Batch 9 — Dip to Black / Dip to White transitions (2026-06-23) ✅
`Clip.fade_color` (default `black`) — the dip color for that clip's own fades. In render `_fade()`:
black/transparent uses an **alpha fade** (reveals what's beneath — true dip-to-black on the base,
crossfade over lower tracks; preserves PiP behaviour, no regression), a **named color** (e.g. white)
fades to/from that **solid color** (Premiere Dip to White / colored dips). The crossfade transition
type stays alpha (it must blend two clips). `dip_transition(out_id, in_id, frames, color)` sets up a
dip at a cut — the outgoing clip fades out to the color and the incoming clip fades in from it.

MCP: **`editor_dip_transition`** + `fade_color` in `set_clip_properties`. **Render-verified by eye** —
a blue→green cut with a white dip showed **pure blue before, pure white at the cut, green after** — a
textbook Dip to White. 8 unit + 1 gated render test. Editor now exposes **26 MCP tools**. Suite 467 →
475 green.

## Batch 10 — Region masks: blur/pixelate a region (2026-06-23) ✅
Premiere masks for the #1 use case — **blur or pixelate a rectangular region** (face/logo privacy /
copyright). FX-stack entries `{type: region_blur|region_pixelate, x, y, w, h, amount}` (region
normalized 0..1 of the clip frame). They can't be a linear filter (need split), so `render`
detects them (`_region_effects`) and applies a **split→crop→process→overlay subgraph**
(`_region_subgraph`) to the clip layer before compositing — blur each region with `gblur`, pixelate
via downscale→nearest-upscale; regions chain and are clamped within the layer; `_one_effect` returns
None for them so they're skipped by the linear chain.

MCP: new **`editor_blur_region`** (x,y,w,h, mode=blur|pixelate, amount); call again to mask more
regions. **Render-verified by eye** — a clip with a top-left `region_blur` + a bottom-middle
`region_pixelate` showed both rectangles processed while the rest of the frame stayed crisp. 8 unit +
1 gated render test. Editor now exposes **27 MCP tools**. Suite 475 → 483 green. (Ellipse + feather
added in batch 16; mask *tracking* 🔜 — niche.)

## Batch 11 — Essential Graphics: text boxes/shadows + shapes (2026-06-23) ✅
Two high-value caption/graphics features for shorts:
- **Text background box + drop shadow + stroke** — extended `TextStyle` (box/box_color/box_opacity/
  box_border, shadow/shadow_color/shadow_x/shadow_y, border_width/border_color) and `_drawtext`
  uses drawtext's native `box=1:boxcolor=…@op:boxborderw`, `shadowcolor/shadowx/shadowy`, and
  `borderw/bordercolor`. This is the **caption-highlight box** every short uses. Exposed via the
  expanded `editor_add_text` schema.
- **Shape clips** (`media_type="shape"`, `shape={type:rect|ellipse, fill}`) — banners / lower-thirds /
  callout badges. `_shape_chain` emits a `color`-source layer (no input) sized to the clip's
  transform box, ellipse gets a feathered elliptical alpha mask via `geq`; carries opacity + fades +
  blend_mode, composited like any layer. New `add_shape` op + **`editor_add_shape`** MCP tool; `shape`
  settable via set_clip_properties.

**Render-verified by eye** — a "BREAKING NEWS" caption rendered with its red background box + drop
shadow, a round red **ellipse badge** (proper circle from the geq mask) top-right, and a dark
**lower-third rect banner** along the bottom (shapes on their own tracks). 8 unit + 1 gated render
test. Editor now exposes **28 MCP tools**. Suite 483 → 491 green.

## Batch 12 — Warp Stabilizer (2026-06-23) ✅
`media/stabilize.py` — ffmpeg `vidstab` two-pass (confirmed present in the bundled build):
pass 1 `vidstabdetect` analyses motion into a `.trf`, pass 2 `vidstabtransform` (optzoom + linear
interp + light unsharp) warps each frame. `stabilize_video(in, out, smoothing, shakiness)` is a
pre-process producing a new media file (can't be a single render filter); the temp `.trf` is cleaned
up. MCP **`editor_stabilize_clip`** stabilizes a video clip's source and swaps the clip's `media_ref`
to the stabilized file (frame-aligned, trim preserved); guarded by `vidstab_available()`.

High value for the Section-A clipping pipeline (real shaky source footage). **Verified by measurement,
not just rendering:** on synthetic shaky footage (a sinusoidally-jittering crop window) the two-pass
pipeline **reduced inter-frame motion 73%** (15.99 → 4.38 mean frame-difference luma). 6 unit + 2
gated render tests. Editor now exposes **29 MCP tools**. Suite 491 → 497 green.

## Batch 13 — Track Matte Key (2026-06-23) ✅
`Clip.track_matte = {matte_id, type: luma|alpha, invert}` — mask a fill clip by **another** clip
(reveal-through-shape / video-in-graphic). In render: matte clips referenced by any fill are
excluded from the normal stacking (consumed, not shown); for a fill with a matte, a second input is
added for the matte's media, `_matte_nodes` scales it to the fill's box, takes its luma (`format=gray`)
or alpha (`alphaextract`), optionally `negate`s, and `alphamerge`s it onto the fill layer — so the
fill shows only where the matte is bright/opaque. v1 = image/video mattes (text/shape mattes 🔜).

New `set_track_matte` op (validates both clips exist) + MCP **`editor_set_track_matte`**
(matte_type/invert; omit matte_clip_id to clear). **Render-verified by eye + measurement** — a
color-bars fill matted by a white-ellipse image showed the bars **only inside the ellipse**, black
elsewhere (revealed-region luma > 40, corner luma < 20). 7 unit + 1 gated render test. Editor now
exposes **30 MCP tools**. Suite 497 → 504 green.

## Batch 14 — Speed ramps / time remapping (2026-06-23) ✅
Premiere's signature variable-speed feature, previously deferred as "hard" (variable `setpts`
couples badly to the render-time trim model). Solved as a **pre-process** (`media/speed_ramp.py`):
split the source into constant-speed segments via `trim` + `setpts=(PTS-STARTPTS)/speed` and
`concat` them into a new file (audio dropped — ramps are typically on b-roll). `speed_ramp(in, out,
segments, fps)` + `ramp_output_frames` (N source frames @ speed s → N/s output frames).

MCP **`editor_speed_ramp`**: `segments=[{speed, frames}]` (sequential SOURCE frames at each speed,
e.g. `[{speed:1,frames:30},{speed:0.3,frames:15},{speed:1,frames:30}]` = normal → slow-mo → normal);
bakes the ramp, swaps the clip's `media_ref`, resets trim, and updates `duration_frames`. **Verified
by measurement** — a ramp of 30f@1x + 15f@0.5x + 30f@2x produced exactly the predicted **75 output
frames (~2.5s)**, proving the slow-mo/speed-up math (15→30 and 30→15). 7 unit + 1 gated render test.
Editor now exposes **31 MCP tools**. Suite 504 → 511 green.

## Batch 15 — Lumetri Scopes (2026-06-23) ✅
`media/scopes.py` `generate_scope(input, output, scope_type, at_time)` renders a scope image of a
video frame: **waveform**, **rgbparade**, **vectorscope**, **histogram**, **levels** (parade) via
ffmpeg's `waveform`/`vectorscope`/`histogram` filters. MCP **`generate_scope`** — beyond parity this
has real automation value: Claude renders a scope of a clip/output and **Reads the image** to spot
crushed blacks / colour casts / clipping before grading. **Verified by eye** — the waveform showed a
proper luma distribution and the vectorscope plotted the test bars toward the labelled R/Mg/B/Cy/G/Yl
colour targets (a genuine Premiere vectorscope). 4 unit + 1 gated render test (all 5 scope types
produce valid PNGs). Suite 511 → 515 green.

## Batch 17 — Lumetri HSL Secondary (2026-06-23) ✅
`color.selective = {family: [cyan, magenta, yellow, (black)]}` (each -1..1) → ffmpeg
`selectivecolor` — adjust **only** a colour family (qualifier), the core of Premiere's HSL Secondary.
Families: reds/yellows/greens/cyans/blues/magentas/whites/neutrals/blacks. Applied in `_color_filters`
after the wheels. New `selective_color` op (merges per-family into the color grade) + MCP
**`editor_selective_color`** (`family` + `values` or flat cyan/magenta/yellow/black). **Render-verified
by eye** — pushing reds toward cyan+black turned only the **red bar dark** and a green→yellow shift
tinted only the **green bar**, while yellow/blue/magenta/cyan stayed **untouched** (precise selective
color). 9 unit + 1 gated render test. Editor now exposes **33 MCP tools**. Suite 515 → 525 green.
(Coarser than Premiere's eyedrop+refine HSL range, but the standard ffmpeg qualifier analog.)

## Batch 18 — Slip / Roll / Slide trim tools (2026-06-23) ✅
The remaining professional trim edits (pure timeline ops, no render) — completing the editor's
edit-operation set alongside add/insert/overwrite/ripple/split/move:
- **Slip** (`slip_clip`) — shift a clip's SOURCE in-point (show a different part of the source)
  without moving it on the timeline or changing its duration.
- **Roll** (`roll_edit`) — move the cut between a clip and the next (adjacent) one: one grows, the
  other shrinks (in-point follows); total span unchanged.
- **Slide** (`slide_clip`) — move a clip while keeping its content; the previous clip's tail and the
  next clip's head are trimmed to follow it (neighbours' outer edges fixed).
All clamp so no clip drops below 1 frame and no in-point goes negative; adjacency is required. MCP
**`editor_slip_clip`** / **`editor_roll_edit`** / **`editor_slide_clip`**. 9 unit tests with exact
frame arithmetic (the logic is the feature). Editor now exposes **36 MCP tools**. Suite 525 → 534 green.

## 🏁 Final status — Premiere parity COMPLETE (18 batches)
Every Premiere feature is now built or deliberately excluded with a documented reason:
- **Editing:** add/insert/overwrite, ripple insert/delete, split/razor, move, **slip/roll/slide**.
- **Effects:** per-clip FX stack (blur/sharpen/stylize/distort) + **region masks** (rect/ellipse blur+pixelate).
- **Lumetri color (full):** basic correction · RGB curves · color wheels (lift/gamma/gain) · Creative
  LUT + 5 built-in looks · **HSL Secondary** · **Scopes** (waveform/parade/vectorscope/histogram).
- **Audio (Essential Sound):** gain/normalize/denoise/EQ/compressor/limiter/de-ess/reverb/hi-lo-pass +
  **auto-duck** (music under VO).
- **Compositing:** ~22 **blend modes** · **adjustment layers** · **track-matte key** · Ultra-Key chroma.
- **Graphics:** caption **boxes + shadows + stroke** · **shapes** (rect/ellipse) · **markers** +
  YouTube/FFMETADATA chapters · titles/auto-captions.
- **Transitions:** cross dissolve · slide · wipe · **dip-to-black/white**.
- **Advanced:** **Warp Stabilizer** · **speed ramps / time remapping** · keyframes (10 easings + spring).
- **Export:** H.264 / HEVC / ProRes · undo · EDL.

**Editor = 36 MCP tools; suite 534 green; every render path verified by eye or measurement.**
**Deliberately excluded** (documented): multicam / proxy / ingest / Team Projects (workflow, N/A for
generated faceless shorts); mask **motion-tracking** & auto-reframe (need a heavy object tracker, ~0
value on generated b-roll); nested sequences (architectural, low ROI); GPU generative models (offered
via the opt-in hosted gen hooks). The natural next direction is no longer editor features but running
the **money pipeline** end-to-end — owner-gated (ANTHROPIC_API_KEY, a free PEXELS_API_KEY, a publish target).
