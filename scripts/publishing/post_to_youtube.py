#!/usr/bin/env python
"""post_to_youtube.py — upload a video DIRECTLY to YouTube via the Data API (bypasses Postiz's flaky
Temporal publisher entirely). Reliable: no worker races, no media-forwarder, no QUEUE limbo.

Creds: YouTube client id/secret from the postiz container env, refresh token from Postiz's Postgres
(same single source of truth as the other scripts). The token already has the youtube.upload scope.

Usage:
  python post_to_youtube.py --video out/x.mp4 --title "..." --description @desc.txt \
      --tags a,b,c --privacy public
Prints the live watch URL on success.
"""
import argparse
import json
import mimetypes
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def sh(a):
    return subprocess.run(a, capture_output=True, text=True).stdout.strip()


def access_token():
    cid = sh(["docker", "exec", "postiz", "printenv", "YOUTUBE_CLIENT_ID"])
    csec = sh(["docker", "exec", "postiz", "printenv", "YOUTUBE_CLIENT_SECRET"])
    rt = sh(["docker", "exec", "postiz-postgres", "psql", "-U", "postiz-user", "-d", "postiz-db-local",
             "-t", "-A", "-c",
             "SELECT \"refreshToken\" FROM \"Integration\" WHERE \"providerIdentifier\"='youtube' "
             "AND \"refreshToken\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;"])
    if not cid or not rt:
        sys.exit("post_to_youtube: missing YouTube creds (Postiz up + channel connected?)")
    import urllib.parse
    data = urllib.parse.urlencode({"client_id": cid, "client_secret": csec,
                                   "refresh_token": rt, "grant_type": "refresh_token"}).encode()
    with urllib.request.urlopen("https://oauth2.googleapis.com/token", data=data, timeout=30) as r:
        tok = json.load(r).get("access_token")
    if not tok:
        sys.exit("post_to_youtube: Google refused the refresh token (revoked?) -> reconnect YouTube in Postiz UI.")
    return tok


def read_desc(v):
    if v and v.startswith("@"):
        p = Path(v[1:])
        return p.read_text(encoding="utf-8").strip() if p.exists() else ""
    return v or ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--description", default="")
    ap.add_argument("--tags", default="")
    ap.add_argument("--privacy", default="public", choices=["public", "unlisted", "private"])
    ap.add_argument("--category", default="22", help="YouTube categoryId (22=People&Blogs, 27=Education)")
    ap.add_argument("--made-for-kids", default="false", choices=["false", "true"], dest="kids")
    args = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    vp = Path(args.video)
    if not vp.exists():
        sys.exit(f"post_to_youtube: video not found: {vp}")
    desc = read_desc(args.description)
    if "#short" not in desc.lower():
        desc = (desc + "\n\n#Shorts").strip()
    meta = {
        "snippet": {
            "title": args.title[:100],
            "description": desc[:4900],
            "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
            "categoryId": args.category,
        },
        "status": {
            "privacyStatus": args.privacy,
            "selfDeclaredMadeForKids": args.kids == "true",
        },
    }

    tok = access_token()
    boundary = "===" + uuid.uuid4().hex + "==="
    mime = mimetypes.guess_type(str(vp))[0] or "video/mp4"
    body = (
        f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(meta)}\r\n"
        f"--{boundary}\r\nContent-Type: {mime}\r\n\r\n"
    ).encode("utf-8") + vp.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")

    url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status"
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {tok}",
        "Content-Type": f"multipart/related; boundary={boundary}",
    })
    print(f"-> uploading {vp.name} ({vp.stat().st_size/1e6:.1f} MB) directly to YouTube …")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"post_to_youtube: upload failed (HTTP {e.code}): {e.read().decode('utf-8','replace')[:500]}")
    vid = out.get("id")
    print(f"OK -> LIVE: https://www.youtube.com/watch?v={vid}")
    print(f"   (Short: https://www.youtube.com/shorts/{vid} · privacy={args.privacy})")


if __name__ == "__main__":
    main()
