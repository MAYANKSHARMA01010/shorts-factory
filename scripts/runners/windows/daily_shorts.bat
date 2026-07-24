@echo off
REM ==== DailyShorts autonomous runner (Task Scheduler -> this file) ====
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
echo. >> runtime\logs\daily_run.log
echo ============================================================ >> runtime\logs\daily_run.log
echo [%DATE% %TIME%] DailyShorts run STARTING >> runtime\logs\daily_run.log

REM 1) make sure Docker + Postiz are up
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\runners\windows\ensure_postiz.ps1" >> runtime\logs\daily_run.log 2>&1

REM 2) run the autonomous producer headless
"C:\Users\diksh\AppData\Roaming\npm\claude.cmd" -p "Execute today's run: follow every instruction in pipeline/prompts/daily_shorts_prompt.md. Work fully autonomously and do not ask any questions." --dangerously-skip-permissions >> runtime\logs\daily_run.log 2>&1

echo [%DATE% %TIME%] DailyShorts run FINISHED >> runtime\logs\daily_run.log
