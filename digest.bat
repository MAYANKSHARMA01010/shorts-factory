@echo off
REM ==== ShortsDigest ? emails the daily summary (posts + views + studied + decisions) ====
cd /d "C:\Dikshant\Money making"
echo. >> digest_run.log
echo [%DATE% %TIME%] DIGEST run >> digest_run.log
REM ensure the Postiz containers are up (yt_analytics reads YouTube creds from them) ? start, do NOT restart
docker start postiz postiz-postgres >nul 2>&1
python daily_digest.py >> digest_run.log 2>&1
echo [%DATE% %TIME%] DIGEST done >> digest_run.log
