@echo off
REM ==== CreatorStudy - studies top competitor Shorts ====
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
echo. >> runtime\logs\study_run.log
echo ============================================================ >> runtime\logs\study_run.log
echo [%DATE% %TIME%] CREATOR STUDY run STARTING >> runtime\logs\study_run.log

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\runners\windows\ensure_postiz.ps1" >> runtime\logs\study_run.log 2>&1

"C:\Users\diksh\AppData\Roaming\npm\claude.cmd" -p "Execute the creator study run: follow every instruction in pipeline/prompts/creator_study_prompt.md. Work fully autonomously and do not ask any questions." --dangerously-skip-permissions >> runtime\logs\study_run.log 2>&1

echo [%DATE% %TIME%] CREATOR STUDY run FINISHED >> runtime\logs\study_run.log
