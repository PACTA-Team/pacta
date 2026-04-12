# README Redesign & Installation Guides Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Redesign README.md with professional badges, updated features, changelog table, and create comprehensive installation guides for Linux (production) and Windows (local).

**Architecture:** Three documentation files: redesigned README.md (hub), Linux installation guide (production deployment), Windows installation guide (local use). README links to both guides. All files use consistent Markdown formatting with shields.io badges.

**Tech Stack:** Markdown, shields.io badges, systemd, Caddy, Nginx, PowerShell

---

### Task 1: Create Linux Installation Guide

**Files:**
- Create: `docs/INSTALLATION-LINUX.md`

**Content:**

```markdown
# PACTA — Linux Installation Guide (Production)

This guide covers installing PACTA on Linux servers for production use. It includes systemd service configuration, reverse proxy setup, and firewall rules.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU       | 1 core  | 2 cores     |
| RAM       | 512 MB  | 1 GB        |
| Disk      | 100 MB  | 500 MB      |
| OS        | Debian 11+, Ubuntu 22.04+, RHEL 9+, Alpine 3.18+ | Same |
| Kernel    | 5.10+   | 6.1+        |

PACTA is a single static binary with zero runtime dependencies. It works on any Linux distribution that supports the target architecture.

---

## Method A: Debian Package (Recommended for Debian/Ubuntu)

### 1. Download the .deb package

```bash
VERSION="0.18.0"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_amd64.deb"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_checksums.txt"
```

### 2. Verify checksums

```bash
sha256sum -c pacta_${VERSION}_checksums.txt --ignore-missing
```

Expected output:
```
pacta_${VERSION}_linux_amd64.deb: OK
```

### 3. Install

```bash
sudo dpkg -i pacta_${VERSION}_linux_amd64.deb
```

### 4. Verify installation

```bash
pacta --version
```

Expected output: `v0.18.0`

---

## Method B: Generic Tarball (Any Linux Distribution)

### 1. Download the tarball

```bash
VERSION="0.18.0"
ARCH="amd64"  # or "arm64"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_${ARCH}.tar.gz"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_checksums.txt"
```

### 2. Verify checksums

```bash
sha256sum -c pacta_${VERSION}_checksums.txt --ignore-missing
```

### 3. Extract and install

```bash
tar xzf pacta_${VERSION}_linux_${ARCH}.tar.gz
sudo mv pacta /usr/local/bin/pacta
sudo chmod +x /usr/local/bin/pacta
```

### 4. Verify installation

```bash
pacta --version
```

---

## Running as a systemd Service

### 1. Create the service file

```bash
sudo tee /etc/systemd/system/pacta.service > /dev/null << 'EOF'
[Unit]
Description=PACTA Contract Management System
Documentation=https://github.com/PACTA-Team/pacta
After=network.target

[Service]
Type=simple
User=pacta
Group=pacta
ExecStart=/usr/local/bin/pacta
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pacta

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/pacta

[Install]
WantedBy=multi-user.target
EOF
```

### 2. Create the pacta user and data directory

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin pacta
sudo mkdir -p /var/lib/pacta
sudo chown pacta:pacta /var/lib/pacta
```

