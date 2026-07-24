@echo off
REM ===== ClipPilot — command-line interface =====
REM Examples:
REM   cli.bat init
REM   cli.bat enqueue --source "C:\path\video.mp4" --section A --rights owned
REM   cli.bat run
REM   cli.bat list
REM   cli.bat approve 1
REM   cli.bat status
set "PYTHONPATH=%~dp0src"
python -m clippilot %*
