"""
Collect finished shorts into ONE clear, properly-named deliverables folder.

Scans output/transcript_shorts_hd/<id>/final.mp4 and copies each into
  FINAL_SHORTS/<NNNN> - <Real Video Title>.mp4
where NNNN is the transcript's position in the sorted transcripts/ list (stable
across batches), and the title is the real YouTube title (cached in _titles.json
so we don't re-hit the network).

Run:  python collect_finals.py
"""
from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent  # project root
TRANSCRIPTS = BASE / "transcripts"
HD_OUT = BASE / "output" / "transcript_shorts_hd"
FINAL = BASE / "FINAL_SHORTS"
TITLE_CACHE = FINAL / "_titles.json"

_BAD = re.compile(r'[/:*?"<>|\x00-\x1f]')           # characters illegal in filenames
_NONBASIC = re.compile(r"[^\w \-'&.,!()]+")          # drop emoji / odd unicode


def sanitize(title: str) -> str:
    t = _BAD.sub("", title or "")
    t = _NONBASIC.sub("", t)
    t = re.sub(r"\s+", " ", t).strip(" .-")
    return t or "untitled"


def load_titles() -> dict:
    if TITLE_CACHE.exists():
        try:
            return json.loads(TITLE_CACHE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def fetch_title(vid: str) -> str:
    r = subprocess.run(
        ["yt-dlp", "--skip-download", "--no-warnings", "--print", "%(title)s",
         f"https://www.youtube.com/watch?v={vid}"],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    return (r.stdout or "").strip()


def main() -> None:
    FINAL.mkdir(parents=True, exist_ok=True)
    # global, stable index per transcript id
    order = {t.stem: i + 1 for i, t in enumerate(sorted(TRANSCRIPTS.glob("*.txt")))}
    titles = load_titles()

    done = sorted(p for p in HD_OUT.glob("*/final.mp4"))
    print(f"Found {len(done)} finished video(s). Collecting into {FINAL}\n")
    rows = []
    for fp in done:
        vid = fp.parent.name
        if vid not in titles or not titles[vid]:
            titles[vid] = fetch_title(vid) or vid
            TITLE_CACHE.write_text(json.dumps(titles, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
        num = order.get(vid, 0)
        name = f"{num:04d} - {sanitize(titles[vid])}.mp4"
        dest = FINAL / name
        shutil.copy2(str(fp), str(dest))
        rows.append((num, name))
        print(f"  [OK] {vid}  ->  {name}")

    print(f"\n{len(rows)} file(s) in: {FINAL}")
    for _, name in sorted(rows):
        print(f"   {name}")


if __name__ == "__main__":
    main()
