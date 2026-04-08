# PACTA Windows Launcher

## Overview

`PACTA.exe` is a native Windows launcher for the PACTA application with embedded icon and version info. It provides a professional, double-click experience for users.

## Features

- **Custom Icon**: Embedded contract icon from `src/images/contract_icon.ico`
- **Version Info**: File properties show PACTA branding in Windows Explorer
- **Server Health Check**: Automatically checks if the PACTA server is running before opening the browser
- **Auto-Retry**: Retries up to 15 times (30 seconds) waiting for the server to start
- **No Console Window**: Runs silently in the background (GUI mode)
- **Error Handling**: Shows a friendly error message if the server is not available
- **Direct Mode**: Supports `--no-wait` flag to skip server check and open browser immediately

## Usage

### Normal Mode (Default)
```
Double-click PACTA.exe
```
- Checks if server is running at `http://127.0.0.1:3000/next_api/health`
- Opens browser when server is ready
- Shows error if server doesn't respond after 30 seconds

### Direct Mode (Skip Server Check)
```
PACTA.exe --no-wait
```
or
```
PACTA.exe -n
```
- Opens browser immediately without checking server status

## Build Instructions

### Prerequisites
- Go 1.21+ (pre-installed on GitHub Actions `windows-latest`)

### Local Build (Windows)
```bash
cd package/windows/launcher
go build -ldflags="-H windowsgui -s -w" -o ../../../dist/windows/PACTA.exe main.go
```

### CI/CD Build (GitHub Actions)
The launcher is automatically built during the Windows build job:
```yaml
- name: Build PACTA Launcher
  shell: bash
  run: |
    cd package/windows/launcher
    go build -ldflags="-H windowsgui -s -w" -o ../../../dist/windows/PACTA.exe main.go
```

## Distribution

The launcher is distributed in two ways:

1. **Embedded in Installer**: Included in `pacta-setup-vX.X.X.exe`
2. **Standalone**: Available as `PACTA.exe` in GitHub Releases (~6 MB)

## Installation Location

After installation, the launcher is located at:
- `C:\Program Files\PACTA\app\PACTA.exe`

Shortcuts created:
- Start Menu → PACTA → PACTA (with server check)
- Start Menu → PACTA → PACTA (Direct) (no server check)
- Desktop → PACTA (optional, user can enable during install)

## Technical Details

- **Language**: Go (Golang)
- **Dependencies**: None (uses only Go standard library)
- **Binary Size**: ~6 MB (optimized with `-s -w` flags)
- **Subsystem**: Windows GUI (no console window)
- **Cross-platform**: Also supports macOS and Linux (conditional compilation)

## Source Code Structure

```
package/windows/launcher/
├── main.go      # Launcher source code
└── go.mod       # Go module definition
```

## License

MIT License (same as PACTA project)
