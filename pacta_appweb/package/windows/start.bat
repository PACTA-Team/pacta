@echo off
echo ========================================
echo   PACTA - Manual Server Start
echo ========================================
echo.
echo Starting PACTA server...
echo.

cd /d "%~dp0app"
set NODE_ENV=production
set PORT=3000
set HOSTNAME=0.0.0.0

echo Server URL: http://127.0.0.1:3000
echo Press Ctrl+C to stop the server
echo.

..\node\node.exe server.js

echo.
echo Server stopped.
pause
