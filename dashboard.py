#!/usr/bin/env python
"""dashboard.py — a simple old-school LIVE dashboard for the autonomous shorts channel.
Serves a retro green-terminal page at http://localhost:8899 that auto-refreshes and shows:
NOW (what's running) · NEXT (scheduled runs) · SERVICES/TOOLS · ANALYTICS · PUBLISHED · STUDIED ·
DECISIONS · PIPELINE state. Stdlib only. Run:  python dashboard.py   (or double-click Dashboard.bat)
"""
import http.server
import json
import re
import socketserver
import subprocess
from datetime import datetime
from html import escape
from pathlib import Path

HERE = Path(__file__).parent
PORT = 8899
REFRESH = 8  # seconds

TASK_MAP = {
    "dailyshorts": ["DailyShorts"],
    "creatorstudy": ["CreatorStudy"],
    "shortslearn": ["ShortsLearn"],
    "digestnow": ["ShortsDigest"],
    "all": ["DailyShorts", "CreatorStudy", "ShortsLearn"],
}
LABELS = {
    "dailyshorts": "Make + post a video",
    "creatorstudy": "Study top creators",
    "shortslearn": "Learn from analytics",
    "digestnow": "Email digest",
    "all": "ALL THREE",
}


def run_task(names):
    for n in names:
        subprocess.run(["schtasks", "/Run", "/TN", n], capture_output=True, text=True, timeout=15)


def sh(args, timeout=10):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout).stdout or ""
    except Exception:
        return ""


def read(p):
    q = HERE / p
    return q.read_text(encoding="utf-8", errors="replace") if q.exists() else ""


def ps_state():
    out = sh(["powershell", "-NoProfile", "-Command",
              "Get-ScheduledTask DailyShorts,CreatorStudy,ShortsLearn,ShortsDigest -ErrorAction SilentlyContinue | "
              "ForEach-Object { $i=Get-ScheduledTaskInfo -TaskName $_.TaskName; "
              "\"T|$($_.TaskName)|$($_.State)|$($i.LastRunTime)|$($i.NextRunTime)|$($i.LastTaskResult)\" }; "
              "\"P|\" + ((Get-Process node,ffmpeg,python -ErrorAction SilentlyContinue | Measure-Object).Count)"])
    tasks, procs = [], 0
    for l in out.splitlines():
        p = l.strip().split("|")
        if p[0] == "T" and len(p) >= 6:
            tasks.append({"name": p[1], "state": p[2], "last": p[3], "next": p[4], "result": p[5]})
        elif p[0] == "P" and len(p) >= 2:
            try:
                procs = int(p[1])
            except Exception:
                procs = 0
    order = {"DailyShorts": 0, "CreatorStudy": 1, "ShortsLearn": 2, "ShortsDigest": 3}
    tasks.sort(key=lambda t: order.get(t["name"], 9))
    return tasks, procs


def docker_state():
    running = set(sh(["docker", "ps", "--format", "{{.Names}}"]).split())
    info = {"postiz": "postiz" in running, "postgres": "postiz-postgres" in running,
            "temporal": "temporal" in running, "channel": "?", "tokenOK": None,
            "published": 0, "stuck": 0}
    if info["postgres"]:
        q = sh(["docker", "exec", "postiz-postgres", "psql", "-U", "postiz-user", "-d", "postiz-db-local",
                "-t", "-A", "-F", "|", "-c",
                "SELECT (SELECT name FROM \"Integration\" WHERE \"providerIdentifier\"='youtube' LIMIT 1), "
                "(SELECT bool_and(\"tokenExpiration\">now() AND NOT \"refreshNeeded\") FROM \"Integration\" WHERE \"providerIdentifier\"='youtube'), "
                "(SELECT COUNT(*) FROM \"Post\" WHERE state='PUBLISHED'), "
                "(SELECT COUNT(*) FROM \"Post\" WHERE state IN ('QUEUE','ERROR'));"], timeout=8)
        parts = q.strip().split("|")
        if len(parts) >= 4:
            info["channel"] = parts[0] or "?"
            info["tokenOK"] = (parts[1] == "t")
            info["published"] = parts[2]
            info["stuck"] = parts[3]
    return info


