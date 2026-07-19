@echo off
title Shorts Automation - Control Panel
cd /d "C:\Dikshant\Money making"
:menu
cls
echo.
echo   ==================================================
echo       SHORTS AUTOMATION  -  one-click control
echo   ==================================================
echo.
echo      [1]  Make + POST a video NOW
echo      [2]  Study top creators NOW  (grow playbook)
echo      [3]  Learn from analytics NOW (improve SKILL.md)
echo      [4]  Run ALL THREE now
echo.
echo      [5]  Email me a DIGEST now (test the email)
echo      [6]  Watch the live log (Ctrl+C to stop)
echo      [7]  Status + next run of every task
echo      [0]  Exit
echo.
set /p "c=   Type a number and press Enter: "
if "%c%"=="1" ( schtasks /Run /TN "DailyShorts"  >nul 2>&1 & echo.& echo    Started: making + posting a video (background, ~30-90 min). & timeout /t 4 >nul & goto menu )
if "%c%"=="2" ( schtasks /Run /TN "CreatorStudy" >nul 2>&1 & echo.& echo    Started: studying top creators. & timeout /t 4 >nul & goto menu )
if "%c%"=="3" ( schtasks /Run /TN "ShortsLearn"  >nul 2>&1 & echo.& echo    Started: learning from analytics. & timeout /t 4 >nul & goto menu )
if "%c%"=="4" ( schtasks /Run /TN "DailyShorts" >nul 2>&1 & schtasks /Run /TN "CreatorStudy" >nul 2>&1 & schtasks /Run /TN "ShortsLearn" >nul 2>&1 & echo.& echo    Started ALL THREE. & timeout /t 4 >nul & goto menu )
if "%c%"=="5" ( echo.& echo    Sending digest email...& docker start postiz postiz-postgres >nul 2>&1 & python daily_digest.py & echo.& pause & goto menu )
if "%c%"=="6" ( echo.& echo    Tailing daily_run.log ... press Ctrl+C to stop.& echo.& powershell -NoProfile -Command "Get-Content 'C:\Dikshant\Money making\daily_run.log' -Tail 30 -Wait" & goto menu )
if "%c%"=="7" ( echo.& powershell -NoProfile -Command "Get-ScheduledTask DailyShorts,CreatorStudy,ShortsLearn,ShortsDigest | ForEach-Object { '{0,-14} {1,-8} next: {2}' -f $_.TaskName, $_.State, (Get-ScheduledTaskInfo -TaskName $_.TaskName).NextRunTime }" & echo.& pause & goto menu )
if "%c%"=="0" exit
goto menu
