#!/usr/bin/env python
"""notify_email.py — send email via Gmail SMTP for the shorts pipeline (daily digest + failure alerts).
Works headlessly from the scheduled runs (the claude.ai Gmail connector can't). Stdlib only.

Setup (one time):
  1) Turn on 2-Step Verification on the Google account, then create an App Password:
     https://myaccount.google.com/apppasswords  (pick "Mail" -> generates a 16-char password)
  2) Save it here:
       python notify_email.py --set-password "abcd efgh ijkl mnop"
     (stored at ~/.config/shorts/email.json, mode 600; also sets from/to = dikshantbhatia36@gmail.com)
  3) Test:
       python notify_email.py --subject "Shorts test" --body "it works"

Send:
  python notify_email.py --subject "..." --body "text or @file.html" [--html] [--to other@x.com]
"""
import argparse
import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path

import os
DEFAULT_ADDR = os.environ.get("NOTIFY_EMAIL_ADDRESS", "")
CFG = Path.home() / ".config" / "shorts" / "email.json"


class EmailNotConfigured(RuntimeError):
    pass


def load_cfg():
    """Raises EmailNotConfigured (a normal exception, catchable by callers) rather than exiting the
    process — a script that imports notify_email as a library must not be killed just because email
    isn't set up yet (this crashed daily_digest.py in production: exit code STATUS_CONTROL_C_EXIT)."""
    if not CFG.exists():
        raise EmailNotConfigured(f"no config at {CFG}. Run:  python notify_email.py --set-password \"<app password>\"")
    d = json.loads(CFG.read_text(encoding="utf-8"))
    if not d.get("app_password"):
        raise EmailNotConfigured("app_password missing. Run --set-password again.")
    return d


def save_password(pw, addr=DEFAULT_ADDR):
    CFG.parent.mkdir(parents=True, exist_ok=True)
    CFG.write_text(json.dumps({"address": addr, "app_password": pw.replace(" ", ""), "to": addr}, indent=2), encoding="utf-8")
    try:
        os.chmod(CFG, 0o600)
    except Exception:
        pass
    print(f"notify_email: saved credentials to {CFG}")


def send(subject, body, to=None, html=False):
    d = load_cfg()
    msg = EmailMessage()
    msg["From"] = d["address"]
    msg["To"] = to or d.get("to", d["address"])
    msg["Subject"] = subject
    if html:
        msg.set_content("This email is best viewed as HTML.")
        msg.add_alternative(body, subtype="html")
    else:
        msg.set_content(body)
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx, timeout=30) as s:
        s.login(d["address"], d["app_password"])
        s.send_message(msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set-password", dest="pw", help="save the Gmail app password and exit")
    ap.add_argument("--subject")
    ap.add_argument("--body", help="text, or @path to a file (html or text)")
    ap.add_argument("--to")
    ap.add_argument("--html", action="store_true")
    a = ap.parse_args()
    if a.pw:
        save_password(a.pw)
        return
    if not a.subject or not a.body:
        sys.exit("notify_email: --subject and --body required (or use --set-password).")
    body = Path(a.body[1:]).read_text(encoding="utf-8") if a.body.startswith("@") else a.body
    try:
        send(a.subject, body, a.to, a.html)
        print("notify_email: sent")
    except EmailNotConfigured as e:
        sys.exit(f"notify_email: not configured -- {e}")
    except Exception as e:
        sys.exit(f"notify_email: FAILED to send: {e}")


if __name__ == "__main__":
    main()
