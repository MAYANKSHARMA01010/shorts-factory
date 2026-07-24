# -*- coding: utf-8 -*-
"""Fix fp16 overflow with per-module output clamping (nan_to_num to fp16-safe
range) so the fast Turing fp16 path produces valid images. Verifies validity +
speed at 512 and 768."""
import io, sys, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import numpy as np
import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from diffusers import BitsAndBytesConfig as DBnB
from transformers import BitsAndBytesConfig as TBnB, Qwen3Model

import os, tempfile; from pathlib import Path as _P
_ROOT = _P(__file__).resolve().parents[2]
REPO = os.environ.get("ZIMAGE_MODEL_DIR", str(_ROOT / "models" / "Z-Image-Turbo"))
C = torch.float16
SCRATCH = os.environ.get("SHORTS_SCRATCH", tempfile.gettempdir())
PROMPT = ("a cinematic photorealistic film still of an elderly zookeeper pressing his "
          "forehead against a gentle elephant in a sunlit sanctuary, golden light, emotional, detailed")
NEG = "text, watermark, blurry, low quality, deformed"
FP16_MAX = 60000.0


def clamp_hook(module, inputs, output):
    if torch.is_tensor(output) and output.is_floating_point():
        return torch.nan_to_num(output, nan=0.0, posinf=FP16_MAX, neginf=-FP16_MAX).clamp_(-FP16_MAX, FP16_MAX)
    if isinstance(output, tuple):
        new = []
        for o in output:
            if torch.is_tensor(o) and o.is_floating_point():
                o = torch.nan_to_num(o, nan=0.0, posinf=FP16_MAX, neginf=-FP16_MAX).clamp_(-FP16_MAX, FP16_MAX)
            new.append(o)
        return tuple(new)
    return output


transformer = ZImageTransformer2DModel.from_pretrained(
    REPO, subfolder="transformer",
    quantization_config=DBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=C),
    torch_dtype=C)
text_encoder = Qwen3Model.from_pretrained(
    REPO, subfolder="text_encoder",
    quantization_config=TBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=C),
    torch_dtype=C)
pipe = ZImagePipeline.from_pretrained(REPO, transformer=transformer, text_encoder=text_encoder, torch_dtype=C)
pipe.vae.to(torch.float32)
pipe.enable_model_cpu_offload()

# Clamp every leaf module's output in the transformer.
n = 0
for m in pipe.transformer.modules():
    if len(list(m.children())) == 0:
        m.register_forward_hook(clamp_hook)
        n += 1
print(f"[ready] hooked {n} leaf modules", flush=True)


def go(w, h, steps, tag, save=False):
    torch.cuda.reset_peak_memory_stats()
    t = time.time()
    out = pipe(PROMPT, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=1.0,
               height=h, width=w, generator=torch.Generator("cuda").manual_seed(7))
    dt = time.time() - t
    arr = np.asarray(out.images[0]).astype(np.float32)
    peak = torch.cuda.max_memory_allocated() / 1e6
    print(f"[{tag}] {w}x{h} {steps}st -> {dt:.1f}s ({dt/steps:.2f}s/step) peak {peak:.0f}MB "
          f"meanpix={arr.mean():.1f} std={arr.std():.1f}", flush=True)
    if save:
        p = f"{SCRATCH}\\clamp_{tag}.png"
        out.images[0].save(p)
        print(f"   saved {p}", flush=True)


go(512, 512, 8, "warmup")
go(512, 512, 8, "512", save=True)
go(768, 1344, 8, "768x1344", save=True)
print("[done]", flush=True)
