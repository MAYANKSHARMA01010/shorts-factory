---
name: punchy-recut
description: DEPRECATED — merged into the `ultimate-short` skill. The pacing speed-up, fast cuts, scene-matched SFX, and the gameplay split-screen "brainrot" stack are now documented in ultimate-short/SKILL.md ("FINISHING LAYER"). The driver scripts (recut.py, stack_gameplay.py) still live in THIS folder and are still invoked by path, so existing commands keep working. Use ultimate-short for any new work.
---

# punchy-recut — merged into `ultimate-short`

This skill has been folded into the single end-to-end **`ultimate-short`** skill. All its
documentation — the owner pacing preference (`--punch 0 --no-swell --speed 1.12 --sfx-every 2`),
the per-video SFX variation rules, the scene-matched SFX palette + library map, the
split-screen gameplay stack, the full `recut.py` flag reference, the recut gotchas, and the
verify recipes — now lives in **`.claude/skills/ultimate-short/SKILL.md`** under the
**"FINISHING LAYER"** section.

**The scripts stay here** (they are NOT moved), so every existing path call keeps working:

```bash
# pacing + scene-matched SFX recut (e.g. the reimagined-shorts build pipeline calls this exact path)
python ".claude/skills/punchy-recut/recut.py" --input "<short>.mp4" --punch 0 --no-swell --speed 1.12 --sfx-every 2 --cut-sfx "<topic-matched files>"

# optional split-screen gameplay "brainrot" stack (last stage)
python ".claude/skills/punchy-recut/stack_gameplay.py" --input "<short>_punchy.mp4" --gameplay-dir "downloads/gta5-gameplay"
```

- `recut.py` — speed-up (pitch-preserved) + fast cuts + scene-matched SFX bed over untouched narration.
- `stack_gameplay.py` — stack the finished short over a random, muted gameplay clip (9:16 split-screen).

For usage, flags, the SFX palette, and all gotchas, **see `ultimate-short/SKILL.md` → FINISHING LAYER.**
