# -*- coding: utf-8 -*-
"""Absolute paths to the external render engines + cheap availability probes.

Engines are referenced by path (never copied), mirroring how pipeline.py references
Z-Image / Chatterbox. A missing/uninstalled engine just makes its renderer unavailable,
and the caller falls back to the Z-Image still — the pipeline never fails.
"""
from __future__ import annotations

import shutil
from pathlib import Path

# renderers -> ultimate-short -> skills -> .claude -> Money making
PROJECT_ROOT = Path(__file__).resolve().parents[4]

HF_CLI = (PROJECT_ROOT / "reusablecode" / "hyperframes-main" / "hyperframes-main"
          / "packages" / "cli" / "dist" / "cli.js")

REMOTION_PROJECT = PROJECT_ROOT / "ClipPilot" / "remotion_explainer"
REMOTION_THREE = REMOTION_PROJECT / "node_modules" / "@remotion" / "three"
REMOTION_BEAT_ENTRY = REMOTION_PROJECT / "src" / "beat-index.tsx"
# Call the Remotion CLI JS directly via `node` (Windows subprocess can't exec npx.cmd).
REMOTION_CLI = REMOTION_PROJECT / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"


def node_bin():
    return shutil.which("node")


def hyperframes_available() -> bool:
    return HF_CLI.exists() and node_bin() is not None


def remotion_r3f_available() -> bool:
    return (REMOTION_THREE.exists() and REMOTION_BEAT_ENTRY.exists()
            and REMOTION_CLI.exists() and node_bin() is not None)
