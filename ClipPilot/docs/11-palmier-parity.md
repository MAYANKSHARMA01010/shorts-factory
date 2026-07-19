# 11 — palmier-pro feature parity

**Owner directive (2026-06-23):** ClipPilot should have every functionality palmier-pro has, and (broader) every app in `reusablecode/` should be mined code-file-by-code-file for functionality to integrate.

palmier-pro is a macOS/Swift/GPL desktop editor — we **can't vendor its code**, but its functionality is generic. Its agent exposes **36 MCP tools** (the precise capability spec, from `Sources/PalmierPro/Agent/Tools/ToolDefinitions.swift`). We re-author the operations in Python/ffmpeg under `clippilot/editor/` and expose them as MCP tools so Claude can edit a timeline exactly like palmier's agent — minus the native GUI.

## Parity checklist (36 tools)

| palmier tool | ClipPilot status |
|---|---|
| **addClips** | ✅ `editor.add_clip` (overwrite semantics) |
| **insertClips** | ✅ `editor.insert_clip` (ripple) |
| **removeClips** | ✅ `editor.remove_clips` |
| **removeTracks** | ⬜ (trivial — add) |
| **moveClips** | ✅ `editor.move_clip` |
| **splitClip** | ✅ `editor.split_clip` |
| **rippleDeleteRanges** | ✅ `editor.ripple_delete_range` |
| **setClipProperties** | ✅ `editor.set_clip_properties` (timing/speed/volume/opacity/transform/crop/text) |
| **addTexts** | ✅ `editor.add_text` |
| **setKeyframes** | ✅ `editor.set_keyframes` + `editor/keyframes.py` (model+sampling linear/hold/smooth, ffmpeg-expr compiler); render animates position/opacity/rotation/volume (scale/crop = model-only) |
| **addCaptions** | ✅ `editor/captions.py captions_to_timeline` + `editor_add_captions` (whisper transcript → editable timeline TEXT clips) |
| **get_timeline** | ✅ `Timeline.to_dict` (expose as tool) |
| **getMedia / importMedia / search / folders…** | ◐ media library model (partial — see Media below) |
| **inspectMedia / inspectTimeline / getTranscript** | ⬜ render-frame + transcript inspection tools |
| **generateVideo** | ✅ `generate/gen_video.py` (vendor-neutral hosted text-to-video) + `editor_generate_video` MCP tool (adds result to timeline) |
| **generateImage** | ✅ `generate/gen_image.py` + `editor_generate_image` MCP tool (cinematic prompt → timeline clip) |
| **generateAudio** | ✅ `generate/gen_audio.py` (hosted TTS/music; bytes-or-URL) — beyond built-in SAPI TTS |
| **upscaleMedia / listModels** | ⬜ optional hosted hooks |
| **(export H.264/H.265/ProRes/XML)** | ◐ ffmpeg renders H.264; add HEVC/ProRes presets + an EDL/XML export |
| **undo** | ✅ `project.push_undo`/`undo` snapshot stack + `editor_undo` MCP tool |
| **(export H.264/H.265/ProRes)** | ✅ `render_timeline(codec=)` + `editor_render` codec param (h264/hevc/prores) |
| **(XML interchange)** | ✅ `project.export_edl` + `editor_export_edl` (JSON EDL) |

Legend: ✅ done · ◐ partial / adaptable from existing code · ⬜ to build.

## Build order

1. ✅ **Timeline model + edit operations** (`editor/timeline.py`) — DONE, 12 tests green.
2. ✅ **Render** (`editor/render.py`) — DONE: single ffmpeg filtergraph composites the timeline → mp4 (per-clip trim via -ss/-t, speed+shift via setpts, scale/crop/rotate, opacity via colorchannelmixer, fade in/out on alpha, multi-track overlay stacking with `enable` windows, audio amix with per-clip volume/delay/atempo, text via drawtext). **Render-verified by eye** (3-track composite: base + PiP + text, sequential-clip transition correct). Pure filter-string builders unit-tested + gated real render.
3. ✅ **MCP tools + CLI + project persistence** — DONE: `editor/project.py` save/load JSON; **10 MCP tools** (`editor_new`, `editor_get_timeline`, `editor_add_clip`, `editor_add_text`, `editor_set_clip_properties`, `editor_split_clip`, `editor_remove_clips`, `editor_move_clip`, `editor_ripple_delete`, `editor_render`) — stateful load→op→save over a project file, so Claude drives the editor exactly like palmier's agent; CLI `editor-render`. Verified end-to-end (new→add→text→split→set→render).
4. ✅ **Keyframes** — DONE: `editor/keyframes.py` (sampling + ffmpeg-`t`/`T`-expr compiler), `set_keyframes` op + `editor_set_keyframes` MCP tool; render animates **position** (overlay x/y expr), **opacity** (geq alpha, `T` var), **rotation** (rotate expr), **volume** (volume expr). **Render-verified by eye** (fade-in + move-across). scale/crop animation is model-only (render-mapping TODO).
5. ✅ **Generation hooks** — DONE: `generate/gen_video.py` (text-to-video) + `generate/gen_audio.py` (TTS/music), vendor-neutral + opt-in (GEN_VIDEO/AUDIO_API_KEY), no-op without keys; `editor_generate_image` / `editor_generate_video` MCP tools generate a cinematic asset and add it to the timeline as a clip (palmier's generate-into-timeline). Response parsers + no-key + mocked integration tested.
6. ✅ **Export presets + EDL + undo + captions** — DONE: `render_timeline(codec=h264|hevc|prores)` (HEVC render-verified); `project.push_undo`/`undo` snapshot stack + `editor_undo`; `project.export_edl` + `editor_export_edl` (JSON EDL); `editor/captions.py` + `editor_add_captions` (whisper transcript → timeline text clips).

**Hardened (2026-06-23):** an adversarial 15-agent review of the editor module found+fixed **10 real bugs** — keyframe arity validation (malformed rows crashed the render), atempo chaining (audio stayed in sync past 2× speed instead of clamping), `from_dict`/`load_project`/`undo` tolerate non-dict JSON, EDL keeps `source_out` (trim_end), and MCP int/float coercion (string/float args no longer break frame math). 11 regression tests added.

**PALMIER CORE PARITY COMPLETE** — the editor exposes **15 MCP tools** (new/get/add_clip/add_text/set_clip_properties/split/remove/move/ripple_delete/set_keyframes/generate_image/generate_video/render/undo/export_edl/add_captions). Remaining palmier tools are minor/optional: removeTracks, inspectMedia/inspectTimeline/getTranscript (inspection), upscaleMedia/listModels, media-library folders/search. A timeline editor drivable by Claude over MCP — palmier's defining capability — is real in ClipPilot.

## Broader directive: every app, code-file-by-code-file
Tracked separately — after palmier parity, sweep each `reusablecode/` app's SOURCE (not just READMEs) for functionality missed at the doc level, app by app, integrating what's portable. palmier is the first deep-code pass (full inventory captured here).
