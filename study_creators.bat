@echo off
REM ==== CreatorStudy ? studies top competitor Shorts (/watch) and grows competitor_playbook.md ====
cd /d "C:\Dikshant\Money making"
echo. >> study_run.log
echo ============================================================ >> study_run.log
echo [%DATE% %TIME%] CREATOR STUDY run STARTING >> study_run.log

REM Docker + Postiz DB up (yt_top.py / yt_analytics.py read the YouTube creds from Postiz)
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Dikshant\Money making\ensure_postiz.ps1" >> study_run.log 2>&1

REM run the competitor-intelligence analyst headless
"C:\Users\diksh\AppData\Roaming\npm\claude.cmd" -p "Execute the creator study run: follow every instruction in creator_study_prompt.md. Work fully autonomously and do not ask any questions." --dangerously-skip-permissions >> study_run.log 2>&1

echo [%DATE% %TIME%] CREATOR STUDY run FINISHED >> study_run.log
