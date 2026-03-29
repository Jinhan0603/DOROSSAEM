@echo off
setlocal
title DORO clasp login
cd /d "%~dp0"

echo =====================================================
echo DORO Apps Script - clasp login
echo =====================================================
echo.
echo This window must stay open.
echo After Google approval, your browser may show a localhost error.
echo That is expected for this login flow.
echo.
echo Step 1: approve Google access in browser.
echo Step 2: copy the FULL browser URL.
echo Step 3: paste the FULL URL into this window and press Enter.
echo.

where clasp >nul 2>nul
if errorlevel 1 (
  echo clasp was not found. Installing now...
  call npm.cmd install -g @google/clasp
  if errorlevel 1 (
    echo.
    echo Failed to install clasp.
    set /p _close=Press Enter to close...
    exit /b 1
  )
)

call clasp login --no-localhost
if errorlevel 1 (
  echo.
  echo Login failed.
  set /p _close=Press Enter to close...
  exit /b 1
)

echo.
echo Login completed.
set /p _close=Press Enter to close...
exit /b 0
