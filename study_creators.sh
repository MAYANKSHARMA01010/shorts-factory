#!/usr/bin/env bash
# ====== CreatorStudy daily competitor analysis runner ======
# macOS equivalent of study_creators.bat
cd "$(dirname "$0")"

echo >> study_run.log
echo "============================================================" >> study_run.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] CreatorStudy run STARTING" >> study_run.log

claude -p "Execute today's creator study: follow every instruction in creator_study_prompt.md. Work fully autonomously and do not ask any questions." \
  --dangerously-skip-permissions >> study_run.log 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] CreatorStudy run FINISHED" >> study_run.log
