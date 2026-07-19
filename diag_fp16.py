# -*- coding: utf-8 -*-
"""Localize the fp16 NaN: check text-encoder embeds, per-step latents, and final
image. Also tests guidance_scale=0.0 (Turbo default, skips CFG path)."""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import numpy as np
import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from diffusers import BitsAndBytesConfig as DBnB
from transformers import BitsAndBytesConfig as TBnB, Qwen3Model

import os; from pathlib import Path as _P
_ROOT = _P(__file__).resolve().parent
REPO = os.environ.get("ZIMAGE_MODEL_DIR", str(_ROOT / "models" / "Z-Image-Turbo"))
C = torch.float16
PROMPT = "a cinematic photo of an elderly man and an elephant, golden light"


def stats(name, t):
    if t is None:
        print(f"  {name}: None"); return
    t = t.float()
    print(f"  {name}: shape={tuple(t.shape)} nan={torch.isnan(t).any().item()} "
          f"inf={torch.isinf(t).any().item()} min={t.min().item():.3g} "
          f"max={t.max().item():.3g} mean={t.mean().item():.3g}", flush=True)


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
print("[ready]", flush=True)

# 1) text-encoder embeddings
print("== encode_prompt ==", flush=True)
try:
    embeds = pipe.encode_prompt(PROMPT, device=pipe._execution_device)
    pe = embeds[0] if isinstance(embeds, (tuple, list)) else embeds
    if isinstance(pe, (list, tuple)):
        for i, e in enumerate(pe):
            stats(f"prompt_embed[{i}]", e if torch.is_tensor(e) else None)
    else:
        stats("prompt_embeds", pe if torch.is_tensor(pe) else None)
except Exception as e:
    print("  encode_prompt error:", type(e).__name__, e, flush=True)

# 2) per-step latents, guidance 0.0
first_bad = [None]
def cb(p, step, t, kw):
    lat = kw.get("latents")
    if lat is not None and (torch.isnan(lat).any() or torch.isinf(lat).any()) and first_bad[0] is None:
        first_bad[0] = step
        print(f"  !! NaN/Inf first at step {step}", flush=True)
    return kw

for g in (0.0, 1.0):
    first_bad[0] = None
    print(f"== generate guidance={g} ==", flush=True)
    out = pipe(PROMPT, num_inference_steps=8, guidance_scale=g, height=512, width=512,
               generator=torch.Generator("cuda").manual_seed(0),
               callback_on_step_end=cb, callback_on_step_end_tensor_inputs=["latents"])
    arr = np.asarray(out.images[0]).astype(np.float32)
    print(f"  meanpix={arr.mean():.1f}  first_bad_step={first_bad[0]}", flush=True)

print("[done]", flush=True)
