"""Optional hosted text-to-video generation hook — palmier `generateVideo` parity.

ClipPilot is CPU-only, so the GPU video models (Open-Sora, Wan2.2, LTX-Video, …) can't
run locally; this is the honest alternative: when a hosted video API is configured,
generate a clip from a cinematic prompt for the editor/Section-B. Vendor-neutral —
point it at any endpoint that returns a video URL (fal.ai, Replicate-style gateways,
or an OpenAI-images-shaped video API). No key → no-op (callers fall back).

Env: GEN_VIDEO_API_KEY (required), GEN_VIDEO_ENDPOINT, GEN_VIDEO_MODEL, GEN_VIDEO_SIZE.
NOTE: assumes a SYNCHRONOUS endpoint that returns a URL in the response; provider-
specific async polling is out of scope for the generic hook.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

_DEFAULT_ENDPOINT = "https://api.openai.com/v1/videos/generations"
_DEFAULT_MODEL = "sora-2"


def gen_video_available() -> bool:
    return bool(os.environ.get("GEN_VIDEO_API_KEY"))


def _parse_video_response(data: dict[str, Any]) -> Optional[str]:
    """Pull a video URL from common hosted-API response shapes."""
    if not isinstance(data, dict):
        return None
    # data: [{url}] (OpenAI-images shape)
    items = data.get("data")
    if isinstance(items, list) and items and isinstance(items[0], dict) and items[0].get("url"):
        return items[0]["url"]
    # video: {url} / output: url|[url] / url
    vid = data.get("video")
    if isinstance(vid, dict) and vid.get("url"):
        return vid["url"]
    out = data.get("output")
    if isinstance(out, str) and out.startswith("http"):
        return out
    if isinstance(out, list) and out and isinstance(out[0], str) and out[0].startswith("http"):
        return out[0]
    if isinstance(data.get("url"), str) and data["url"].startswith("http"):
        return data["url"]
    return None


def generate_video(prompt: str, out_path: str, duration: int = 5,
                   aspect_ratio: str = "9:16") -> Optional[str]:
    """Generate one video for `prompt` to `out_path`. Returns the path or None."""
    key = os.environ.get("GEN_VIDEO_API_KEY")
    if not key:
        return None
    endpoint = os.environ.get("GEN_VIDEO_ENDPOINT", _DEFAULT_ENDPOINT)
    model = os.environ.get("GEN_VIDEO_MODEL", _DEFAULT_MODEL)
    size = os.environ.get("GEN_VIDEO_SIZE", "")
    body: dict[str, Any] = {"model": model, "prompt": prompt, "duration": duration,
                            "aspect_ratio": aspect_ratio}
    if size:
        body["size"] = size
    try:
        import httpx
        r = httpx.post(endpoint, headers={"Authorization": f"Bearer {key}"}, json=body, timeout=600)
        if r.status_code != 200:
            return None
        url = _parse_video_response(r.json())
        if not url:
            return None
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        rr = httpx.get(url, timeout=600, follow_redirects=True)
        if rr.status_code == 200 and rr.content:
            Path(out_path).write_bytes(rr.content)
            return out_path
    except Exception:  # noqa: BLE001 — network/auth/parse failure → fall back
        return None
    return None
