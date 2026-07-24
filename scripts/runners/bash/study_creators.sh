#!/usr/bin/env bash
# ====== CreatorStudy daily competitor analysis runner ======
# macOS equivalent of study_creators.bat
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_FILE="$PROJECT_ROOT/runtime/logs/study_run.log"

echo >> "$LOG_FILE"
echo "============================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] CreatorStudy run STARTING" >> "$LOG_FILE"

claude -p "Execute today's creator study: follow every instruction in pipeline/prompts/creator_study_prompt.md. Work fully autonomously and do not ask any questions." \
  --dangerously-skip-permissions >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] CreatorStudy run FINISHED" >> "$LOG_FILE"
