#!/usr/bin/env bash
# ====== ShortsLearn weekly self-improvement runner ======
# macOS equivalent of learn_shorts.bat
cd "$(dirname "$0")"

echo >> learn_run.log
echo "============================================================" >> learn_run.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ShortsLearn run STARTING" >> learn_run.log

bash ensure_postiz.sh >> learn_run.log 2>&1 || true

claude -p "Execute the weekly learning run: follow every instruction in learn_and_improve_prompt.md. Work fully autonomously and do not ask any questions." \
  --dangerously-skip-permissions >> learn_run.log 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ShortsLearn run FINISHED" >> learn_run.log
