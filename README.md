# PACTA

**Contract Lifecycle Management System**

PACTA is a local-first contract management platform designed for organizations that require full control over their data. Distributed as a single binary with zero external dependencies, it runs entirely on your machine -- no cloud, no third-party servers, no data leaving your infrastructure.

---

## Overview

PACTA streamlines the end-to-end contract lifecycle -- from creation and negotiation through execution, renewal, and archival. It provides a modern web interface backed by a lightweight REST API, all embedded within a single Go binary powered by SQLite.

### Key Capabilities

- **Contract Management** -- Full CRUD operations with soft delete, version tracking, and status workflows
- **Party Management** -- Centralized registry of clients, suppliers, and authorized signers
- **Approval Workflows** -- Structured supplement approvals with draft, approved, and active states
- **Document Attachments** -- Link supporting documents directly to contracts and parties
- **Notifications & Alerts** -- Automated reminders for expiring contracts and upcoming renewals
- **Audit Trail** -- Immutable log of all operations for compliance and accountability
- **Role-Based Access Control** -- Granular permissions across admin, manager, editor, and viewer roles

---

## Quick Start

### 1. Download

Get the latest release for your platform from the [Releases](https://github.com/PACTA-Team/pacta/releases) page.

### 2. Run

```bash
./pacta
```

The application starts on `http://127.0.0.1:3000` and opens your browser automatically.

### 3. Log In

| Field    | Value              |
|----------|--------------------|
| Email    | admin@pacta.local  |
| Password | admin123           |

> **Security note:** Change the default credentials immediately after first login.

---

## Supported Platforms

| OS      | Architecture | Format          |
|---------|-------------|-----------------|
| Linux   | amd64       | `.tar.gz`, `.deb` |
| Linux   | arm64       | `.tar.gz`, `.deb` |
| macOS   | amd64       | `.tar.gz`       |
| macOS   | arm64       | `.tar.gz`       |
| Windows | amd64       | `.tar.gz`       |

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

## Development

### Prerequisites

- Go 1.25+
- Node.js 22+
- npm

### Local Setup

```bash
# Terminal 1: Build frontend
cd pacta_appweb
npm ci && npm run build

# Terminal 2: Run Go server
go run ./cmd/pacta
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full development guide.

---

## Security

- **Local-only binding** -- Server listens on `127.0.0.1` only
- **httpOnly, SameSite=Strict cookies** -- Prevents XSS token theft
- **bcrypt password hashing** -- Cost factor 10
- **Parameterized SQL queries** -- No SQL injection vectors
- **Server-side session management** -- Full control over session lifecycle
- **Role-based authorization** -- Enforced at the API handler level

---

## License

MIT License. See [LICENSE](LICENSE) for details.
