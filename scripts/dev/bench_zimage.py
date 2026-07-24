# -*- coding: utf-8 -*-
"""Benchmark Z-Image-Turbo speed on the 6GB RTX 2060 across resolutions/steps to
find a viable per-image time. Loads the model once, then times warmup + steady
state for each config. Per-step progress is left visible to expose the bottleneck."""
import io, sys, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from diffusers import BitsAndBytesConfig as DBnB
from transformers import BitsAndBytesConfig as TBnB, Qwen3Model

import os; from pathlib import Path as _P
_ROOT = _P(__file__).resolve().parents[2]
REPO = os.environ.get("ZIMAGE_MODEL_DIR", str(_ROOT / "models" / "Z-Image-Turbo"))
C = torch.bfloat16
PROMPT = ("a cinematic photorealistic film still of an elderly zookeeper pressing "
          "his forehead against a gentle elephant, golden light, emotional")
NEG = "text, watermark, blurry, low quality, deformed"

print("cuda:", torch.cuda.get_device_name(0), flush=True)
t0 = time.time()
transformer = ZImageTransformer2DModel.from_pretrained(
    REPO, subfolder="transformer",
    quantization_config=DBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=C),
    torch_dtype=C)
text_encoder = Qwen3Model.from_pretrained(
    REPO, subfolder="text_encoder",
    quantization_config=TBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=C),
    torch_dtype=C)
pipe = ZImagePipeline.from_pretrained(REPO, transformer=transformer, text_encoder=text_encoder, torch_dtype=C)
pipe.enable_model_cpu_offload()
try:
    pipe.vae.enable_slicing(); pipe.vae.enable_tiling()
except Exception as e:
    print("vae slicing n/a:", e)
print(f"[ready] {time.time()-t0:.0f}s", flush=True)


def bench(w, h, steps, tag):
    torch.cuda.reset_peak_memory_stats()
    t = time.time()
    try:
        pipe(PROMPT, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=1.0,
             height=h, width=w, generator=torch.Generator("cuda").manual_seed(0))
    except Exception as e:
        print(f"[{tag}] {w}x{h} {steps}st FAILED: {type(e).__name__}: {e}", flush=True)
        return
    dt = time.time() - t
    peak = torch.cuda.max_memory_allocated() / 1e6
    print(f"[{tag}] {w}x{h} {steps}st -> {dt:.1f}s  ({dt/steps:.1f}s/step)  peak {peak:.0f}MB", flush=True)


# Warmup (first call pays one-time kernel/autotune cost), then steady-state timings.
bench(512, 512, 8, "warmup")
bench(512, 512, 8, "512sq")
bench(448, 768, 8, "448x768")
bench(512, 512, 6, "512-6st")
bench(512, 512, 4, "512-4st")
print("[done]", flush=True)
