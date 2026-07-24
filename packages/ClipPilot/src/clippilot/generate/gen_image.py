"""Optional hosted text-to-image generation hook (backlog #7).

ClipPilot runs CPU-only, so the GPU generative models in `reusablecode/` (Open-Sora,
Wan2.2, LTX-Video, diffusers, …) can't run locally. This is the honest alternative:
when a hosted image API is configured, generate ONE cinematic still per keyword (via
the cinematic prompt-builder) for Section-B b-roll.

Vendor-neutral — any OpenAI-images-compatible endpoint works (DALL·E and the many
gateways that mirror it). Configure with env:
  GEN_IMAGE_API_KEY   (required to activate; no key → no-op, falls back to stock b-roll)
  GEN_IMAGE_ENDPOINT  (default https://api.openai.com/v1/images/generations)
  GEN_IMAGE_MODEL     (default gpt-image-1)
  GEN_IMAGE_SIZE      (default 1024x1536 — portrait-ish for 9:16)
"""
from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any, Optional

_DEFAULT_ENDPOINT = "https://api.openai.com/v1/images/generations"
_DEFAULT_MODEL = "gpt-image-1"
_DEFAULT_SIZE = "1024x1536"


def gen_available() -> bool:
    return bool(os.environ.get("GEN_IMAGE_API_KEY"))


def _parse_image_response(data: dict[str, Any]) -> Optional[dict[str, str]]:
    """Pull the first image from an OpenAI-images-style response → {b64} or {url}."""
    items = (data or {}).get("data") or []
    if not items:
        return None
    first = items[0] or {}
    if first.get("b64_json"):
        return {"b64": first["b64_json"]}
    if first.get("url"):
        return {"url": first["url"]}
    return None


def generate_image(prompt: str, out_path: str) -> Optional[str]:
    """Generate one image for `prompt` to `out_path` via the configured hosted API.
    Returns the path or None (no key / network / parse failure)."""
    key = os.environ.get("GEN_IMAGE_API_KEY")
    if not key:
        return None
    endpoint = os.environ.get("GEN_IMAGE_ENDPOINT", _DEFAULT_ENDPOINT)
    model = os.environ.get("GEN_IMAGE_MODEL", _DEFAULT_MODEL)
    size = os.environ.get("GEN_IMAGE_SIZE", _DEFAULT_SIZE)
    try:
        import httpx
        r = httpx.post(endpoint, headers={"Authorization": f"Bearer {key}"},
                       json={"model": model, "prompt": prompt, "size": size, "n": 1},
                       timeout=120)
        if r.status_code != 200:
            return None
        img = _parse_image_response(r.json())
        if not img:
            return None
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        if "b64" in img:
            Path(out_path).write_bytes(base64.b64decode(img["b64"]))
            return out_path
        rr = httpx.get(img["url"], timeout=60, follow_redirects=True)
        if rr.status_code == 200 and rr.content:
            Path(out_path).write_bytes(rr.content)
            return out_path
    except Exception:  # noqa: BLE001 — network/auth/parse failure → fall back to stock
        return None
    return None


def generate_images(prompts: list[str], out_dir: str, max_items: int = 6) -> list[str]:
    """Generate a still per prompt (best-effort) → local image paths."""
    if not gen_available():
        return []
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for i, p in enumerate(prompts[:max_items]):
        out = str(Path(out_dir) / f"gen_{i:02d}.png")
        if generate_image(p, out):
            paths.append(out)
    return paths
