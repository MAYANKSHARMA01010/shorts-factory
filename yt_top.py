#!/usr/bin/env python
"""yt_top.py — find the REAL top-performing competitor Shorts on a topic (so the study run learns
from actual winners, not guesses). Uses the YouTube Data API search, sorted by view count.

Creds come from the running Postiz install (same as yt_analytics.py). search.list costs 100 quota
units/call, so use sparingly (default 10k/day = ~100 searches).

Usage:
  python yt_top.py "credit score tips" --n 8
  python yt_top.py "did you know science facts" --n 8 --max-seconds 60
Outputs a ranked list (views · duration · title · channel · url) to stdout AND appends JSON to
analytics/top_<slug>.json for the study run to consume.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "analytics"
OUT.mkdir(exist_ok=True)


def sh(a):
    return subprocess.run(a, capture_output=True, text=True).stdout.strip()


def token():
    cid = sh(["docker", "exec", "postiz", "printenv", "YOUTUBE_CLIENT_ID"])
    csec = sh(["docker", "exec", "postiz", "printenv", "YOUTUBE_CLIENT_SECRET"])
    rt = sh(["docker", "exec", "postiz-postgres", "psql", "-U", "postiz-user", "-d", "postiz-db-local",
             "-t", "-A", "-c",
             "SELECT \"refreshToken\" FROM \"Integration\" WHERE \"providerIdentifier\"='youtube' "
             "AND \"refreshToken\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;"])
    if not cid or not rt:
        sys.exit("yt_top: missing YouTube creds (Postiz up + channel connected?)")
    data = urllib.parse.urlencode({"client_id": cid, "client_secret": csec,
                                   "refresh_token": rt, "grant_type": "refresh_token"}).encode()
    with urllib.request.urlopen("https://oauth2.googleapis.com/token", data=data, timeout=30) as r:
        return json.load(r)["access_token"]


def api(url, tok):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return {"error": json.load(e)}
        except Exception:
            return {"error": {"message": f"HTTP {e.code}"}}


def iso_seconds(dur):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", dur or "")
    if not m:
        return 0
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--n", type=int, default=8)
    ap.add_argument("--max-seconds", type=int, default=75, help="only keep videos <= this (Shorts)")
    args = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    tok = token()
    q = urllib.parse.quote(args.query)
    s = api(f"https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short"
            f"&order=viewCount&maxResults=40&relevanceLanguage=en&regionCode=US&q={q}", tok)
    if "error" in s:
        sys.exit(f"yt_top: search failed: {s['error']}")
    ids = [it["id"]["videoId"] for it in s.get("items", []) if it.get("id", {}).get("videoId")]
    if not ids:
        print("(no results)")
        return
    vr = api(f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails"
             f"&id={','.join(ids)}", tok)
    vids = []
    for it in vr.get("items", []):
        secs = iso_seconds(it["contentDetails"]["duration"])
        if secs == 0 or secs > args.max_seconds:
            continue
        vids.append({
            "title": it["snippet"]["title"],
            "channel": it["snippet"]["channelTitle"],
            "views": int(it["statistics"].get("viewCount", 0)),
            "likes": int(it["statistics"].get("likeCount", 0)),
            "seconds": secs,
            "published": it["snippet"]["publishedAt"][:10],
            "url": f"https://www.youtube.com/shorts/{it['id']}",
        })
    vids.sort(key=lambda v: v["views"], reverse=True)
    vids = vids[:args.n]

    slug = re.sub(r"[^a-z0-9]+", "-", args.query.lower()).strip("-")[:40]
    (OUT / f"top_{slug}.json").write_text(json.dumps({"query": args.query, "videos": vids}, indent=2), encoding="utf-8")

    print(f"Top {len(vids)} Shorts for: {args.query!r}")
    for i, v in enumerate(vids, 1):
        print(f"{i:2d}. {v['views']:>9,} views · {v['seconds']:>2d}s · {v['channel'][:22]:22} | {v['title'][:60]}")
        print(f"      {v['url']}")


if __name__ == "__main__":
    main()
