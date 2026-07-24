# -*- coding: utf-8 -*-
"""Z-Image-Turbo batch image generator for the ClipPilot pipeline.

Runs inside imggen-env (torch cu128 + local diffusers-main). Loads the 6B model
ONCE (4-bit transformer + 4-bit Qwen3 text encoder + model CPU offload to fit a
6GB RTX 2060), then renders every prompt in a JSON job file. Designed so the
whole 519-video batch can share a single model load.

Job file format (UTF-8 JSON):
{
  "defaults": {"height": 1344, "width": 768, "steps": 8, "guidance": 1.0,
               "negative": "text, watermark, ...", "seed": 0},
  "jobs": [{"prompt": "...", "out": "C:/.../scene_01.png", "seed": 12},
           {"prompt": "...", "out": "C:/.../scene_02.png"}]
}
Each job inherits defaults; per-job keys (seed/height/width/steps/guidance) override.
Already-existing outputs are skipped unless --force.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel
from diffusers import BitsAndBytesConfig as DBnB
from transformers import BitsAndBytesConfig as TBnB, Qwen3Model

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = os.environ.get(
    "ZIMAGE_MODEL_DIR",
    str(_PROJECT_ROOT / "models" / "Z-Image-Turbo")
)
# fp16, NOT bf16: the RTX 2060 (Turing) has no bf16 tensor cores, so bf16 runs
# ~14x slower (22s/step vs 1.6s/step). fp16 is fast but overflows this bf16-trained
# 6B DiT (Qwen3 text tokens reach magnitude ~14000) -> the clamp hooks below keep
# every layer's output in fp16-safe range, giving fp16 speed with stable output.
COMPUTE = torch.float16
FP16_MAX = 60000.0
DEFAULT_NEG = ("text, words, letters, watermark, signature, logo, caption, "
               "blurry, low quality, jpeg artifacts, distorted, deformed, "
               "extra limbs, extra fingers, bad anatomy, disfigured, ugly")


def _clamp_hook(module, inputs, output):
    """Keep each layer's output finite and within fp16 range to stop overflow->NaN."""
    if torch.is_tensor(output) and output.is_floating_point():
        return torch.nan_to_num(output, nan=0.0, posinf=FP16_MAX, neginf=-FP16_MAX).clamp_(-FP16_MAX, FP16_MAX)
    if isinstance(output, tuple):
        return tuple(
            torch.nan_to_num(o, nan=0.0, posinf=FP16_MAX, neginf=-FP16_MAX).clamp_(-FP16_MAX, FP16_MAX)
            if torch.is_tensor(o) and o.is_floating_point() else o
            for o in output
        )
    return output


def load_pipe(model_path: str) -> ZImagePipeline:
    t0 = time.time()
    print(f"[load] 4-bit transformer from {model_path} ...", flush=True)
    transformer = ZImageTransformer2DModel.from_pretrained(
        model_path, subfolder="transformer",
        quantization_config=DBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                 bnb_4bit_compute_dtype=COMPUTE),
        torch_dtype=COMPUTE,
    )
    print("[load] 4-bit Qwen3 text encoder ...", flush=True)
    text_encoder = Qwen3Model.from_pretrained(
        model_path, subfolder="text_encoder",
        quantization_config=TBnB(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                 bnb_4bit_compute_dtype=COMPUTE),
        torch_dtype=COMPUTE,
    )
    print("[load] assembling pipeline ...", flush=True)
    pipe = ZImagePipeline.from_pretrained(
        model_path, transformer=transformer, text_encoder=text_encoder,
        torch_dtype=COMPUTE,
    )
    pipe.vae.to(torch.float32)  # fp16 VAE decodes to black; keep it fp32 (it's tiny)
    # Clamp every transformer layer's output to fp16-safe range (overflow fix).
    hooked = 0
    for m in pipe.transformer.modules():
        if not list(m.children()):
            m.register_forward_hook(_clamp_hook)
            hooked += 1
    pipe.enable_model_cpu_offload()
    pipe.set_progress_bar_config(disable=True)
    print(f"[load] ready in {time.time() - t0:.0f}s ({hooked} clamp hooks)", flush=True)
    return pipe


def generate(pipe: ZImagePipeline, job: dict, defaults: dict, force: bool) -> bool:
    out = Path(job["out"])
    if out.exists() and not force:
        print(f"[skip] exists: {out.name}", flush=True)
        return True
    out.parent.mkdir(parents=True, exist_ok=True)

    h = int(job.get("height", defaults.get("height", 1344)))
    w = int(job.get("width", defaults.get("width", 768)))
    steps = int(job.get("steps", defaults.get("steps", 8)))
    guidance = float(job.get("guidance", defaults.get("guidance", 1.0)))
    neg = job.get("negative", defaults.get("negative", DEFAULT_NEG))
    seed = int(job.get("seed", defaults.get("seed", 0)))

    t0 = time.time()
    try:
        img = pipe(
            job["prompt"],
            negative_prompt=neg,
            num_inference_steps=steps,
            guidance_scale=guidance,
            height=h, width=w,
            generator=torch.Generator("cuda").manual_seed(seed),
        ).images[0]
    except Exception as exc:  # keep the batch alive
        print(f"[FAIL] {out.name}: {type(exc).__name__}: {exc}", flush=True)
        return False
    img.save(out)
    peak = torch.cuda.max_memory_allocated() / 1e6
    torch.cuda.reset_peak_memory_stats()
    print(f"[ok] {out.name}  {w}x{h} {steps}step g{guidance}  "
          f"{time.time() - t0:.1f}s  peakVRAM {peak:.0f}MB", flush=True)
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", required=True, help="path to jobs JSON")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--force", action="store_true", help="regenerate even if output exists")
    args = ap.parse_args()

    spec = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    defaults = spec.get("defaults", {})
    jobs = spec["jobs"]
    print(f"cuda: {torch.cuda.is_available()} {torch.cuda.get_device_name(0)}")
    print(f"[batch] {len(jobs)} image(s) to render")

    pipe = load_pipe(args.model)
    torch.cuda.reset_peak_memory_stats()

    ok = 0
    t0 = time.time()
    for i, job in enumerate(jobs, 1):
        print(f"--- [{i}/{len(jobs)}] ---", flush=True)
        if generate(pipe, job, defaults, args.force):
            ok += 1
    print(f"[batch] done: {ok}/{len(jobs)} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
