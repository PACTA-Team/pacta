#define MyAppName "PACTA"
#define MyAppVersion "{VERSION_PLACEHOLDER}"
#define MyAppPublisher "PACTA Team"
#define MyAppURL "https://github.com/PACTA-Team/pacta_appweb"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=../../LICENSE
OutputDir=.
OutputBaseFilename=pacta-setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=contract_icon.ico
UninstallDisplayIcon={app}\app\PACTA.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "shared\*"; DestDir: "{app}\shared"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "PACTA.exe"; DestDir: "{app}\app"; Flags: ignoreversion

[Run]
; Generate .env file with unique JWT_SECRET
Filename: "cmd.exe"; Parameters: "/c echo # PACTA Environment Configuration > ""{app}\app\.env"" && echo. >> ""{app}\app\.env"" && echo # JWT Secret - Auto-generated during installation >> ""{app}\app\.env"" && echo JWT_SECRET={code:GetJWTSecret} >> ""{app}\app\.env"" && echo. >> ""{app}\app\.env"" && echo # Allowed origins for CORS (comma-separated) >> ""{app}\app\.env"" && echo ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000 >> ""{app}\app\.env"" && echo. >> ""{app}\app\.env"" && echo # Node environment >> ""{app}\app\.env"" && echo NODE_ENV=production >> ""{app}\app\.env"" && echo. >> ""{app}\app\.env"" && echo # Server port >> ""{app}\app\.env"" && echo PORT=3000 >> ""{app}\app\.env"""; Flags: runhidden

; Install NSSM service
Filename: "{app}\nssm.exe"; Parameters: "install Pacta ""{app}\node\node.exe"" ""{app}\app\server.js"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set Pacta AppDirectory ""{app}\app"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set Pacta DisplayName ""{#MyAppName}"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set Pacta Start SERVICE_AUTO_START"; Flags: runhidden

; Set environment variables for the service
Filename: "{app}\nssm.exe"; Parameters: "set Pacta AppEnvironmentExtra ""NODE_ENV=production"" ""PORT=3000"" ""HOSTNAME=0.0.0.0"""; Flags: runhidden

; Configure logging
Filename: "{app}\nssm.exe"; Parameters: "set Pacta AppStdout ""{app}\shared\logs\pacta.log"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set Pacta AppStderr ""{app}\shared\logs\pacta-error.log"""; Flags: runhidden

; Add Windows Firewall rule for port 3000
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""PACTA Server"" dir=in action=allow protocol=TCP localport=3000"; Flags: runhidden

; Start the service
Filename: "{app}\nssm.exe"; Parameters: "start Pacta"; Flags: runhidden

[UninstallRun]
; Stop and remove NSSM service
Filename: "{app}\nssm.exe"; Parameters: "stop Pacta"; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "remove Pacta confirm"; Flags: runhidden
; Remove firewall rule
Filename: "netsh.exe"; Parameters: "advfirewall firewall delete rule name=""PACTA Server"""; Flags: runhidden

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\app\PACTA.exe"; WorkingDir: "{app}\app"; IconFilename: "{app}\app\PACTA.exe"
Name: "{group}\{#MyAppName} (Direct)"; Filename: "{app}\app\PACTA.exe"; Parameters: "--no-wait"; WorkingDir: "{app}\app"; IconFilename: "{app}\app\PACTA.exe"
Name: "{group}\Start PACTA (Manual)"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app\PACTA.exe"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"; IconFilename: "{app}\app\PACTA.exe"

; Desktop icon
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\app\PACTA.exe"; WorkingDir: "{app}\app"; IconFilename: "{app}\app\PACTA.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Code]
function GetJWTSecret(Param: String): String;
var
  Guid: TGuid;
  Secret: String;
begin
  // Generate a unique JWT secret using a GUID + random string
  CreateGuid(Guid);
  Secret := GuidToString(Guid);
  // Remove braces and dashes, take first 32 chars
  StringChangeEx(Secret, '{', '', True);
  StringChangeEx(Secret, '}', '', True);
  StringChangeEx(Secret, '-', '', True);
  Result := Copy(Secret, 1, 32);
end;
