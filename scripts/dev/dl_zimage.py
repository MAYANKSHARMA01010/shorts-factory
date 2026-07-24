# -*- coding: utf-8 -*-
"""Background downloader for Z-Image-Turbo (full diffusers repo, ~32.9GB) -> flat local_dir."""
import io, os, sys, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
from huggingface_hub import snapshot_download

import os
from pathlib import Path as _Path
_PROJECT_ROOT = _Path(__file__).resolve().parents[2]
TARGET = os.environ.get("ZIMAGE_MODEL_DIR", str(_PROJECT_ROOT / "models" / "Z-Image-Turbo"))
t0 = time.time()
print("Downloading Tongyi-MAI/Z-Image-Turbo (~32.9GB) -> {}".format(TARGET), flush=True)
path = snapshot_download(
    "Tongyi-MAI/Z-Image-Turbo",
    local_dir=TARGET,
    allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model", "tokenizer*", "merges*", "vocab*"],
    max_workers=4,
)
print("DOWNLOAD_COMPLETE in {:.0f}s -> {}".format(time.time() - t0, path), flush=True)
