#!/usr/bin/env bash
# ====== ShortsLearn weekly self-improvement runner ======
# macOS equivalent of learn_shorts.bat
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_FILE="$PROJECT_ROOT/runtime/logs/learn_run.log"

echo >> "$LOG_FILE"
echo "============================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ShortsLearn run STARTING" >> "$LOG_FILE"

bash "$SCRIPT_DIR/ensure_postiz.sh" >> "$LOG_FILE" 2>&1 || true

claude -p "Execute the weekly learning run: follow every instruction in pipeline/prompts/learn_and_improve_prompt.md. Work fully autonomously and do not ask any questions." \
  --dangerously-skip-permissions >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ShortsLearn run FINISHED" >> "$LOG_FILE"
