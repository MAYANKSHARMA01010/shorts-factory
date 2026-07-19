@echo off
title Shorts Dashboard
cd /d "C:\Dikshant\Money making"
REM only start a server if one isn't already listening on 8899 (avoid duplicate/port-clash instances)
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 8899 -ErrorAction SilentlyContinue)) { Start-Process -FilePath 'C:\Users\diksh\AppData\Local\Programs\Python\Python314\python.exe' -ArgumentList '\"C:\Dikshant\Money making\dashboard.py\"' -WorkingDirectory 'C:\Dikshant\Money making' -WindowStyle Hidden }"
timeout /t 2 >nul
start "" http://localhost:8899
