#!/usr/bin/env bash
# ====== Launch dashboard in browser ======
# macOS equivalent of Dashboard.bat
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# Start dashboard if not running
if ! pgrep -f "scripts/publishing/dashboard.py" > /dev/null; then
  echo "Starting dashboard on http://localhost:8899 ..."
  nohup python scripts/publishing/dashboard.py >> runtime/logs/dashboard.log 2>&1 &
  sleep 1
fi

# Open in default browser
open http://localhost:8899
