@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer from https://nodejs.org
  pause
  exit /b 1
)
node "launch.mjs"
if errorlevel 1 pause
