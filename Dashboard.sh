#!/usr/bin/env bash
# ====== Launch dashboard in browser ======
# macOS equivalent of Dashboard.bat
cd "$(dirname "$0")"

# Start dashboard if not running
if ! pgrep -f "dashboard.py" > /dev/null; then
  echo "Starting dashboard on http://localhost:8899 ..."
  nohup python dashboard.py >> dashboard.log 2>&1 &
  sleep 1
fi

# Open in default browser
open http://localhost:8899
