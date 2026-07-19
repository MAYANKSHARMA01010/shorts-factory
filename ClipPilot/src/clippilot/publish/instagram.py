"""First-party Instagram (+ Facebook) Reels publisher via the Meta Graph API.

The free first-party path for IG/FB (Upload-Post is the paid no-setup option).
IG Reels publishing is a 3-step container flow:
  1. POST /{ig_user_id}/media  (media_type=REELS, video_url=…, caption=…)  -> container id
  2. poll GET /{container_id}?fields=status_code  until FINISHED
  3. POST /{ig_user_id}/media_publish  (creation_id=container)  -> media id

IMPORTANT (honest constraint): the Graph API fetches the video from a **public
URL** — it does NOT accept a local file upload. ClipPilot produces local files,
so this publisher needs `video_url` to point at a hosted copy (your S3/CDN/host).
Because of that it is NOT in the engine's default auto-publish chain (which has
only a local path); it's exposed for operators who host their clips. AI-disclosure
is appended to the caption (the Graph API has no synthetic-media flag).

Hand-rolled on httpx; OAuth token is a long-lived user/page token you supply.
`dry_run=True` builds the requests without sending (used by tests).
"""
from __future__ import annotations

import os
import time
from typing import Any, Optional

GRAPH = "https://graph.facebook.com"
AI_DISCLOSURE = "\n\nDisclosure: contains AI-generated or AI-edited content."


class InstagramPublisher:
    def __init__(self, ig_user_id: str, access_token: str, api_version: str = "v21.0",
                 timeout: int = 300, ai_disclosure: bool = True):
        self.ig_user_id = ig_user_id
        self.access_token = access_token
        self.api = api_version
        self.timeout = timeout
        self.ai_disclosure = ai_disclosure

    def _caption(self, caption: str) -> str:
        c = caption or ""
        if self.ai_disclosure and AI_DISCLOSURE.strip() not in c:
            c = (c[: 2200 - len(AI_DISCLOSURE)] + AI_DISCLOSURE).strip()
        return c[:2200]

    def _container_request(self, video_url: str, caption: str) -> dict[str, Any]:
        return {
            "url": f"{GRAPH}/{self.api}/{self.ig_user_id}/media",
            "data": {"media_type": "REELS", "video_url": video_url,
                     "caption": self._caption(caption), "access_token": self.access_token},
        }

    def upload_reel(self, video_url: str, caption: str = "", dry_run: bool = False,
                    poll_seconds: float = 3.0, max_polls: int = 60) -> dict[str, Any]:
        """Publish a Reel from a PUBLIC `video_url`. dry_run returns the prepared
        container request without sending (and without creds)."""
        if not video_url:
            return {"success": False, "error": "video_url (a public URL) is required"}
        req = self._container_request(video_url, caption)
        if dry_run:
            return {"dry_run": True, **req}

        import httpx
        try:
            r = httpx.post(req["url"], data=req["data"], timeout=60)
            container = _safe_json(r).get("id")
            if not container:
                return {"success": False, "step": "create", "response": _safe_json(r)}
            # 2) wait for the container to finish processing
            status_url = f"{GRAPH}/{self.api}/{container}"
            for _ in range(max_polls):
                s = _safe_json(httpx.get(status_url, params={
                    "fields": "status_code", "access_token": self.access_token}, timeout=30))
                if s.get("status_code") == "FINISHED":
                    break
                if s.get("status_code") == "ERROR":
                    return {"success": False, "step": "process", "response": s}
                time.sleep(poll_seconds)
            # 3) publish
            p = _safe_json(httpx.post(f"{GRAPH}/{self.api}/{self.ig_user_id}/media_publish",
                                      data={"creation_id": container, "access_token": self.access_token},
                                      timeout=60))
            media_id = p.get("id")
            return {"success": bool(media_id), "media_id": media_id, "container": container,
                    "response": p}
        except Exception as exc:  # noqa: BLE001
            return {"success": False, "error": f"{type(exc).__name__}: {exc}"}


def _safe_json(resp: Any) -> dict[str, Any]:
    try:
        j = resp.json()
        return j if isinstance(j, dict) else {"raw": j}
    except Exception:  # noqa: BLE001
        return {"raw": getattr(resp, "text", "")}


def publisher_from_env() -> Optional[InstagramPublisher]:
    """Build from INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN (env or .env). None when
    not configured."""
    from ..brain import env as benv
    benv.load_dotenv()
    uid = os.environ.get("INSTAGRAM_USER_ID")
    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    if uid and token:
        return InstagramPublisher(uid, token)
    return None
