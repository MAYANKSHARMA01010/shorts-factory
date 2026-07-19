@echo off
REM ==== DailyShorts autonomous runner (Task Scheduler -> this file) ====
cd /d "C:\Dikshant\Money making"
echo. >> daily_run.log
echo ============================================================ >> daily_run.log
echo [%DATE% %TIME%] DailyShorts run STARTING >> daily_run.log

REM 1) make sure Docker + Postiz are up (no batch labels; PowerShell does the waiting)
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Dikshant\Money making\ensure_postiz.ps1" >> daily_run.log 2>&1

REM 2) run the autonomous producer headless (skips permission prompts for unattended run)
"C:\Users\diksh\AppData\Roaming\npm\claude.cmd" -p "Execute today's run: follow every instruction in daily_shorts_prompt.md. Work fully autonomously and do not ask any questions." --dangerously-skip-permissions >> daily_run.log 2>&1

echo [%DATE% %TIME%] DailyShorts run FINISHED >> daily_run.log
