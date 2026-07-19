#!/usr/bin/env bash
# ====== ShortsDigest daily email digest runner ======
# macOS equivalent of digest.bat
cd "$(dirname "$0")"

echo >> digest_run.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Digest STARTING" >> digest_run.log

python daily_digest.py >> digest_run.log 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Digest FINISHED" >> digest_run.log
