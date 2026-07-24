@echo off
set COMP=%1
set SLUG=%2
set NAME=%~3

echo [1/3] Rendering %COMP%...
call npx remotion render src/index.ts %COMP% out/%SLUG%.mp4 --concurrency=2

echo [2/3] Recutting %SLUG%...
call python ..\..\.claude\skills\punchy-recut\recut.py --input out/%SLUG%.mp4 --punch 0 --speed 1.12 --sfx-every 3 --gameplay-dir ..\..\downloads\gta5-gameplay --gameplay-fit pad

echo [3/3] Burning captions...
call python "C:\Users\diksh\.gemini\antigravity\brain\51005ce2-fd24-42cc-baec-97708e2adff8\scratch\burn_auto.py" %SLUG% "%NAME%"
