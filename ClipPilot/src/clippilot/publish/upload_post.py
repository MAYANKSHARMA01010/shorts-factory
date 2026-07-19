"""Cross-platform publisher via the Upload-Post.com gateway.

Ported from MoneyPrinterTurbo `app/services/upload_post.py` (MIT, (c) 2024 Harry)
— one multipart POST cross-posts a single mp4 to YouTube Shorts + Instagram/FB
Reels + TikTok, sidestepping three separate OAuth integrations. Re-authored on
httpx (already a dependency via anthropic).

IMPORTANT (honest caveats, per docs/04 + the harvest):
- Upload-Post is a **PAID third-party SaaS gateway** — it needs `api_key` +
  `username`. No key → no publish. It is NOT a free/self-hosted uploader. A
  first-party YouTube Data API path is the alternative (built separately).
- `containsSyntheticMedia` is forced **true** (AI-disclosure guardrail).
- The caller MUST enforce the human approval gate before calling `upload_video`.
- `dry_run=True` builds the request WITHOUT sending — used by tests and previews.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

API_URL = "https://api.upload-post.com/api/upload"
STATUS_URL = "https://api.upload-post.com/api/uploadposts/status"

# Map ClipPilot platform names → Upload-Post platform tokens.
PLATFORM_TOKENS = {
    "youtube": "youtube", "youtube_shorts": "youtube",
    "instagram": "instagram", "instagram_reels": "instagram",
    "facebook": "facebook", "facebook_reels": "facebook",
    "tiktok": "tiktok",
}


class UploadPostPublisher:
    def __init__(self, api_key: str, username: str, timeout: int = 300):
        self.api_key = api_key
        self.username = username
        self.timeout = timeout

    def _build_request(self, video_path: str, title: str, platforms: list[str],
                       description: str = "", tags: Optional[list[str]] = None,
                       privacy: str = "public") -> dict[str, Any]:
        toks: list[str] = []
        for p in platforms:
            t = PLATFORM_TOKENS.get(p)
            if t and t not in toks:
                toks.append(t)
        # Repeated-key form fields as (key, value) tuples (httpx/requests style).
        data: list[tuple[str, str]] = [
            ("user", self.username),
            ("title", (title or "")[:2200]),
            ("privacy_level", "PUBLIC_TO_EVERYONE"),
        ]
        data += [("platform[]", t) for t in toks]
        if "youtube" in toks:
            data += [
                ("youtube_title", (title or "")[:100]),
                ("youtube_description", description or ""),
                ("privacyStatus", "public" if privacy == "public" else "unlisted"),
                ("containsSyntheticMedia", "true"),  # AI-disclosure guardrail (forced)
            ]
            data += [("tags[]", t) for t in (tags or [])]
        if "tiktok" in toks:
            data += [("is_aigc", "true")]  # TikTok AI-generated-content disclosure (forced)
        return {
            "url": API_URL,
            "headers": {"Authorization": f"Apikey {self.api_key}"},
            "data": data,
            "video_path": str(Path(video_path)),
            "platforms": toks,
        }

    def upload_video(self, video_path: str, title: str, platforms: list[str],
                     description: str = "", tags: Optional[list[str]] = None,
                     privacy: str = "public", dry_run: bool = False) -> dict[str, Any]:
        """Cross-post `video_path`. dry_run returns the prepared request without sending."""
        if not Path(video_path).exists() and not dry_run:
            return {"success": False, "error": f"video not found: {video_path}"}
        req = self._build_request(video_path, title, platforms, description, tags, privacy)
        if dry_run:
            return {"dry_run": True, **req}

        import httpx
        with open(video_path, "rb") as fh:
            files = {"video": (Path(video_path).name, fh, "video/mp4")}
            resp = httpx.post(req["url"], headers=req["headers"], data=req["data"],
                              files=files, timeout=self.timeout)
        try:
            body = resp.json()
        except Exception:  # noqa: BLE001
            body = {"raw": resp.text}
        return {"success": bool(body.get("success")), "status_code": resp.status_code,
                "request_id": body.get("request_id"), "response": body}

    def check_status(self, request_id: str) -> dict[str, Any]:
        import httpx
        resp = httpx.get(STATUS_URL, headers={"Authorization": f"Apikey {self.api_key}"},
                         params={"request_id": request_id}, timeout=60)
        try:
            return resp.json()
        except Exception:  # noqa: BLE001
            return {"raw": resp.text}


def publisher_from_env() -> Optional[UploadPostPublisher]:
    """Build a publisher from UPLOAD_POST_API_KEY + UPLOAD_POST_USERNAME (or .env).
    None when not configured — the pipeline then exports metadata for manual publish."""
    from ..brain import env as benv
    benv.load_dotenv()
    key = os.environ.get("UPLOAD_POST_API_KEY")
    user = os.environ.get("UPLOAD_POST_USERNAME")
    if key and user:
        return UploadPostPublisher(key, user)
    return None
