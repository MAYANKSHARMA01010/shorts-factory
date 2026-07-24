@echo off
REM ==== ShortsLearn - weekly self-improvement run ====
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
echo. >> runtime\logs\learn_run.log
echo ============================================================ >> runtime\logs\learn_run.log
echo [%DATE% %TIME%] LEARNING run STARTING >> runtime\logs\learn_run.log

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\runners\windows\ensure_postiz.ps1" >> runtime\logs\learn_run.log 2>&1

"C:\Users\diksh\AppData\Roaming\npm\claude.cmd" -p "Execute the weekly learning run: follow every instruction in pipeline/prompts/learn_and_improve_prompt.md. Work fully autonomously and do not ask any questions." --dangerously-skip-permissions >> runtime\logs\learn_run.log 2>&1

echo [%DATE% %TIME%] LEARNING run FINISHED >> runtime\logs\learn_run.log
