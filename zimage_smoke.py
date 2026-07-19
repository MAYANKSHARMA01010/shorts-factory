# -*- coding: utf-8 -*-
"""Z-Image-Turbo smoke test on 6GB VRAM: 4-bit transformer + 4-bit Qwen3 text
encoder + model CPU offload. Generates one image and reports VRAM + time."""
import io, sys, time, argparse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from diffusers import BitsAndBytesConfig as DBnB
from transformers import BitsAndBytesConfig as TBnB, Qwen3Model

import os
from pathlib import Path as _Path
_PROJECT_ROOT = _Path(__file__).resolve().parent
REPO = os.environ.get("ZIMAGE_MODEL_DIR", str(_PROJECT_ROOT / "models" / "Z-Image-Turbo"))
COMPUTE = torch.bfloat16


def load_pipe():
    t0 = time.time()
    print("Loading 4-bit transformer...", flush=True)
    transformer = ZImageTransformer2DModel.from_pretrained(
        REPO, subfolder="transformer",
        quantization_config=DBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                 bnb_4bit_compute_dtype=COMPUTE),
        torch_dtype=COMPUTE,
    )
    print("Loading 4-bit Qwen3 text encoder...", flush=True)
    text_encoder = Qwen3Model.from_pretrained(
        REPO, subfolder="text_encoder",
        quantization_config=TBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                 bnb_4bit_compute_dtype=COMPUTE),
        torch_dtype=COMPUTE,
    )
    print("Assembling pipeline...", flush=True)
    pipe = ZImagePipeline.from_pretrained(
        REPO, transformer=transformer, text_encoder=text_encoder, torch_dtype=COMPUTE,
    )
    pipe.enable_model_cpu_offload()
    print("Pipeline ready in {:.0f}s".format(time.time() - t0), flush=True)
    return pipe


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", default="A cinematic photorealistic film still of a red sports "
                    "car speeding down a rainy night highway, dramatic moody lighting, "
                    "headlights glaring, highly detailed, depth of field, 8k")
    ap.add_argument("--out", default=str(_Path(__file__).resolve().parent / "output" / "zimage_test.png"))
    ap.add_argument("--h", type=int, default=768)
    ap.add_argument("--w", type=int, default=768)
    ap.add_argument("--steps", type=int, default=8)
    args = ap.parse_args()

    print("cuda:", torch.cuda.is_available(), torch.cuda.get_device_name(0))
    torch.cuda.reset_peak_memory_stats()
    pipe = load_pipe()

    neg = "text, watermark, logo, blurry, low quality, distorted, deformed, extra limbs"
    t1 = time.time()
    img = pipe(args.prompt, negative_prompt=neg, num_inference_steps=args.steps,
               guidance_scale=1.0, height=args.h, width=args.w,
               generator=torch.Generator("cuda").manual_seed(0)).images[0]
    gen = time.time() - t1
    img.save(args.out)
    print("Generated {}x{} in {:.1f}s -> {}".format(args.w, args.h, gen, args.out))
    print("Peak VRAM: {:.0f} MB / 6144 MB".format(torch.cuda.max_memory_allocated() / 1e6))


if __name__ == "__main__":
    main()
