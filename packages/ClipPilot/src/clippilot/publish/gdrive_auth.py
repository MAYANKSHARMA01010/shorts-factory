"""One-time Google Drive OAuth helper — get a refresh token for Drive auto-upload.

Uses your existing YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to request Drive access,
opens the browser for one-click approval, and writes GDRIVE_REFRESH_TOKEN into .env.

Usage:
    .venv/bin/python -m clippilot.publish.gdrive_auth --write-env
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlencode, urlparse

from .. import config as cfg

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive"


def build_auth_url(client_id: str, redirect_uri: str, scope: str = SCOPE,
                   state: str = "clippilot_gdrive") -> str:
    """Build Google OAuth consent URL with Drive permissions."""
    return AUTH_URL + "?" + urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    })


def parse_code(path: str) -> tuple[Optional[str], Optional[str]]:
    """Pull (code, error) out of the OAuth redirect path's query string."""
    q = parse_qs(urlparse(path).query)
    return (q.get("code", [None])[0], q.get("error", [None])[0])


def exchange_code(client_id: str, client_secret: str, code: str,
                  redirect_uri: str) -> dict[str, Any]:
    """Trade the auth code for tokens (incl. the refresh token)."""
    import httpx
    resp = httpx.post(TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }, timeout=60)
    try:
        return resp.json()
    except Exception:  # noqa: BLE001
        return {"error": "non-json token response", "raw": getattr(resp, "text", "")}


def append_env(key: str, value: str, env_path: Optional[str] = None) -> str:
    """Set KEY=value in the .env file."""
    path = Path(env_path) if env_path else (cfg.PROJECT_ROOT / ".env")
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    out: list[str] = []
    replaced = False
    for ln in lines:
        if ln.strip().startswith(f"{key}=") or ln.strip().startswith(f"# {key}="):
            out.append(f"{key}={value}")
            replaced = True
        else:
            out.append(ln)
    if not replaced:
        out.append(f"{key}={value}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return str(path)


def get_refresh_token(client_id: str, client_secret: str, port: int = 8766,
                      open_browser: bool = True, timeout: int = 300) -> dict[str, Any]:
    """Run the loopback consent flow and return the token response."""
    import webbrowser
    from http.server import BaseHTTPRequestHandler, HTTPServer

    redirect_uri = f"http://localhost:{port}/"
    captured: dict[str, Optional[str]] = {"code": None, "error": None}

    class _Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):  # noqa: N802
            captured["code"], captured["error"] = parse_code(self.path)
            body = (b"<h2>ClipPilot Google Drive Authorization Successful! You can close this tab.</h2>"
                    if captured["code"] else b"<h2>ClipPilot: Google Drive authorization failed.</h2>")
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    srv = HTTPServer(("127.0.0.1", port), _Handler)
    srv.timeout = timeout
    url = build_auth_url(client_id, redirect_uri)
    print(f"Opening Google Drive consent page:\n{url}\n")
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    srv.handle_request()
    srv.server_close()

    if captured["error"] or not captured["code"]:
        return {"error": captured["error"] or "no authorization code received"}
    tokens = exchange_code(client_id, client_secret, captured["code"], redirect_uri)
    return tokens


def main(argv: Optional[list[str]] = None) -> int:
    p = argparse.ArgumentParser(prog="clippilot.publish.gdrive_auth",
                                description="Get a Google Drive OAuth refresh token (one-time).")
    p.add_argument("--client-id", default=None)
    p.add_argument("--client-secret", default=None)
    p.add_argument("--port", type=int, default=8766)
    p.add_argument("--write-env", action="store_true", help="save GDRIVE_REFRESH_TOKEN to .env")
    p.add_argument("--no-browser", action="store_true", help="don't auto-open the browser")
    a = p.parse_args(argv)

    from ..brain import env as benv
    benv.load_dotenv()
    cid = a.client_id or os.environ.get("YOUTUBE_CLIENT_ID")
    secret = a.client_secret or os.environ.get("YOUTUBE_CLIENT_SECRET")
    if not cid or not secret:
        print("Need YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET in .env.", file=sys.stderr)
        return 2

    tokens = get_refresh_token(cid, secret, port=a.port, open_browser=not a.no_browser)
    refresh = tokens.get("refresh_token")
    if not refresh:
        print(f"Failed to get a refresh token: {tokens.get('error') or tokens}", file=sys.stderr)
        return 1

    print("\n✅ Got Google Drive refresh token!")
    if a.write_env:
        path = append_env("GDRIVE_REFRESH_TOKEN", refresh)
        print(f"Saved GDRIVE_REFRESH_TOKEN to {path}")
    else:
        print(f"GDRIVE_REFRESH_TOKEN={refresh}\n(add this to your .env, or re-run with --write-env)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
