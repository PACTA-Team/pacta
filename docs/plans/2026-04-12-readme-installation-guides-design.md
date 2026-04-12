# README Redesign & Installation Guides Design

**Date**: 2026-04-12
**Status**: Approved

## Problem Statement

1. README lacks professional badges, updated features (landing page, theme toggle), and a version history table.
2. No installation guides exist for production (Linux) or local (Windows) deployment.
3. Users need comprehensive guides covering system requirements, reverse proxy, systemd, firewall, and troubleshooting.

## Solution

### 1. README.md Redesign

**New structure:**
- Badges row (Release, License, Go Report Card, CI, Downloads, Stars)
- Tagline + brief description
- Features section (updated with v0.18.0 additions)
- Quick Start (simplified, links to installation guides)
- Installation table (OS, arch, format, link to guide)
- Architecture (unchanged)
- API Reference (unchanged)
- Changelog table (last 5 versions + link to full CHANGELOG.md)
- Development (link to docs/DEVELOPMENT.md)
- Security (unchanged)
- License (unchanged)

**Badges (shields.io):**
- `![Release](https://img.shields.io/github/v/release/PACTA-Team/pacta?sort=semver)`
- `![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)`
- `![Go Report Card](https://goreportcard.com/badge/github.com/PACTA-Team/pacta)`
- `![CI](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml/badge.svg)`
- `![Downloads](https://img.shields.io/github/downloads/PACTA-Team/pacta/total)`

**Changelog table format:**
| Version | Date | Type | Highlights |
| v0.18.0 | 2026-04-11 | Feature | Landing page, theme toggle fix |
| v0.17.1 | 2026-04-11 | Fix | Setup wizard fixes |
| v0.17.0 | 2026-04-11 | Feature | Multi-company support |
| v0.16.0 | 2026-04-11 | Feature | Company CRUD, migrations |
| v0.15.0 | ... | ... | [Full changelog →](CHANGELOG.md) |

### 2. Linux Installation Guide (Production)

**File:** `docs/INSTALLATION-LINUX.md`

**Sections:**
1. System requirements (RAM, CPU, disk, kernel)
2. Method A: .deb package (Debian/Ubuntu)
3. Method B: Generic tarball (any distro)
4. SHA256 checksum verification
5. systemd service configuration (full unit file)
6. Reverse proxy: Caddy (Caddyfile with auto HTTPS)
7. Reverse proxy: Nginx (server block with SSL)
8. Firewall configuration (ufw + firewalld)
9. Post-installation verification
10. Updating between versions
11. Troubleshooting (journalctl, ports, permissions)

### 3. Windows Installation Guide (Local)

**File:** `docs/INSTALLATION-WINDOWS.md`

**Sections:**
1. System requirements (Windows 10+, RAM, disk)
2. Download from GitHub Releases
3. Extraction (7-Zip / PowerShell Expand-Archive)
4. Running pacta.exe
5. Browser access (http://127.0.0.1:3000)
6. Create desktop shortcut
7. Auto-start on login (Task Scheduler)
8. Post-installation verification
9. Updating between versions
10. Troubleshooting (Windows Firewall, ports)

## Files

**New:**
- `docs/INSTALLATION-LINUX.md`
- `docs/INSTALLATION-WINDOWS.md`

**Modified:**
- `README.md`
