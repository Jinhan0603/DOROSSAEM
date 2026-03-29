@echo off
setlocal
title DORO clasp remote backup
cd /d "%~dp0"

echo =====================================================
echo DORO Apps Script - remote backup pull
echo =====================================================
echo.
echo This script does NOT overwrite your local apps_script folder.
echo It pulls the current remote Apps Script into:
echo remote_backup\apps_script
echo.

if not exist "remote_backup" mkdir "remote_backup"
copy /Y ".clasp.json" "remote_backup\.clasp.json" >nul

pushd "remote_backup"
call clasp pull
if errorlevel 1 (
  popd
  echo.
  echo Remote backup pull failed.
  set /p _close=Press Enter to close...
  exit /b 1
)
popd

echo.
echo Remote backup completed.
echo Folder: remote_backup\apps_script
set /p _close=Press Enter to close...
exit /b 0
