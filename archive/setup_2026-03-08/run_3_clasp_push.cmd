@echo off
setlocal
title DORO clasp push
cd /d "%~dp0"

echo =====================================================
echo DORO Apps Script - clasp push
echo =====================================================
echo.

call clasp push
if errorlevel 1 (
  echo.
  echo Push failed. Run run_1_clasp_login.cmd first.
  set /p _close=Press Enter to close...
  exit /b 1
)

echo.
echo Push completed.
set /p _close=Press Enter to close...
exit /b 0
