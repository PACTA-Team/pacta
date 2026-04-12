# PACTA — Windows Installation Guide (Local)

This guide covers installing and running PACTA on Windows for local, individual use.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS        | Windows 10 (20H2+) | Windows 11 |
| CPU       | x64 (Intel/AMD) | Same |
| RAM       | 512 MB  | 1 GB        |
| Disk      | 100 MB  | 500 MB      |

> **Note:** PACTA is only available for `amd64` (x64) on Windows. ARM64 (Snapdragon) is not supported.

---

## Installation

### 1. Download

1. Go to the [Releases page](https://github.com/PACTA-Team/pacta/releases)
2. Download the latest `pacta_X.X.X_windows_amd64.tar.gz` file
3. Download the `pacta_X.X.X_checksums.txt` file

Or use PowerShell:

```powershell
$VERSION = "0.18.0"
Invoke-WebRequest -Uri "https://github.com/PACTA-Team/pacta/releases/download/v$VERSION/pacta_${VERSION}_windows_amd64.tar.gz" -OutFile "pacta_${VERSION}_windows_amd64.tar.gz"
Invoke-WebRequest -Uri "https://github.com/PACTA-Team/pacta/releases/download/v$VERSION/pacta_${VERSION}_checksums.txt" -OutFile "pacta_${VERSION}_checksums.txt"
```

### 2. Verify Checksums

Open PowerShell and run:

```powershell
$hash = (Get-FileHash "pacta_${VERSION}_windows_amd64.tar.gz" -Algorithm SHA256).Hash.ToLower()
$expected = (Select-String -Path "pacta_${VERSION}_checksums.txt" -Pattern "windows_amd64.tar.gz").Line.Split(":")[1].Trim()
if ($hash -eq $expected) { Write-Host "Checksum OK" -ForegroundColor Green } else { Write-Host "Checksum FAILED" -ForegroundColor Red }
```

### 3. Extract

**Option A: Using 7-Zip**
1. Install [7-Zip](https://www.7-zip.org/) if not already installed
2. Right-click the `.tar.gz` file → 7-Zip → Extract Here
3. Right-click the resulting `.tar` file → 7-Zip → Extract Here

**Option B: Using PowerShell (built-in)**

```powershell
# PowerShell 5+ supports tar.gz natively
Expand-Archive -Path "pacta_${VERSION}_windows_amd64.tar.gz" -DestinationPath "C:\PACTA" -Force
```

### 4. Run PACTA

```powershell
cd C:\PACTA
.\pacta.exe
```

You should see output like:
```
PACTA v0.18.0 starting...
Server listening on http://127.0.0.1:3000
Opening browser...
```

Your default browser will open automatically to `http://127.0.0.1:3000`.

### 5. Log In

| Field    | Value              |
|----------|--------------------|
| Email    | admin@pacta.local  |
| Password | admin123           |

> **Security note:** Change the default credentials after first login.

---

## Creating a Desktop Shortcut

1. Right-click on your desktop → **New** → **Shortcut**
2. Enter the location: `C:\PACTA\pacta.exe`
3. Name it: `PACTA`
4. (Optional) Right-click the shortcut → **Properties** → **Change Icon** → browse to `pacta.exe`

---

## Running PACTA at Startup (Optional)

### Using Task Scheduler

1. Press `Win + R`, type `taskschd.msc`, press Enter
2. Click **Create Basic Task** in the right panel
3. Name: `PACTA`
4. Trigger: **When I log on**
5. Action: **Start a program**
6. Program: `C:\PACTA\pacta.exe`
7. Check **Open the Properties dialog** → check **Run whether user is logged on or not**
8. Click **OK**

PACTA will now start automatically when you log in.

### Using Startup Folder

1. Press `Win + R`, type `shell:startup`, press Enter
2. Create a shortcut to `C:\PACTA\pacta.exe` in this folder

---

## Windows Firewall

PACTA binds to `127.0.0.1` only, so it is not accessible from other machines on the network. Windows Firewall may prompt on first run — click **Allow access**.

If you need to manually add a rule:

```powershell
New-NetFirewallRule -DisplayName "PACTA" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
```

---

## Post-Installation Verification

1. Open your browser to `http://127.0.0.1:3000`
2. You should see the PACTA landing page
3. Click **Login** and sign in with default credentials
4. Verify you can access the dashboard

---

## Updating PACTA

1. Download the latest release from the [Releases page](https://github.com/PACTA-Team/pacta/releases)
2. Stop the running `pacta.exe` (close the terminal or Task Manager)
3. Extract the new version to `C:\PACTA`, overwriting the existing `pacta.exe`
4. Run `.\pacta.exe` again

> **Note:** Database migrations are applied automatically on startup. Your data is preserved.

---

## Troubleshooting

### "Windows protected your PC" (SmartScreen)

If Windows SmartScreen blocks `pacta.exe`:
1. Click **More info**
2. Click **Run anyway**

This happens because the binary is not code-signed. PACTA is safe — it's open-source and built from public GitHub Actions.

### Port 3000 already in use

If another application is using port 3000, set the `PACTA_PORT` environment variable:

```powershell
$env:PACTA_PORT = "8080"
.\pacta.exe
```

For a permanent change:
1. Open **System Properties** → **Environment Variables**
2. Add a new **User variable**: `PACTA_PORT` = `8080`
3. Restart your terminal

### PACTA won't start

1. Check if port 3000 is in use:
   ```powershell
   netstat -ano | findstr :3000
   ```
2. Check Windows Firewall logs for blocked connections
3. Run from Command Prompt to see error output:
   ```cmd
   cd C:\PACTA
   pacta.exe
   ```

### Database location

PACTA stores its SQLite database in the same directory as the executable. To use a different location, set the `PACTA_DATA_DIR` environment variable:

```powershell
$env:PACTA_DATA_DIR = "C:\Users\YourName\AppData\Local\PACTA"
.\pacta.exe
```
