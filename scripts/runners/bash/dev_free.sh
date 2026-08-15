#!/usr/bin/env bash

# Exit on error
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

USE_TERMS=false
LAUNCH_CHROME=false

for arg in "$@"; do
    case "$arg" in
        --terms|-t)
            USE_TERMS=true
            ;;
        --chrome|--flow|-c)
            LAUNCH_CHROME=true
            ;;
    esac
done

echo "============================================================"
echo "🚀 [Dev Master] Starting Shorts Factory & ClipPilot Studio"
echo "============================================================"

# 0. Check .env existence
if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
        echo "⚙️ Creating .env from .env.example..."
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    else
        echo "⚠️ Warning: .env file not found in $ROOT_DIR"
    fi
fi

# 1. Kill any process occupying ports 3000 or 5001
echo "🧹 [1/4] Checking and freeing ports 3000 and 5001..."
for PORT in 3000 5001; do
    PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "  ⚠️ Port $PORT occupied by PID(s): $PIDS. Freeing port..."
        kill -9 $PIDS 2>/dev/null || true
    fi
done

# 2. Setup Python Environment & requirements
echo "🐍 [2/4] Preparing Python Virtual Environment (.venv)..."
cd "$ROOT_DIR"
if [ ! -d ".venv" ]; then
    echo "  Creating virtual environment..."
    python3.12 -m venv .venv 2>/dev/null || python3 -m venv .venv
fi

# Check requirements
echo "  Verifying Python requirements..."
.venv/bin/pip install -q -r requirements.txt

# Ensure playwright browser binaries exist
if [ -f ".venv/bin/playwright" ]; then
    .venv/bin/playwright install chromium 2>/dev/null || true
fi

# 3. Setup Node / pnpm packages for Web UI
echo "📦 [3/4] Checking Frontend Dependencies..."
cd "$ROOT_DIR/apps/web-ui"
if command -v pnpm &> /dev/null; then
    pnpm install --silent
else
    npm install --silent
fi

# 4. Check Google Flow Chrome Remote Debugging (Port 9222)
echo "🍌 [4/4] Checking Google Flow Automation Status (CDP 9222)..."
if lsof -ti:9222 >/dev/null 2>&1; then
    echo "  ✅ Chrome Remote Debugging (Port 9222) is ACTIVE and ready for Flow AI."
else
    if [ "$LAUNCH_CHROME" = true ]; then
        echo "  🌐 Launching Google Chrome with remote debugging on port 9222..."
        mkdir -p "$HOME/.gemini/antigravity-browser-profile"
        /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
            --remote-debugging-port=9222 \
            --user-data-dir="$HOME/.gemini/antigravity-browser-profile" \
            "https://labs.google/fx/tools/flow" >/dev/null 2>&1 &
        sleep 2
    else
        echo "  💡 Note: To use Google Flow 1-Click Automation, run Chrome with port 9222 or use:"
        echo "     $0 --chrome"
    fi
fi

echo ""
echo "============================================================"
echo "✨ Web UI:     http://localhost:3000"
echo "⚙️ Backend API: http://localhost:5001"
echo "🍌 Flow CDP:   http://localhost:9222"
echo "============================================================"
echo ""

# 5. Launch Services
cd "$ROOT_DIR"
if [ "$USE_TERMS" = true ]; then
    echo "🖥️ Launching services in separate macOS Terminal windows..."
    osascript -e 'tell application "Terminal" to do script "cd \"'$ROOT_DIR'\" && .venv/bin/python apps/api-backend/app.py"' >/dev/null
    sleep 2
    osascript -e 'tell application "Terminal" to do script "cd \"'$ROOT_DIR'/apps/web-ui\" && pnpm dev"' >/dev/null
else
    if command -v pnpm &> /dev/null; then
        pnpm dlx concurrently \
          --names "BACKEND,FRONTEND" \
          --prefix-colors "cyan,magenta" \
          --kill-others-on-fail \
          ".venv/bin/python apps/api-backend/app.py" \
          "sleep 1 && cd apps/web-ui && pnpm dev"
    else
        npx -y concurrently \
          --names "BACKEND,FRONTEND" \
          --prefix-colors "cyan,magenta" \
          --kill-others-on-fail \
          ".venv/bin/python apps/api-backend/app.py" \
          "sleep 1 && cd apps/web-ui && npm run dev"
    fi
fi
