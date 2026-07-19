#!/usr/bin/env bash
# ====== DailyShorts autonomous runner (crontab / launchd → this file) ======
# macOS equivalent of daily_shorts.bat
cd "$(dirname "$0")"

echo >> daily_run.log
echo "============================================================" >> daily_run.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] DailyShorts run STARTING" >> daily_run.log

# 1) Make sure Docker + Postiz are up (reads YouTube creds from the container)
bash ensure_postiz.sh >> daily_run.log 2>&1 || true

# 2) Run the autonomous producer headless (adjust path to your claude binary)
claude -p "Execute today's run: follow every instruction in daily_shorts_prompt.md. Work fully autonomously and do not ask any questions." \
  --dangerously-skip-permissions >> daily_run.log 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] DailyShorts run FINISHED" >> daily_run.log
