#!/usr/bin/env python
"""post_to_postiz.py — publish/schedule a finished short to a Postiz channel (YouTube by default).

Drives the Postiz PUBLIC API (verified against a localhost Docker install of postiz-app):
  base = http://localhost:4007/api   (NEXT_PUBLIC_BACKEND_URL),  public routes under /public/v1
  auth = Authorization: <raw api key>   (NO "Bearer" — the org's apiKey, Settings -> Developers -> Access)

Pipeline it runs:
  1. GET  /public/v1/integrations            -> find the channel whose identifier == --channel (default 'youtube')
  2. POST /public/v1/upload   (field 'file') -> upload the mp4, returns media {id, path}
  3. (optional) GET /public/v1/find-slot/:id -> a free schedule slot
  4. POST /public/v1/posts                   -> create the post (draft | schedule | now)

Stdlib only (no 'requests'); multipart is hand-rolled. Python 3.9+.

Auth resolution order:  --api-key  >  $POSTIZ_API_KEY  >  ~/.config/postiz/key
Base URL:               --base-url >  $POSTIZ_BASE_URL  >  http://localhost:4007/api

Examples
  # just list connected channels (sanity check)
  python post_to_postiz.py --list

  # safe: create a DRAFT in Postiz (nothing is published; review it in the UI)
  python post_to_postiz.py --video out/creditscore_final.mp4 \
      --title "Your credit card is lying to you" --description @desc.txt \
      --tags creditscore,creditcardtips,moneytok --draft

  # schedule for a local wall-clock time (converted to UTC for the API)
  python post_to_postiz.py --video out/creditscore_final.mp4 --title "..." --when "2026-07-02 18:00"

  # schedule into the next free slot Postiz suggests
  python post_to_postiz.py --video out/creditscore_final.mp4 --title "..." --when slot

  # publish right now (immediate; this hits the real channel)
  python post_to_postiz.py --video out/creditscore_final.mp4 --title "..." --when now --yes
"""
import argparse
import json
import mimetypes
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

DEFAULT_BASE = "http://localhost:4007/api"
KEY_FILE = Path.home() / ".config" / "postiz" / "key"


# ─── helpers ────────────────────────────────────────────────────────────────────
def resolve_key(cli_key):
    if cli_key:
        return cli_key.strip()
    env = os.environ.get("POSTIZ_API_KEY")
    if env:
        return env.strip()
    if KEY_FILE.exists():
        k = KEY_FILE.read_text(encoding="utf-8").strip()
        if k:
            return k
    sys.exit(
        "ERROR: no Postiz API key. Pass --api-key, set $POSTIZ_API_KEY, or write it to\n"
        f"  {KEY_FILE}\n"
        "Get it in the UI: http://localhost:4007 -> Settings (gear) -> Developers -> Access -> Reveal/Copy."
    )


def api(method, base, path, key, *, body=None, multipart=None):
    """One HTTP call. body=dict -> JSON. multipart=(field,filename,bytes,mime) -> multipart upload."""
    url = base.rstrip("/") + path
    headers = {"Authorization": key}
    data = None
    if multipart is not None:
        field, filename, content, mime = multipart
        boundary = "----postiz" + uuid.uuid4().hex
        pre = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8")
        post = f"\r\n--{boundary}--\r\n".encode("utf-8")
        data = pre + content + post
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urlrequest.Request(url, data=data, headers=headers, method=method)
    try:
        with urlrequest.urlopen(req, timeout=180) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return e.code, parsed
    except URLError as e:
        sys.exit(f"ERROR: cannot reach Postiz at {url}\n  {e}\n"
                 "Is Postiz running? (docker ps | grep postiz) — launch via 'Run Postiz Platform.bat'.")


