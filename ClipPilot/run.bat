@echo off
REM ===== ClipPilot — launch the native Windows GUI =====
REM Double-click this file, or run it from a terminal.
set "PYTHONPATH=%~dp0src"
python -m clippilot.ui %*
if errorlevel 1 (
  echo.
  echo ClipPilot exited with an error. Make sure Python 3 and the deps are installed:
  echo   python -m pip install -r "%~dp0src\requirements.txt"
  pause
)
