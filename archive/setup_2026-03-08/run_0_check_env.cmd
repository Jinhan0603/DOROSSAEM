@echo off
setlocal
title DORO environment check
cd /d "%~dp0"

echo =====================================================
echo DORO Apps Script - environment check
echo =====================================================
echo.
echo Project folder:
cd
echo.

echo [1] node
where node
if errorlevel 1 echo node NOT found
echo.

echo [2] npm
where npm
if errorlevel 1 echo npm NOT found
echo.

echo [3] clasp
where clasp
if errorlevel 1 echo clasp NOT found
echo.

echo [4] clasp config
if exist ".clasp.json" (
  type ".clasp.json"
) else (
  echo .clasp.json NOT found
)
echo.

set /p _close=Press Enter to close...
exit /b 0
