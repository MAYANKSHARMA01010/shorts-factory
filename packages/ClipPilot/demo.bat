@echo off
REM ===== ClipPilot — instant engine self-test (no GUI, no API key needed) =====
set "PYTHONPATH=%~dp0src"
python -m clippilot demo
echo.
pause