### 3. Enable and start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pacta
sudo systemctl status pacta
```

### 4. View logs

```bash
sudo journalctl -u pacta -f --no-pager
```

---

## Reverse Proxy Configuration

PACTA listens on `127.0.0.1:3000` by default. For production access, configure a reverse proxy with HTTPS.

### Option 1: Caddy (Recommended — Automatic HTTPS)

Install Caddy: https://caddyserver.com/docs/install

Create `/etc/caddy/Caddyfile`:

```
pacta.example.com {
    reverse_proxy 127.0.0.1:3000

    encode gzip
    log {
        output file /var/log/caddy/pacta-access.log
    }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

Caddy automatically obtains and renews Let's Encrypt SSL certificates.

### Option 2: Nginx

Install Nginx: `sudo apt install nginx` (Debian/Ubuntu) or `sudo dnf install nginx` (RHEL/Fedora)

Create `/etc/nginx/sites-available/pacta`:

```nginx
server {
    listen 80;
    server_name pacta.example.com;

    # Redirect HTTP to HTTPS (after SSL is configured)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pacta.example.com;

    ssl_certificate     /etc/ssl/certs/pacta.example.com.crt;
    ssl_certificate_key /etc/ssl/private/pacta.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/pacta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Firewall Configuration

### UFW (Debian/Ubuntu)

```bash
# Allow HTTPS
sudo ufw allow 443/tcp
# Allow HTTP (for Let's Encrypt validation)
sudo ufw allow 80/tcp
sudo ufw reload
```

### firewalld (RHEL/Fedora/CentOS)

```bash
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

---

## Post-Installation Verification

1. Check the service is running:
   ```bash
   sudo systemctl status pacta
   ```

2. Test local access:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
   ```
   Expected: `200`

3. Test proxy access:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://pacta.example.com
   ```
   Expected: `200`

4. Open your browser and navigate to `https://pacta.example.com`

5. Log in with default credentials:
   - Email: `admin@pacta.local`
   - Password: `admin123`

---

## Updating PACTA

### Debian Package

```bash
VERSION="0.19.0"  # New version
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_amd64.deb"
sudo dpkg -i pacta_${VERSION}_linux_amd64.deb
sudo systemctl restart pacta
pacta --version
```

### Tarball

```bash
VERSION="0.19.0"  # New version
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_amd64.tar.gz"
tar xzf pacta_${VERSION}_linux_amd64.tar.gz
sudo mv pacta /usr/local/bin/pacta
sudo systemctl restart pacta
pacta --version
```

> **Note:** Database migrations are applied automatically on startup. No manual migration steps are needed.

---

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u pacta -n 50 --no-pager

# Check if port 3000 is in use
sudo ss -tlnp | grep 3000

# Check file permissions
ls -la /usr/local/bin/pacta
ls -la /var/lib/pacta
```

### Port already in use

If another process is using port 3000, set the `PACTA_PORT` environment variable:

```bash
# Edit the systemd service file
sudo systemctl edit pacta

# Add:
[Service]
Environment=PACTA_PORT=8080

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart pacta
```

### Database corruption

PACTA uses SQLite. If the database becomes corrupted:

```bash
# Stop the service
sudo systemctl stop pacta

# Backup the database
sudo cp /var/lib/pacta/pacta.db /var/lib/pacta/pacta.db.bak

# Remove and restart (creates fresh database)
sudo rm /var/lib/pacta/pacta.db
sudo systemctl start pacta
```

### Reverse proxy returns 502

```bash
# Verify PACTA is running
curl -v http://127.0.0.1:3000

# Check proxy configuration
sudo nginx -t  # or sudo caddy validate

# Check SELinux (RHEL/Fedora)
sudo setsebool -P httpd_can_network_connect 1
```
```

**Commit:**
```bash
git add docs/INSTALLATION-LINUX.md
git commit -m "docs: add Linux production installation guide"
```

---

### Task 2: Create Windows Installation Guide

**Files:**
- Create: `docs/INSTALLATION-WINDOWS.md`

**Content:**

```markdown
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
```

**Commit:**
```bash
git add docs/INSTALLATION-WINDOWS.md
git commit -m "docs: add Windows local installation guide"
```

---

### Task 3: Redesign README.md

**Files:**
- Modify: `README.md`

**Content:** Replace the entire README.md with:

```markdown
# PACTA

**Contract Lifecycle Management System**

[![Release](https://img.shields.io/github/v/release/PACTA-Team/pacta?sort=semver&color=green)](https://github.com/PACTA-Team/pacta/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/PACTA-Team/pacta)](https://goreportcard.com/report/github.com/PACTA-Team/pacta)
[![CI](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml/badge.svg)](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/github/downloads/PACTA-Team/pacta/total?color=orange)](https://github.com/PACTA-Team/pacta/releases)

PACTA is a local-first contract management platform designed for organizations that require full control over their data. Distributed as a single binary with zero external dependencies, it runs entirely on your machine — no cloud, no third-party servers, no data leaving your infrastructure.

---

## Features

- **Contract Management** — Full CRUD operations with soft delete, version tracking, and status workflows
- **Modern Landing Page** — Animated landing page with Framer Motion, feature showcase, and quick access to login
- **Party Management** — Centralized registry of clients, suppliers, and authorized signers
- **Approval Workflows** — Structured supplement approvals with draft, approved, and active states
- **Document Attachments** — Link supporting documents directly to contracts and parties
- **Notifications & Alerts** — Automated reminders for expiring contracts and upcoming renewals
- **Audit Trail** — Immutable log of all operations for compliance and accountability
- **Role-Based Access Control** — Granular permissions across admin, manager, editor, and viewer roles
- **Multi-Company Support** — Single company and parent + subsidiaries modes with complete data isolation
- **Setup Wizard** — Guided initial configuration for admin user, clients, and suppliers
- **Dark/Light Theme** — System-aware theme toggle with persistent preferences
- **Zero External Dependencies** — Single static binary, embedded SQLite, no database server required

---

## Quick Start

### 1. Download

Get the latest release for your platform from the [Releases](https://github.com/PACTA-Team/pacta/releases) page.

### 2. Install

| Platform | Guide |
|----------|-------|
| 🐧 Linux (Production) | [Installation Guide →](docs/INSTALLATION-LINUX.md) |
| 🪟 Windows (Local) | [Installation Guide →](docs/INSTALLATION-WINDOWS.md) |
| 🍎 macOS | Download `.tar.gz` from [Releases](https://github.com/PACTA-Team/pacta/releases), extract, run `./pacta` |

### 3. Run

```bash
./pacta
```

The application starts on `http://127.0.0.1:3000` and opens your browser automatically.

### 4. Log In

| Field    | Value              |
|----------|--------------------|
| Email    | admin@pacta.local  |
| Password | admin123           |

> **Security note:** Change the default credentials immediately after first login.

---

## Supported Platforms

| OS      | Architecture | Format          | Guide |
|---------|-------------|-----------------|-------|
| Linux   | amd64       | `.tar.gz`, `.deb` | [Linux Guide →](docs/INSTALLATION-LINUX.md) |
| Linux   | arm64       | `.tar.gz`, `.deb` | [Linux Guide →](docs/INSTALLATION-LINUX.md) |
| macOS   | amd64       | `.tar.gz`       | Extract and run `./pacta` |
| macOS   | arm64       | `.tar.gz`       | Extract and run `./pacta` |
| Windows | amd64       | `.tar.gz`       | [Windows Guide →](docs/INSTALLATION-WINDOWS.md) |

---

## Architecture

PACTA follows a minimalist, self-contained architecture:

```
┌──────────────────────────────────────────────┐
│  pacta (single Go binary)                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Embedded React + TypeScript frontend  │  │
│  │  (Vite build, statically generated)    │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  SQLite database (pure Go, no CGO)     │  │
│  │  └─ SQL migrations (auto-applied)      │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  HTTP server (:3000)                   │  │
│  │  ├── GET /*    → static frontend       │  │
│  │  └── /api/*    → REST API (chi router) │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  All data stays local. No internet required. │
└──────────────────────────────────────────────┘
```

### Technology Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Backend      | Go 1.25, chi router                 |
| Database     | SQLite (`modernc.org/sqlite`, pure Go) |
| Frontend     | React 19, TypeScript, Vite, Tailwind CSS |
| UI Components| shadcn/ui                           |
| Animations   | Framer Motion                       |
| Auth         | Cookie-based sessions, bcrypt       |
| Packaging    | GoReleaser, NFPM (.deb)             |

---

## API Reference

| Method   | Path                  | Auth | Description            |
|----------|-----------------------|------|------------------------|
| `POST`   | `/api/auth/login`     | No   | Authenticate user      |
| `POST`   | `/api/auth/logout`    | Yes  | Destroy session        |
| `GET`    | `/api/auth/me`        | Yes  | Get current user       |
| `GET`    | `/api/contracts`      | Yes  | List contracts         |
| `POST`   | `/api/contracts`      | Yes  | Create contract        |
| `GET`    | `/api/contracts/{id}` | Yes  | Get contract by ID     |
| `PUT`    | `/api/contracts/{id}` | Yes  | Update contract        |
| `DELETE` | `/api/contracts/{id}` | Yes  | Soft delete contract   |
| `GET`    | `/api/clients`        | Yes  | List clients           |
| `POST`   | `/api/clients`        | Yes  | Create client          |
| `GET`    | `/api/suppliers`      | Yes  | List suppliers         |
| `POST`   | `/api/suppliers`      | Yes  | Create supplier        |

---

## Changelog

| Version | Date | Type | Highlights |
|---------|------|------|------------|
| [v0.18.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.18.0) | 2026-04-11 | ✨ Feature | Landing page, theme toggle fix, Framer Motion animations |
| [v0.17.1](https://github.com/PACTA-Team/pacta/releases/tag/v0.17.1) | 2026-04-11 | 🐛 Fix | Setup wizard improvements |
| [v0.17.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.17.0) | 2026-04-11 | ✨ Feature | Multi-company support, setup wizard |
| [v0.16.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.16.0) | 2026-04-11 | ✨ Feature | Company CRUD, database migrations 013-018 |
| [v0.15.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.15.0) | 2026-04-10 | ✨ Feature | Notifications system, email alerts |

[View full changelog →](CHANGELOG.md)

---

## Development

See the [Development Guide](docs/DEVELOPMENT.md) for prerequisites, local setup, and contribution guidelines.

Quick start for developers:

```bash
# Terminal 1: Build frontend
cd pacta_appweb
npm ci && npm run build

# Terminal 2: Run Go server
cd ..
go run ./cmd/pacta
```

---

## Security

- **Local-only binding** — Server listens on `127.0.0.1` only
- **httpOnly, SameSite=Strict cookies** — Prevents XSS token theft
- **bcrypt password hashing** — Cost factor 10
- **Parameterized SQL queries** — No SQL injection vectors
- **Server-side session management** — Full control over session lifecycle
- **Role-based authorization** — Enforced at the API handler level

---

## License

MIT License. See [LICENSE](LICENSE) for details.
```

**Commit:**
```bash
git add README.md
git commit -m "docs: redesign README with badges, updated features, and changelog table"
```

---

## Summary of Changes

| Task | Files Changed | Type |
|------|--------------|------|
| 1 | `docs/INSTALLATION-LINUX.md` | Create |
| 2 | `docs/INSTALLATION-WINDOWS.md` | Create |
| 3 | `README.md` | Modify |

**Total**: 2 new files, 1 modified file, 3 tasks
