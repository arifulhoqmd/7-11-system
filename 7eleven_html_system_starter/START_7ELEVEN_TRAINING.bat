@echo off
setlocal
title 7-Eleven Training Server

cd /d "%~dp0"

set "PYTHON_COMMAND="
python --version >nul 2>&1
if not errorlevel 1 set "PYTHON_COMMAND=python"

if not defined PYTHON_COMMAND (
  py --version >nul 2>&1
  if not errorlevel 1 set "PYTHON_COMMAND=py"
)

if not defined PYTHON_COMMAND (
  echo Python could not be found.
  echo Install Python, then double-click this launcher again.
  echo.
  pause
  exit /b 1
)

echo Starting 7-Eleven Training at http://localhost:8000/
echo Keep this window open while using the app.
echo Press Ctrl+C or close this window to stop the server.
echo.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 750; Start-Process 'http://localhost:8000/'"
%PYTHON_COMMAND% -m http.server 8000

echo.
echo The local training server has stopped.
pause
endlocal
