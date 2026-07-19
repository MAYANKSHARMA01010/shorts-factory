# -*- coding: utf-8 -*-
"""Test FP16 compute (Turing has fp16 tensor cores, NOT bf16) vs the slow bf16 path.
Hypothesis: switching 4-bit compute_dtype to float16 gives a large speedup on the
RTX 2060. Also verifies the image isn't NaN/black (fp16 VAE can need upcasting)."""
import io, sys, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import numpy as np
import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from diffusers import BitsAndBytesConfig as DBnB
from transformers import BitsAndBytesConfig as TBnB, Qwen3Model

import os, tempfile
from pathlib import Path as _Path
_PROJECT_ROOT = _Path(__file__).resolve().parent
REPO = os.environ.get("ZIMAGE_MODEL_DIR", str(_PROJECT_ROOT / "models" / "Z-Image-Turbo"))
C = torch.float16  # <-- the change under test
SCRATCH = os.environ.get("SHORTS_SCRATCH", tempfile.gettempdir())
PROMPT = ("a cinematic photorealistic film still of an elderly zookeeper pressing "
          "his forehead against a gentle elephant, golden light, emotional, detailed")
NEG = "text, watermark, blurry, low quality, deformed"

print("cuda:", torch.cuda.get_device_name(0), "compute:", C, flush=True)
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
# Keep VAE numerically safe in fp16 (avoid black/NaN decodes).
pipe.vae.to(torch.float32)
pipe.enable_model_cpu_offload()
try:
    pipe.vae.enable_slicing(); pipe.vae.enable_tiling()
except Exception as e:
    print("vae slicing n/a:", e)
print(f"[ready] {time.time()-t0:.0f}s", flush=True)


def bench(w, h, steps, tag, save=False):
    torch.cuda.reset_peak_memory_stats()
    t = time.time()
    try:
        out = pipe(PROMPT, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=1.0,
                   height=h, width=w, generator=torch.Generator("cuda").manual_seed(0))
    except Exception as e:
        print(f"[{tag}] {w}x{h} {steps}st FAILED: {type(e).__name__}: {e}", flush=True)
        return
    dt = time.time() - t
    peak = torch.cuda.max_memory_allocated() / 1e6
    img = out.images[0]
    arr = np.asarray(img)
    info = f"meanpix={arr.mean():.0f}"  # ~0 => black/NaN failure
    print(f"[{tag}] {w}x{h} {steps}st -> {dt:.1f}s  ({dt/steps:.2f}s/step)  peak {peak:.0f}MB  {info}", flush=True)
    if save:
        p = f"{SCRATCH}\\fp16_{tag}.png"
        img.save(p)
        print(f"   saved {p}", flush=True)


bench(512, 512, 8, "warmup")
bench(512, 512, 8, "512sq", save=True)
bench(768, 768, 8, "768sq", save=True)
bench(768, 1344, 8, "768x1344", save=True)
print("[done]", flush=True)
