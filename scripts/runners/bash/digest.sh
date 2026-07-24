#!/usr/bin/env bash
# ====== ShortsDigest daily email digest runner ======
# macOS equivalent of digest.bat
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_FILE="$PROJECT_ROOT/runtime/logs/digest_run.log"

echo >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Digest STARTING" >> "$LOG_FILE"

python scripts/publishing/daily_digest.py >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Digest FINISHED" >> "$LOG_FILE"
