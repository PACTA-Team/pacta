@echo off
echo Installing PACTA...

set INSTALL_DIR=%ProgramFiles%\PACTA
mkdir "%INSTALL_DIR%"
xcopy /E /I /Y ..\shared "%INSTALL_DIR%\shared"
xcopy /E /I /Y windows "%INSTALL_DIR%\windows"

echo Registering Windows service...
"%INSTALL_DIR%\windows\nssm.exe" install Pacta "%INSTALL_DIR%\windows\node\node.exe" "%INSTALL_DIR%\shared\app\start-production.js"
"%INSTALL_DIR%\windows\nssm.exe" set Pacta AppDirectory "%INSTALL_DIR%\shared\app"
"%INSTALL_DIR%\windows\nssm.exe" set Pacta DisplayName "PACTA Local Server"
"%INSTALL_DIR%\windows\nssm.exe" set Pacta Start SERVICE_AUTO_START
"%INSTALL_DIR%\windows\nssm.exe" start Pacta

echo.
echo =========================================
echo PACTA installed successfully!
echo Access at: http://127.0.0.1:3000
echo For LAN access: Allow port 3000 in Windows Defender Firewall
echo =========================================
pause
