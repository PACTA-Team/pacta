@echo off
echo ========================================
echo   Building PACTA Windows Launcher
echo ========================================
echo.

where go >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Go is not installed or not in PATH
    echo Download from: https://go.dev/dl/
    pause
    exit /b 1
)

go version
echo.

echo Installing goversioninfo tool...
go install github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest

echo.
echo Generating version info with icon...
cd /d "%~dp0launcher"
goversioninfo -o resource_windows.syso

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to generate version info
    pause
    exit /b 1
)

echo.
echo Compiling PACTA.exe with embedded icon...
go build -ldflags="-H windowsgui -s -w" -o ..\PACTA.exe main.go

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: PACTA.exe built successfully!
    echo Location: %~dp0PACTA.exe
    for %%A in ("%~dp0PACTA.exe") do echo Size: %%~zA bytes
) else (
    echo.
    echo ERROR: Failed to build PACTA.exe
)

echo.
pause
