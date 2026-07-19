#!/usr/bin/env python
"""yt_analytics.py — pull the channel's YouTube performance into a report the learning loop reads.

Credentials come from the running Postiz install (single source of truth): the YouTube client
id/secret from the postiz container env, and the refresh token from Postiz's Postgres. Uses the
YouTube Data API (views/likes/comments — works today) and the YouTube Analytics API (CTR /
averageViewPercentage / averageViewDuration — needs the Analytics API enabled once in the GCP
project; degrades gracefully if it isn't).

Writes:  analytics/performance_latest.json   (raw, machine-readable)
         analytics/performance_latest.md     (human/agent-readable summary)
         analytics/performance_<YYYY-MM-DD>.json  (dated snapshot for trend history)

Run:  python yt_analytics.py
"""
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "analytics"
OUT.mkdir(exist_ok=True)


def sh(args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()


def get_creds():
    cid = sh(["docker", "exec", "postiz", "printenv", "YOUTUBE_CLIENT_ID"])
    csec = sh(["docker", "exec", "postiz", "printenv", "YOUTUBE_CLIENT_SECRET"])
    rt = sh(["docker", "exec", "postiz-postgres", "psql", "-U", "postiz-user", "-d", "postiz-db-local",
             "-t", "-A", "-c",
             "SELECT \"refreshToken\" FROM \"Integration\" WHERE \"providerIdentifier\"='youtube' "
             "AND \"refreshToken\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;"])
    if not cid or not rt:
        sys.exit("yt_analytics: missing YouTube client id / refresh token (is Postiz up + a channel connected?)")
    return cid, csec, rt


def access_token(cid, csec, rt):
    data = urllib.parse.urlencode({
        "client_id": cid, "client_secret": csec, "refresh_token": rt, "grant_type": "refresh_token",
    }).encode()
    with urllib.request.urlopen("https://oauth2.googleapis.com/token", data=data, timeout=30) as r:
        tok = json.load(r).get("access_token")
    if not tok:
        sys.exit("yt_analytics: Google refused the refresh token (revoked?) -> reconnect YouTube in Postiz UI.")
    return tok


def api(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return {"error": json.load(e)}
        except Exception:
            return {"error": {"message": f"HTTP {e.code}"}}


def data_api(token):
    """Channel stats + every uploaded video's views/likes/comments (Data API)."""
    ch = api("https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails,snippet&mine=true", token)
    if "error" in ch or not ch.get("items"):
        sys.exit(f"yt_analytics: channels.list failed: {ch}")
    c = ch["items"][0]
    channel = {
        "id": c["id"],
        "title": c["snippet"]["title"],
        "subscribers": c["statistics"].get("subscriberCount"),
        "total_views": c["statistics"].get("viewCount"),
        "video_count": c["statistics"].get("videoCount"),
    }
    uploads = c["contentDetails"]["relatedPlaylists"]["uploads"]
    vids, page = [], ""
    while True:
        u = (f"https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50"
             f"&playlistId={uploads}" + (f"&pageToken={page}" if page else ""))
        pl = api(u, token)
        if "error" in pl:
            break
        vids += [it["contentDetails"]["videoId"] for it in pl.get("items", [])]
        page = pl.get("nextPageToken", "")
        if not page:
            break
    videos = []
    for i in range(0, len(vids), 50):
        batch = ",".join(vids[i:i + 50])
        vr = api(f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={batch}", token)
        for it in vr.get("items", []):
            s, st = it["snippet"], it.get("statistics", {})
            videos.append({
                "id": it["id"],
                "title": s["title"],
                "published": s["publishedAt"],
                "views": int(st.get("viewCount", 0)),
                "likes": int(st.get("likeCount", 0)),
                "comments": int(st.get("commentCount", 0)),
                "url": f"https://www.youtube.com/watch?v={it['id']}",
            })
    videos.sort(key=lambda v: v["views"], reverse=True)
    return channel, videos


def analytics_api(token, videos):
    """Per-video CTR / retention (Analytics API). Returns (rows_by_video, note)."""
    if not videos:
        return {}, "no videos yet"
    start = min(v["published"][:10] for v in videos)
    end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base = ("https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE"
            f"&startDate={start}&endDate={end}&dimensions=video&sort=-views&maxResults=200")
    # core retention/engagement metrics
    core = api(base + "&metrics=views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage", token)
    if "error" in core:
        msg = core["error"].get("error", core["error"]).get("message", str(core["error"])) if isinstance(core["error"], dict) else str(core["error"])
        return {}, f"Analytics API unavailable: {msg}"
    by = {}
    heads = [h["name"] for h in core.get("columnHeaders", [])]
    for row in core.get("rows", []):
        rec = dict(zip(heads, row))
        by[rec.get("video")] = {
            "avgViewPct": rec.get("averageViewPercentage"),
            "avgViewDur": rec.get("averageViewDuration"),
            "minsWatched": rec.get("estimatedMinutesWatched"),
        }
    # impressions + CTR (best-effort; not always available)
    imp = api(base + "&metrics=views,impressions,impressionClickThroughRate", token)
    if "error" not in imp:
        h2 = [h["name"] for h in imp.get("columnHeaders", [])]
        for row in imp.get("rows", []):
            rec = dict(zip(h2, row))
            vid = rec.get("video")
            by.setdefault(vid, {})
            by[vid]["impressions"] = rec.get("impressions")
            by[vid]["ctr"] = rec.get("impressionClickThroughRate")
    return by, "ok"


def pct(x):
    return f"{float(x):.1f}%" if x not in (None, "") else "—"


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    cid, csec, rt = get_creds()
    token = access_token(cid, csec, rt)
    channel, videos = data_api(token)
    ana, ana_note = analytics_api(token, videos)
    for v in videos:
        v.update(ana.get(v["id"], {}))

    now = datetime.now(timezone.utc)
    report = {"generated": now.isoformat(), "channel": channel, "analytics_status": ana_note, "videos": videos}
    (OUT / "performance_latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (OUT / f"performance_{now.strftime('%Y-%m-%d')}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    # markdown summary
    L = []
    L.append(f"# YouTube performance — {channel['title']}  ({now.strftime('%Y-%m-%d %H:%M UTC')})")
    L.append(f"- Subscribers: **{channel['subscribers']}** · Total views: **{channel['total_views']}** · Videos: **{channel['video_count']}**")
    L.append(f"- Analytics API (CTR/retention): **{ana_note}**")
    if ana_note != "ok":
        L.append("  - Enable once: https://console.developers.google.com/apis/api/youtubeanalytics.googleapis.com/overview?project=1090346874182")
    L.append("")
    L.append("| Views | Likes | Cmts | CTR | AvgView% | Title | Published | URL |")
    L.append("|--:|--:|--:|--:|--:|---|---|---|")
    for v in videos:
        L.append(f"| {v['views']} | {v['likes']} | {v['comments']} | {pct(v.get('ctr'))} | {pct(v.get('avgViewPct'))} "
                 f"| {v['title'][:52]} | {v['published'][:10]} | {v['url']} |")
    if videos:
        best, worst = videos[0], videos[-1]
        L.append("")
        L.append(f"- **Best:** {best['views']} views — \"{best['title']}\" ({best['url']})")
        L.append(f"- **Worst:** {worst['views']} views — \"{worst['title']}\"")
        tot = sum(v["views"] for v in videos)
        L.append(f"- **Avg views/video:** {tot/len(videos):.1f} across {len(videos)} videos")
    (OUT / "performance_latest.md").write_text("\n".join(L), encoding="utf-8")
    print("\n".join(L))
    print(f"\nwrote analytics/performance_latest.md + .json")


if __name__ == "__main__":
    main()
