@echo off
chcp 65001 >nul
title HDS Life Monitor
cd /d "%~dp0"
node "%~dp0life-watcher.js"
echo.
echo [Life Monitor exited]
pause