def to_utc_string(when):
    """Map a --when value to (postiz_type, utc_date_string 'YYYY-MM-DDTHH:mm:ss')."""
    fmt = "%Y-%m-%dT%H:%M:%S"
    now_utc = datetime.now(timezone.utc)
    if when in (None, "now"):
        return "now", now_utc.strftime(fmt)
    if when == "draft":
        return "draft", now_utc.strftime(fmt)
    if when.startswith("+"):  # relative, e.g. +2h / +30m / +1d
        unit = when[-1].lower()
        n = float(when[1:-1])
        mult = {"m": "minutes", "h": "hours", "d": "days"}.get(unit)
        if not mult:
            sys.exit(f"ERROR: bad relative time '{when}' (use +30m / +2h / +1d).")
        return "schedule", (now_utc + timedelta(**{mult: n})).strftime(fmt)
    # absolute local wall-clock: 'YYYY-MM-DD HH:MM' or with seconds / 'T'
    s = when.replace("T", " ")
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            local_naive = datetime.strptime(s, f)
            break
        except ValueError:
            local_naive = None
    if local_naive is None:
        sys.exit(f"ERROR: cannot parse --when '{when}'. Use 'now', 'slot', '+2h', or 'YYYY-MM-DD HH:MM' (local).")
    # interpret as LOCAL time, convert to UTC
    local_aware = local_naive.astimezone()  # attaches local tz
    return "schedule", local_aware.astimezone(timezone.utc).strftime(fmt)


def read_text_arg(val):
    """A '@path' value reads the file; otherwise the literal string."""
    if val and val.startswith("@"):
        p = Path(val[1:])
        if not p.exists():
            sys.exit(f"ERROR: --description file not found: {p}")
        return p.read_text(encoding="utf-8").strip()
    return val or ""


