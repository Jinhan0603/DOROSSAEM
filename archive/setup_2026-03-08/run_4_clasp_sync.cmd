@echo off
setlocal
title DORO clasp safe sync
cd /d "%~dp0"

echo =====================================================
echo DORO Apps Script - safe sync
echo =====================================================
echo.
echo Step 1: backup current remote script
echo Step 2: push local apps_script
echo.

call "%~dp0run_2_clasp_pull.cmd"
if errorlevel 1 (
  echo.
  echo Backup step failed.
  set /p _close=Press Enter to close...
  exit /b 1
)

call "%~dp0run_3_clasp_push.cmd"
if errorlevel 1 (
  echo.
  echo Push step failed.
  set /p _close=Press Enter to close...
  exit /b 1
)

echo.
echo Safe sync completed.
set /p _close=Press Enter to close...
exit /b 0
