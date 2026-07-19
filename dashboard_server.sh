#!/usr/bin/env bash
# ====== Dashboard server keep-alive ======
# macOS equivalent of dashboard_server.bat — starts dashboard if not running
cd "$(dirname "$0")"

if ! pgrep -f "dashboard.py" > /dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting dashboard on :8899"
  nohup python dashboard.py >> dashboard.log 2>&1 &
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dashboard already running"
fi
