@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to launch Sales OS.
  echo Install Node.js LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing Sales OS dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

start "" http://127.0.0.1:5173
echo Sales OS v0.071 is starting at http://127.0.0.1:5173
echo Keep this window open while using the app.
call npm.cmd run dev -- --host 127.0.0.1
