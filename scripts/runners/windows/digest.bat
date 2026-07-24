@echo off
REM ==== ShortsDigest - emails the daily summary ====
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
echo. >> runtime\logs\digest_run.log
echo [%DATE% %TIME%] DIGEST run >> runtime\logs\digest_run.log
docker start postiz postiz-postgres >nul 2>&1
python scripts\publishing\daily_digest.py >> runtime\logs\digest_run.log 2>&1
echo [%DATE% %TIME%] DIGEST done >> runtime\logs\digest_run.log
