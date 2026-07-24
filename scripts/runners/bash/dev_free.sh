#!/usr/bin/env bash

# Exit on error
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

USE_TERMS=false
if [ "$1" == "--terms" ] || [ "$1" == "-t" ]; then
    USE_TERMS=true
fi

echo "🚀 [Dev Master Script] Preparing Shorts Factory Free Dashboard suite..."

# 0. Kill any process occupying ports 3000 or 5001
echo "🧹 [0/3] Checking and freeing ports 3000 and 5001..."
for PORT in 3000 5001; do
    PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "  ⚠️ Port $PORT is occupied by PID(s): $PIDS. Terminating..."
        kill -9 $PIDS 2>/dev/null || true
    fi
done

# 1. Setup Python Environment & requirements
echo "🐍 [1/3] Preparing Python Virtual Environment..."
cd "$ROOT_DIR"
if [ ! -d ".venv" ]; then
    echo "Creating Python virtualenv (.venv)..."
    python3.12 -m venv .venv || python3 -m venv .venv
fi
source .venv/bin/activate
echo "Checking & installing Python requirements..."
pip install -q -r requirements.txt

# 2. Setup Node / pnpm packages for Web UI
echo "📦 [2/3] Checking Frontend Dependencies..."
cd "$ROOT_DIR/apps/web-ui"
if command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi

# 3. Launch Services
if [ "$USE_TERMS" = true ]; then
    echo "🖥️ [3/3] Launching services in separate macOS Terminal windows..."
    osascript -e 'tell application "Terminal" to do script "cd \"'$ROOT_DIR'\" && source .venv/bin/activate && python3 apps/api-backend/app.py"' >/dev/null
    sleep 2
    osascript -e 'tell application "Terminal" to do script "cd \"'$ROOT_DIR'/apps/web-ui\" && pnpm dev"' >/dev/null
else
    echo "✨ [3/3] Launching Backend (5001) & Frontend (3000) using concurrently..."
    cd "$ROOT_DIR"
    if command -v pnpm &> /dev/null; then
        pnpm dlx concurrently \
          --names "BACKEND,FRONTEND" \
          --prefix-colors "cyan,magenta" \
          --kill-others-on-fail \
          "source .venv/bin/activate && python3 apps/api-backend/app.py" \
          "sleep 1 && cd apps/web-ui && pnpm dev"
    else
        npx -y concurrently \
          --names "BACKEND,FRONTEND" \
          --prefix-colors "cyan,magenta" \
          --kill-others-on-fail \
          "source .venv/bin/activate && python3 apps/api-backend/app.py" \
          "sleep 1 && cd apps/web-ui && npm run dev"
    fi
fi
