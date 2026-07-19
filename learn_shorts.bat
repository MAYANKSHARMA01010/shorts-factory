@echo off
REM ==== ShortsLearn ? weekly self-improvement run (reads YouTube analytics, researches, improves SKILL.md) ====
cd /d "C:\Dikshant\Money making"
echo. >> learn_run.log
echo ============================================================ >> learn_run.log
echo [%DATE% %TIME%] LEARNING run STARTING >> learn_run.log

REM make sure Docker + Postiz DB are up (yt_analytics.py reads the YouTube creds from Postiz)
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Dikshant\Money making\ensure_postiz.ps1" >> learn_run.log 2>&1

REM run the learning analyst headless
"C:\Users\diksh\AppData\Roaming\npm\claude.cmd" -p "Execute the weekly learning run: follow every instruction in learn_and_improve_prompt.md. Work fully autonomously and do not ask any questions." --dangerously-skip-permissions >> learn_run.log 2>&1

echo [%DATE% %TIME%] LEARNING run FINISHED >> learn_run.log
