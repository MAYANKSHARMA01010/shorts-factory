@echo off
title Shorts Dashboard
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 8899 -ErrorAction SilentlyContinue)) { Start-Process -FilePath 'python' -ArgumentList '\"scripts\publishing\dashboard.py\"' -WorkingDirectory '%ROOT%' -WindowStyle Hidden }"
timeout /t 2 >nul
start "" http://localhost:8899
