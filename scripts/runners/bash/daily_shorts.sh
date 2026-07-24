#!/usr/bin/env bash
# ====== DailyShorts autonomous runner (crontab / launchd → this file) ======
# macOS equivalent of daily_shorts.bat
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_FILE="$PROJECT_ROOT/runtime/logs/daily_run.log"
PROMPT_FILE="$PROJECT_ROOT/pipeline/prompts/daily_shorts_prompt.md"

echo >> "$LOG_FILE"
echo "============================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] DailyShorts run STARTING" >> "$LOG_FILE"

# 1) Make sure Docker + Postiz are up (reads YouTube creds from the container)
bash "$SCRIPT_DIR/ensure_postiz.sh" >> "$LOG_FILE" 2>&1 || true

# 2) Run the autonomous producer headless (adjust path to your claude binary)
claude -p "Execute today's run: follow every instruction in pipeline/prompts/daily_shorts_prompt.md. Work fully autonomously and do not ask any questions." \
  --dangerously-skip-permissions >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] DailyShorts run FINISHED" >> "$LOG_FILE"