# ─── main ───────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Publish/schedule a short to Postiz (YouTube by default).")
    ap.add_argument("--video", help="path to the finished mp4")
    ap.add_argument("--title", help="video title (YouTube: <=100 chars)")
    ap.add_argument("--description", default="", help="description text, or @file.txt (YouTube: <=5000)")
    ap.add_argument("--tags", default="", help="comma-separated tags (e.g. creditscore,moneytok)")
    ap.add_argument("--privacy", default="public", choices=["public", "private", "unlisted"])
    ap.add_argument("--made-for-kids", default="no", choices=["no", "yes"], dest="kids")
    ap.add_argument("--thumbnail", help="optional thumbnail image (1280x720 recommended)")
    ap.add_argument("--channel", default="youtube", help="provider identifier to post to (default youtube)")
    ap.add_argument("--integration-id", help="post to this integration id directly (skips lookup)")
    ap.add_argument("--when", help="'now' | 'slot' | '+2h' | 'YYYY-MM-DD HH:MM' (local). Omit => draft.")
    ap.add_argument("--draft", action="store_true", help="create as a draft (never publishes)")
    ap.add_argument("--yes", action="store_true", help="confirm an immediate ('now') publish without prompting")
    ap.add_argument("--list", action="store_true", help="just list connected channels and exit")
    ap.add_argument("--dry-run", action="store_true", help="print the post payload, do not POST it")
    ap.add_argument("--base-url", default=os.environ.get("POSTIZ_BASE_URL", DEFAULT_BASE))
    ap.add_argument("--api-key", help="override key (else $POSTIZ_API_KEY or ~/.config/postiz/key)")
    args = ap.parse_args()

    base = args.base_url
    key = resolve_key(args.api_key)

    # 1) integrations
    st, integrations = api("GET", base, "/public/v1/integrations", key)
    if st == 401:
        sys.exit(f"ERROR: 401 from Postiz ({integrations}). The API key is wrong/rotated — re-copy it from "
                 "Settings -> Developers -> Access.")
    if st >= 400 or not isinstance(integrations, list):
        sys.exit(f"ERROR: GET /integrations failed (HTTP {st}): {integrations}")

    if args.list:
        if not integrations:
            print("No channels connected. Add one in the UI: http://localhost:4007 -> Add Channel.")
        for i in integrations:
            flag = " (disabled)" if i.get("disabled") else ""
            print(f"  {i.get('identifier'):12} {i.get('name')}  [{i.get('id')}]{flag}")
        return

    # required args for posting
    if not args.video or not args.title:
        sys.exit("ERROR: --video and --title are required (or use --list).")
    video = Path(args.video)
    if not video.exists():
        sys.exit(f"ERROR: video not found: {video}")

    # pick the integration
    if args.integration_id:
        target = next((i for i in integrations if i.get("id") == args.integration_id), None)
        if not target:
            sys.exit(f"ERROR: integration id {args.integration_id} not found.")
    else:
        matches = [i for i in integrations if i.get("identifier") == args.channel and not i.get("disabled")]
        if not matches:
            have = ", ".join(sorted({i.get("identifier") for i in integrations})) or "(none)"
            sys.exit(f"ERROR: no enabled '{args.channel}' channel connected. Connected: {have}.\n"
                     "Connect one in the UI: http://localhost:4007 -> Add Channel.")
        target = matches[0]
    print(f"-> channel: {target['name']} ({target['identifier']}) [{target['id']}]")

    # decide type + date
    if args.draft:
        ptype, date_str = "draft", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    elif args.when == "slot":
        sst, slot = api("GET", base, f"/public/v1/find-slot/{target['id']}", key)
        if sst >= 400 or not isinstance(slot, dict) or "date" not in slot:
            sys.exit(f"ERROR: find-slot failed (HTTP {sst}): {slot}")
        ptype, date_str = "schedule", slot["date"]
    elif args.when is None:
        ptype, date_str = "draft", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        print("-> no --when given: creating a DRAFT (use --when now|slot|'YYYY-MM-DD HH:MM' to schedule/publish).")
    else:
        ptype, date_str = to_utc_string(args.when)

    # guard immediate publish
    if ptype == "now" and not (args.yes or args.dry_run):
        sys.exit("REFUSING immediate publish without --yes. This posts to the live channel right now.\n"
                 "Re-run with --yes to publish now, or use --when 'YYYY-MM-DD HH:MM' to schedule / --draft to stage.")

    # 2) upload video
    print(f"-> uploading {video.name} ({video.stat().st_size/1e6:.1f} MB) …")
    mime = mimetypes.guess_type(str(video))[0] or "video/mp4"
    st, media = api("POST", base, "/public/v1/upload", key,
                    multipart=("file", video.name, video.read_bytes(), mime))
    if st >= 400 or not isinstance(media, dict) or "id" not in media:
        sys.exit(f"ERROR: upload failed (HTTP {st}): {media}")
    print(f"   media id {media['id']}  path {media.get('path')}")
    image = [{"id": media["id"], "path": media.get("path")}]

    # optional thumbnail
    thumbnail = None
    if args.thumbnail:
        tp = Path(args.thumbnail)
        if not tp.exists():
            sys.exit(f"ERROR: thumbnail not found: {tp}")
        tmime = mimetypes.guess_type(str(tp))[0] or "image/jpeg"
        tst, tmedia = api("POST", base, "/public/v1/upload", key,
                          multipart=("file", tp.name, tp.read_bytes(), tmime))
        if tst >= 400 or not isinstance(tmedia, dict):
            sys.exit(f"ERROR: thumbnail upload failed (HTTP {tst}): {tmedia}")
        thumbnail = {"id": tmedia["id"], "path": tmedia.get("path")}

    # 3) build settings + payload
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    settings = {
        "__type": args.channel,
        "title": args.title[:100],
        "type": args.privacy,
        "selfDeclaredMadeForKids": args.kids,
        # Postiz tag widget expects {value,label} objects, not bare strings
        "tags": [{"value": t, "label": t} for t in tags],
        "thumbnail": thumbnail,
    }
    payload = {
        "type": ptype,
        "tags": [],
        "shortLink": False,
        "date": date_str,
        "creationMethod": "API",
        "posts": [{
            "integration": {"id": target["id"]},
            "group": uuid.uuid4().hex[:10],
            "settings": settings,
            "value": [{"content": read_text_arg(args.description), "delay": 0, "image": image}],
        }],
    }

    if args.dry_run:
        print("-> DRY RUN, payload:")
        print(json.dumps(payload, indent=2))
        return

    # 4) create post
    print(f"-> creating post (type={ptype}, date={date_str} UTC) …")
    st, result = api("POST", base, "/public/v1/posts", key, body=payload)
    if st >= 400:
        sys.exit(f"ERROR: create post failed (HTTP {st}): {json.dumps(result, indent=2) if isinstance(result, (dict, list)) else result}")
    verb = {"draft": "DRAFTED", "schedule": "SCHEDULED", "now": "PUBLISHING NOW"}.get(ptype, ptype.upper())
    print(f"OK -> {verb}: {target['name']}  @ {date_str} UTC")
    print(json.dumps(result, indent=2) if isinstance(result, (dict, list)) else result)


if __name__ == "__main__":
    main()
