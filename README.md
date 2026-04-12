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
