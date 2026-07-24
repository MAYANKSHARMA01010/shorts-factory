@echo off
REM ==== ShortsDashboard server ====
set "ROOT=%~dp0..\..\.."
cd /d "%ROOT%"
python scripts\publishing\dashboard.py
