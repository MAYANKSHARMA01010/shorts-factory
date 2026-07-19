#!/usr/bin/env python
"""daily_digest.py — email a daily summary of the autonomous shorts channel.
Refreshes analytics, gathers what posted today + view counts + what CreatorStudy learned + any owner
decision waiting, and emails it via notify_email.py. Runs headlessly (scheduled ~22:00). Stdlib only.
"""
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import notify_email  # noqa: E402

TODAY = datetime.now().strftime("%Y-%m-%d")


def read(p):
    q = HERE / p
    return q.read_text(encoding="utf-8", errors="replace") if q.exists() else ""


def vid_id(s):
    m = re.search(r"(?:watch\?v=|shorts/)([A-Za-z0-9_-]{6,})", s)
    return m.group(1) if m else None


def main():
    # 1) fresh analytics
    try:
        subprocess.run([sys.executable, str(HERE / "yt_analytics.py")], capture_output=True, text=True, timeout=180)
    except Exception:
        pass
    perf = {}
    pj = HERE / "analytics" / "performance_latest.json"
    if pj.exists():
        perf = json.loads(pj.read_text(encoding="utf-8"))
    by_id = {v["id"]: v for v in perf.get("videos", [])}
    ch = perf.get("channel", {})

    # 2) today's posts from the ledger
    posts = []
    for line in read("daily_posts_ledger.md").splitlines():
        if line.startswith(f"| {TODAY} "):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) >= 5:
                vid = vid_id(cells[4])
                v = by_id.get(vid, {})
                posts.append({"title": cells[2], "url": (f"https://youtu.be/{vid}" if vid else cells[4][:60]),
                              "views": v.get("views"), "avp": v.get("avgViewPct"), "live": "LIVE" in cells[4] or bool(vid)})

    # 3) studied today
    studied = []
    for line in read("studied_videos.md").splitlines():
        if line.startswith(f"| {TODAY} "):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) >= 7:
                studied.append({"creator": cells[1], "views": cells[2], "takeaway": cells[6]})

    # 4) open owner decision?
    decisions = read("DECISIONS_FOR_OWNER.md")
    open_decision = ("Your decision:" in decisions and "______" in decisions)

    # 5) all-time leaders
    vids = sorted(perf.get("videos", []), key=lambda v: v.get("views", 0), reverse=True)
    top = vids[0] if vids else None

    # ---- compose HTML ----
    esc = lambda s: (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    H = []
    H.append(f"<h2 style='margin:0'>📊 Shorts digest — {TODAY}</h2>")
    H.append(f"<p style='color:#555'>Channel <b>{esc(ch.get('title','?'))}</b> · "
             f"<b>{ch.get('subscribers','?')}</b> subs · <b>{ch.get('total_views','?')}</b> total views · "
             f"{ch.get('video_count','?')} videos · analytics: {esc(perf.get('analytics_status','?'))}</p>")

    if posts:
        H.append(f"<h3>Posted today ({len(posts)})</h3><table cellpadding=6 style='border-collapse:collapse'>")
        H.append("<tr style='background:#f0f0f0'><th align=left>Video</th><th>Views</th><th>Retention</th><th>Status</th></tr>")
        for p in posts:
            av = f"{p['avp']:.0f}%" if isinstance(p.get("avp"), (int, float)) else "—"
            vw = p["views"] if p["views"] is not None else "new"
            H.append(f"<tr><td><a href='{p['url']}'>{esc(p['title'])}</a></td>"
                     f"<td align=center>{vw}</td><td align=center>{av}</td>"
                     f"<td align=center>{'✅' if p['live'] else '⚠ manual'}</td></tr>")
        H.append("</table>")
    else:
        H.append("<p>⚠ <b>No videos posted today.</b> Check <code>daily_run.log</code>.</p>")

    if top:
        H.append(f"<h3>All-time leader</h3><p>“{esc(top['title'])}” — <b>{top['views']}</b> views "
                 f"(<a href='{top['url']}'>watch</a>)</p>")

    if studied:
        H.append("<h3>Studied today (competitor playbook grew)</h3><ul>")
        for s in studied:
            H.append(f"<li><b>{esc(s['creator'])}</b> ({esc(s['views'])}): {esc(s['takeaway'])}</li>")
        H.append("</ul>")

    if open_decision:
        H.append("<h3 style='color:#c0392b'>⏳ A decision is waiting for you</h3>"
                 "<p>See <code>DECISIONS_FOR_OWNER.md</code> (e.g. the niche pick A/B/C).</p>")

    H.append("<hr><p style='color:#888;font-size:12px'>Autonomous shorts pipeline · "
             "digest from daily_digest.py · reply to this email is not monitored.</p>")

    subject = f"📊 Shorts: {len(posts)} posted {TODAY}" + (" · ⏳ decision waiting" if open_decision else "")
    if not posts:
        subject = f"⚠ Shorts: NOTHING posted {TODAY} — check the log"

    html_body = "".join(H)
    (HERE / "digest_last.html").write_text(html_body, encoding="utf-8")  # always saved, even if email fails
    try:
        notify_email.send(subject, html_body, html=True)
        print(f"daily_digest: sent ({len(posts)} posts, {len(studied)} studied)")
    except notify_email.EmailNotConfigured as e:
        print(f"daily_digest: email NOT sent (not configured yet: {e}). "
              f"Digest content saved to digest_last.html -- run 'python notify_email.py --set-password \"<app password>\"' to enable emailing.")
    except Exception as e:
        print(f"daily_digest: email send FAILED ({e}). Digest content saved to digest_last.html.")


if __name__ == "__main__":
    main()
