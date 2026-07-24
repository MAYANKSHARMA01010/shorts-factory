#!/usr/bin/env bash
# ====== Dashboard server keep-alive ======
# macOS equivalent of dashboard_server.bat — starts dashboard if not running
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

if ! pgrep -f "scripts/publishing/dashboard.py" > /dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting dashboard on :8899"
  nohup python scripts/publishing/dashboard.py >> runtime/logs/dashboard.log 2>&1 &
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dashboard already running"
fi