def analytics():
    p = HERE / "analytics" / "performance_latest.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def ledger_recent(path, n=6, datecol=0):
    rows = []
    for line in read(path).splitlines():
        if line.startswith("| 20"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            rows.append(cells)
    return rows[-n:][::-1]


def pending_decision():
    d = read("DECISIONS_FOR_OWNER.md")
    return ("Your decision:" in d and "______" in d)


def tail_line(path):
    lines = [l for l in read(path).splitlines() if l.strip()]
    return lines[-1] if lines else ""


def vid_id(s):
    m = re.search(r"(?:watch\?v=|shorts/|youtu\.be/)([A-Za-z0-9_-]{6,})", s)
    return m.group(1) if m else None


def render(ran=None):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tasks, procs = ps_state()
    dk = docker_state()
    perf = analytics()
    running = [t for t in tasks if t["state"] == "Running"]

    def badge(ok, yes="UP", no="DOWN"):
        return f"<span class='{ 'ok' if ok else 'err'}'>{yes if ok else no}</span>"

    H = []
    H.append(f"""<!doctype html><html><head><meta charset=utf-8>
<meta http-equiv=refresh content="{REFRESH};url=/"><title>SHORTS // dashboard</title>
<style>
body{{background:#000;color:#ccc;font-family:Consolas,'Courier New',monospace;font-size:13px;margin:0;padding:14px}}
h1{{font-size:16px;color:#fff;margin:0 0 4px}} .grid{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.box{{border:1px solid #444;padding:8px 10px;margin:0 0 12px;background:#0a0a0a}}
.box h2{{font-size:12px;color:#fff;margin:0 0 6px;letter-spacing:2px;border-bottom:1px solid #444;padding-bottom:4px}}
table{{width:100%;border-collapse:collapse}} td,th{{text-align:left;padding:2px 6px;vertical-align:top}}
th{{color:#888}} a{{color:#eee;text-decoration:underline}} a:hover{{color:#fff}}
.ok{{color:#eee;font-weight:bold}} .warn{{color:#fff;font-weight:bold}} .warn::before{{content:'[!] '}}
.err{{background:#fff;color:#000;padding:0 4px;font-weight:bold}} .dim{{color:#777}}
.run{{background:#fff;color:#000;padding:0 6px;font-weight:bold}}
.big{{font-size:20px;color:#fff;font-weight:bold}} .live{{animation:b 1s steps(2) infinite}} @keyframes b{{50%{{opacity:.2}}}}
.btn{{display:inline-block;border:1px solid #999;color:#eee !important;background:#111;padding:5px 12px;
margin:3px 8px 3px 0;text-decoration:none !important;font-weight:bold;font-family:inherit}}
.btn:hover{{background:#fff;color:#000 !important}} .btnwarn{{border:2px solid #fff}}
.banner{{background:#fff;border:1px solid #fff;color:#000;padding:6px 10px;margin:0 0 10px;font-weight:bold}}
</style></head><body>""")

    H.append(f"<h1>▓▓ SHORTS AUTOMATION — LIVE DASHBOARD ▓▓ <span class=dim>{now}</span> "
             f"<span class='live ok'>● LIVE</span> <span class=dim>(auto-refresh {REFRESH}s)</span></h1>")

    if ran:
        label = LABELS.get(ran, ran)
        H.append(f"<div class=banner>▶ Triggered: <b>{escape(label)}</b> — running in the background now. "
                 f"Check the ▶ NOW box below in a few seconds.</div>")

    # CONTROL PANEL
    H.append("<div class=box><h2>🎛 CONTROL PANEL</h2>")
    H.append("<a class=btn href='/run/dailyshorts'>[1] Make + Post video NOW</a>")
    H.append("<a class=btn href='/run/creatorstudy'>[2] Study creators NOW</a>")
    H.append("<a class=btn href='/run/shortslearn'>[3] Learn from analytics NOW</a>")
    H.append("<a class=btn href='/run/digestnow'>[4] Email digest NOW</a>")
    H.append("<a class='btn btnwarn' href='/run/all'>[5] RUN ALL THREE</a>")
    H.append("</div>")

    # NOW
    H.append("<div class=box><h2>▶ NOW</h2>")
    if running:
        for t in running:
            log = {"DailyShorts": "daily_run.log", "CreatorStudy": "study_run.log",
                   "ShortsLearn": "learn_run.log", "ShortsDigest": "digest_run.log"}.get(t["name"], "")
            H.append(f"<div><span class=run>RUNNING</span> <b>{t['name']}</b> "
                     f"<span class=dim>since {escape(t['last'])}</span></div>")
            if log:
                H.append(f"<div class=dim>&nbsp;&nbsp;last log: {escape(tail_line(log)[:150])}</div>")
    else:
        H.append("<div class=dim>idle — nothing running right now.</div>")
    H.append(f"<div class=dim>active render/tts processes (node/ffmpeg/python): <b class="
             f"'{'ok' if procs>2 else 'dim'}'>{procs}</b></div></div>")

    H.append("<div class=grid><div>")

    # NEXT / SCHEDULE
    H.append("<div class=box><h2>⏱ SCHEDULE (next runs)</h2><table>"
             "<tr><th>task</th><th>state</th><th>last</th><th>next run</th></tr>")
    for t in tasks:
        res = "" if t["result"] in ("0", "", "267009") else f" <span class=err>rc={t['result']}</span>"
        st = f"<span class=run>{t['state']}</span>" if t["state"] == "Running" else f"<span class=ok>{t['state']}</span>"
        H.append(f"<tr><td><b>{t['name']}</b></td><td>{st}</td><td class=dim>{escape(t['last'])}{res}</td>"
                 f"<td>{escape(t['next'])}</td></tr>")
    H.append("</table></div>")

    # SERVICES / TOOLS
    tok = dk["tokenOK"]
    H.append("<div class=box><h2>⚙ SERVICES &amp; TOOLS</h2>")
    H.append(f"Docker containers: Postiz {badge(dk['postiz'])} · Postgres {badge(dk['postgres'])} · Temporal {badge(dk['temporal'])}<br>")
    H.append(f"YouTube: channel <b>{escape(dk['channel'])}</b> · Postiz-stored token "
             f"{'<span class=ok>VALID</span>' if tok else ('<span class=warn>stale</span>' if tok is not None else '<span class=dim>?</span>')} "
             f"<span class=dim>(harmless — direct-upload refreshes its own token per publish)</span><br>")
    real_published = len(ledger_recent("daily_posts_ledger.md", 999))
    H.append(f"Real videos published (ledger): <span class=ok>{real_published}</span> · "
             f"Postiz legacy queue: {dk['published']} published"
             + (f" · <span class=warn>{dk['stuck']} stuck</span>" if dk['stuck'] not in ('0', '') else " (none stuck)")
             + " <span class=dim>(most videos now bypass Postiz via direct upload)</span><br>")
    tools = [("make_narration.py", "ClipPilot/remotion_explainer/make_narration.py", "TTS narration + word timing"),
             ("post_to_youtube.py", "post_to_youtube.py", "direct YouTube upload (publish)"),
             ("yt_analytics.py", "yt_analytics.py", "channel/video analytics"),
             ("yt_top.py", "yt_top.py", "find top competitor Shorts"),
             ("recut.py", ".claude/skills/punchy-recut/recut.py", "pacing + SFX finish"),
             ("notify_email.py", "notify_email.py", "email digest/alerts"),
             ("variation/", "variation/title_shapes.md", "anti-repetition engine")]
    H.append("<table><tr><th>tool</th><th>use</th></tr>")
    for name, path, use in tools:
        ok = (HERE / path).exists()
        H.append(f"<tr><td>{'<span class=ok>✓</span>' if ok else '<span class=err>✗</span>'} {name}</td><td class=dim>{use}</td></tr>")
    H.append("</table></div></div><div>")

    # ANALYTICS
    H.append("<div class=box><h2>📊 ANALYTICS</h2>")
    if perf:
        ch = perf.get("channel", {})
        H.append(f"<span class=big>{ch.get('subscribers','?')}</span> subs &nbsp; "
                 f"<span class=big>{ch.get('total_views','?')}</span> views &nbsp; "
                 f"{ch.get('video_count','?')} videos <span class=dim>(analytics: {escape(perf.get('analytics_status','?'))})</span>")
        vids = sorted(perf.get("videos", []), key=lambda v: v.get("views", 0), reverse=True)[:5]
        H.append("<table><tr><th>views</th><th>ret%</th><th>title</th></tr>")
        for v in vids:
            av = f"{v['avgViewPct']:.0f}" if isinstance(v.get("avgViewPct"), (int, float)) else "—"
            H.append(f"<tr><td class=ok>{v['views']}</td><td class=dim>{av}</td>"
                     f"<td><a href='{v['url']}' target=_blank>{escape(v['title'][:46])}</a></td></tr>")
        H.append("</table>")
    else:
        H.append("<span class=dim>no analytics yet — run yt_analytics.py (or the digest/learn task).</span>")
    H.append("</div>")

    # PUBLISHED (past)
    H.append("<div class=box><h2>🎬 PUBLISHED (recent)</h2><table>")
    byid = {v["id"]: v for v in (perf.get("videos", []) if perf else [])}
    for cells in ledger_recent("daily_posts_ledger.md", 6):
        if len(cells) >= 5:
            vid = vid_id(cells[4])
            views = byid.get(vid, {}).get("views", "")
            link = f"<a href='https://youtu.be/{vid}' target=_blank>{escape(cells[2][:42])}</a>" if vid else escape(cells[2][:42])
            H.append(f"<tr><td class=dim>{escape(cells[0])}</td><td>{link}</td><td class=ok>{views}</td></tr>")
    H.append("</table></div>")

    # STUDIED (past)
    H.append("<div class=box><h2>🔎 STUDIED (competitors)</h2><table>")
    st_rows = ledger_recent("studied_videos.md", 4)
    if st_rows:
        for cells in st_rows:
            if len(cells) >= 7:
                H.append(f"<tr><td class=dim>{escape(cells[0])}</td><td><b>{escape(cells[1])}</b> "
                         f"<span class=dim>({escape(cells[2])})</span> — {escape(cells[6][:60])}</td></tr>")
    else:
        H.append("<tr><td class=dim>none yet — CreatorStudy runs daily 08:00.</td></tr>")
    H.append("</table></div></div></div>")

    # DECISIONS + PIPELINE
    unused = len(re.findall(r"\| unused \|", read("daily_topics.md")))
    rules = len(re.findall(r"^- \*\*\[", read(".claude/skills/ultimate-short/SKILL.md"), re.M))
    var_last = ledger_recent("variation_ledger.md", 1)
    var = " / ".join(var_last[0][2:10]) if var_last and len(var_last[0]) >= 3 else "?"
    H.append("<div class=box><h2>⏳ DECISIONS &amp; PIPELINE</h2>")
    if pending_decision():
        H.append("<div class=warn>● A decision is waiting — open DECISIONS_FOR_OWNER.md (niche pick A/B/C).</div>")
    else:
        H.append("<div class=dim>no owner decision pending.</div>")
    H.append(f"<div>backlog topics unused: <b>{unused}</b> · active learned/variation rules: <b>{rules}</b> "
             f"· last video variation combo: <span class=dim>{escape(var)}</span></div></div>")

    H.append("<div class=dim style='margin-top:10px'>files: daily_posts_ledger · variation_ledger · learnings · "
             "DECISIONS_FOR_OWNER · competitor_playbook · logs: daily_run/study_run/learn_run/digest_run</div>")
    H.append("</body></html>")
    return "".join(H)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)

        if parsed.path.startswith("/run/"):
            key = parsed.path[len("/run/"):].strip("/")
            if key in TASK_MAP:
                run_task(TASK_MAP[key])
                self.send_response(302)
                self.send_header("Location", f"/?ran={key}")
                self.end_headers()
                return
            self.send_response(302)
            self.send_header("Location", "/")
            self.end_headers()
            return

        ran = parse_qs(parsed.query).get("ran", [None])[0]
        try:
            body = render(ran=ran).encode("utf-8", "replace")
        except Exception as e:
            body = f"<pre>dashboard error: {escape(str(e))}</pre>".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    # ThreadingHTTPServer (not the plain single-threaded TCPServer) so the auto-refreshing browser tab,
    # extra tabs, and control-panel button clicks can all be served concurrently without transient
    # connection refusals.
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Dashboard live at http://localhost:{PORT}  (Ctrl+C to stop)")
        httpd.serve_forever()
