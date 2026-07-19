"""First-party YouTube Data API v3 publisher — the FREE alternative to the paid
Upload-Post gateway (docs/08). Hand-rolled over httpx (already a dependency via
anthropic): OAuth2 refresh-token → access token, then a resumable
`videos.insert`. No `google-api-python-client` dependency.

Honest notes (docs/04 guardrails):
- Needs a Google Cloud OAuth client (`client_id`/`client_secret`) + a user
  `refresh_token` obtained once via the installed-app consent flow (a browser
  step, done out-of-band — see docs/09). No creds → no publish.
- YouTube's *altered/synthetic-content* disclosure is set in Studio and isn't
  exposed by the public Data API, so the AI-disclosure guardrail is honored by
  **appending a disclosure line to the description** (best-effort, transparent).
- The caller MUST enforce the human approval gate before `upload_video`.
- `dry_run=True` builds the request body WITHOUT sending — used by tests/preview.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"

AI_DISCLOSURE = "\n\nDisclosure: contains AI-generated or AI-edited content."

_PRIVACY = {"public": "public", "unlisted": "unlisted", "private": "private"}


class YouTubePublisher:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str,
                 timeout: int = 300, ai_disclosure: bool = True):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.timeout = timeout
        self.ai_disclosure = ai_disclosure

    # ── OAuth ──
    def refresh_access_token(self) -> Optional[str]:
        """Exchange the long-lived refresh token for a short-lived access token."""
        import httpx
        resp = httpx.post(TOKEN_URL, data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
            "grant_type": "refresh_token",
        }, timeout=60)
        try:
            return resp.json().get("access_token")
        except Exception:  # noqa: BLE001
            return None

    # ── request body ──
    def _build_body(self, title: str, description: str, tags: Optional[list[str]],
                    privacy: str, category_id: str = "22") -> dict[str, Any]:
        desc = (description or "")[:5000]
        # Match the real disclosure marker (not the common phrase "AI-generated",
        # which can appear in caption text) and RESERVE room so the disclosure
        # survives the 5000-char cap instead of being sliced off the end.
        if self.ai_disclosure and AI_DISCLOSURE.strip() not in desc:
            desc = (desc[: 5000 - len(AI_DISCLOSURE)] + AI_DISCLOSURE).strip()
        return {
            "snippet": {
                "title": (title or "")[:100],
                "description": desc,
                "tags": tags or [],
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": _PRIVACY.get(privacy, "private"),
                "selfDeclaredMadeForKids": False,
            },
        }

    def upload_video(self, video_path: str, title: str, description: str = "",
                     tags: Optional[list[str]] = None, privacy: str = "public",
                     category_id: str = "22", dry_run: bool = False) -> dict[str, Any]:
        """Upload `video_path` via a resumable session. dry_run returns the
        prepared request without sending (and without needing creds)."""
        if not Path(video_path).exists() and not dry_run:
            return {"success": False, "error": f"video not found: {video_path}"}
        body = self._build_body(title, description, tags, privacy, category_id)
        if dry_run:
            return {"dry_run": True, "url": UPLOAD_URL, "body": body,
                    "video_path": str(Path(video_path))}

        access = self.refresh_access_token()
        if not access:
            return {"success": False, "error": "could not obtain access token (check OAuth creds)"}

        import httpx
        # 1) initiate the resumable session → an upload URL in the Location header
        init = httpx.post(
            UPLOAD_URL,
            params={"uploadType": "resumable", "part": "snippet,status"},
            headers={"Authorization": f"Bearer {access}",
                     "X-Upload-Content-Type": "video/*"},
            json=body, timeout=60,
        )
        upload_url = init.headers.get("location") or init.headers.get("Location")
        if init.status_code not in (200, 201) or not upload_url:
            return {"success": False, "status_code": init.status_code,
                    "error": "resumable init failed", "response": _safe_json(init)}

        # 2) PUT the bytes
        with open(video_path, "rb") as fh:
            put = httpx.put(upload_url,
                            headers={"Authorization": f"Bearer {access}",
                                     "Content-Type": "video/*"},
                            content=fh,  # stream the file, don't buffer it all in RAM
                            timeout=self.timeout)
        data = _safe_json(put)
        vid = data.get("id") if isinstance(data, dict) else None
        return {
            "success": bool(vid),
            "video_id": vid,
            "url": f"https://youtu.be/{vid}" if vid else None,
            "status_code": put.status_code,
            "response": data,
        }


def _safe_json(resp: Any) -> Any:
    try:
        return resp.json()
    except Exception:  # noqa: BLE001
        return {"raw": getattr(resp, "text", "")}


def publisher_from_env() -> Optional[YouTubePublisher]:
    """Build from YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET + YOUTUBE_REFRESH_TOKEN
    (env or .env). None when not configured — the pipeline then tries Upload-Post
    or exports metadata for manual publish."""
    from ..brain import env as benv
    benv.load_dotenv()
    cid = os.environ.get("YOUTUBE_CLIENT_ID")
    secret = os.environ.get("YOUTUBE_CLIENT_SECRET")
    refresh = os.environ.get("YOUTUBE_REFRESH_TOKEN")
    if cid and secret and refresh:
        return YouTubePublisher(cid, secret, refresh)
    return None
