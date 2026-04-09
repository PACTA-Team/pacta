# PACTA — Project Summary

## What is PACTA?

PACTA is a **local-first Contract Lifecycle Management (CLM) system** distributed as a single Go binary. It enables organizations to manage contracts, clients, suppliers, and authorized signers without relying on any external infrastructure -- no cloud services, no third-party databases, no internet connection required.

All data stays on the user's machine. The entire application -- database, frontend, API server, and migrations -- lives inside one executable.

---

## Problem Statement

Traditional contract management tools fall into two categories:

1. **Spreadsheets and email** -- Unstructured, error-prone, no audit trail, impossible to search at scale.
2. **Enterprise SaaS CLM platforms** -- Expensive, require cloud infrastructure, expose sensitive contract data to third parties, complex onboarding.

PACTA occupies the middle ground: a professional-grade contract management system that runs locally, costs nothing to deploy, and keeps all data under the organization's direct control.

---

## Target Users

- **Small to mid-size legal teams** managing 50-500 active contracts
- **Procurement departments** tracking supplier agreements and renewal dates
- **Consulting firms** managing client contracts across multiple engagements
- **Any organization** that needs contract oversight without cloud dependency

---

## Core Features

| Feature | Description |
|---------|-------------|
| Contract CRUD | Create, read, update, delete contracts with soft delete protection |
| Party Management | Centralized registry of clients and suppliers with contact details |
| Signer Tracking | Record authorized signers for each party and track execution status |
| Approval Workflows | Supplement lifecycle: draft → approved → active with status transitions |
| Document Attachments | Link supporting documents (PDFs, scans) to contracts and parties |
| Notifications | Automated alerts for expiring contracts and upcoming renewals |
| Audit Logging | Immutable record of every create, update, and delete operation |
| Role-Based Access | Four roles (admin, manager, editor, viewer) with granular permissions |
| Session Management | Secure cookie-based authentication with server-side invalidation |

---

## Technical Architecture

### Design Principles

1. **Zero external dependencies** -- No PostgreSQL, Redis, or external services required
2. **Single binary distribution** -- Download, run, done
3. **Local-first data** -- All data stays on the machine; no telemetry, no cloud sync
4. **Pure Go** -- No CGO, clean cross-compilation to all major platforms
5. **Embedded everything** -- Frontend, database, migrations all bundled at compile time

### Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend runtime | Go 1.25 | Fast startup, small binary, excellent stdlib |
| Database | SQLite (`modernc.org/sqlite`) | Pure Go, zero-config, perfect for single-user |
| HTTP router | `go-chi/chi` | Lightweight, idiomatic, middleware support |
| Frontend framework | React 19 + TypeScript | Type-safe, component-based, large ecosystem |
| Build tool | Vite | Fast HMR during development, optimized production builds |
| Styling | Tailwind CSS v4 | Utility-first, consistent design tokens |
| UI components | shadcn/ui | Accessible, customizable, no component library lock-in |
| Packaging | GoReleaser + NFPM | Automated multi-platform builds, .deb package generation |

### Data Flow

```
Browser → GET / → static HTML/CSS/JS (embedded in binary)
Browser → POST /api/auth/login → Go handler → SQLite → set session cookie
Browser → GET /api/contracts + cookie → Go handler → SQLite → JSON response
```

### Security Model

- Server binds to `127.0.0.1` only -- inaccessible from network
- httpOnly, SameSite=Strict cookies -- no XSS token theft
- bcrypt password hashing (cost 10)
- All SQL queries use parameterized statements -- no injection vectors
- Role-based authorization enforced at API handler level
- Server-side session invalidation on logout

---

## Project Structure

```
pacta/
├── cmd/pacta/              # Entry point + embedded frontend dist
│   ├── main.go             # Application bootstrap
│   └── embed.go            # //go:embed all:dist
├── internal/
│   ├── auth/               # Session management, bcrypt hashing
│   ├── config/             # Application configuration
│   ├── db/                 # SQLite setup + embedded SQL migrations
│   ├── handlers/           # REST API handlers (contracts, clients, suppliers)
│   ├── models/             # Go data structures
│   └── server/             # HTTP server, chi router, static serving
├── pacta_appweb/           # React + TypeScript frontend
│   ├── src/
│   │   ├── app/            # Pages and routes
│   │   ├── components/     # React components (shadcn/ui)
│   │   ├── contexts/       # React context providers
│   │   ├── lib/            # Utility functions
│   │   └── types/          # TypeScript type definitions
│   └── vite.config.ts      # Vite build configuration
├── .github/workflows/      # CI/CD (GoReleaser release pipeline)
├── .goreleaser.yml         # Release configuration
└── docs/                   # Architecture, development guides
```

---

## Build & Release Pipeline

The CI/CD pipeline runs on GitHub Actions triggered by version tags (`v*`):

1. **Checkout** repository with full history
2. **Setup** Go 1.25 and Node.js 22
3. **Build frontend** (`npm ci && npm run build` in `pacta_appweb/`)
4. **Copy dist** to `cmd/pacta/dist/` for Go embedding
5. **GoReleaser** builds binaries for 5 platform targets
6. **Package** as `.tar.gz` archives and `.deb` packages
7. **Publish** to GitHub Releases with checksums

### Supported Build Targets

| OS | Arch | Output |
|----|------|--------|
| Linux | amd64 | binary + .deb |
| Linux | arm64 | binary + .deb |
| macOS | amd64 | binary |
| macOS | arm64 | binary |
| Windows | amd64 | binary |

---

## Current Status

| Area | Status |
|------|--------|
| Authentication | Complete (login, logout, session management) |
| Contract CRUD | Complete (create, read, update, soft delete) |
| Client Management | Complete |
| Supplier Management | Complete |
| Signer Tracking | Complete |
| Supplement Workflows | Complete |
| Document Attachments | Complete |
| Notifications | Complete |
| Audit Logging | Complete |
| Role-Based Access | Complete |
| CI/CD Pipeline | Complete |
| Multi-platform Builds | Complete |

---

## Future Roadmap

- [ ] Contract template system with variable substitution
- [ ] Bulk operations (export, import, status updates)
- [ ] Advanced search with full-text indexing
- [ ] Contract comparison view (side-by-side diff)
- [ ] Email notifications for renewal alerts
- [ ] Custom role definitions and permission matrices
- [ ] Data export (CSV, PDF report generation)
- [ ] Backup and restore utilities
- [ ] Multi-language UI support (i18n)

---

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | SQLite over PostgreSQL | Zero external dependencies, perfect for single-user local apps |
| Frontend | Static export over SSR | No Node.js runtime needed, smaller binary, faster startup |
| Sessions | Cookies over JWT | Simpler for local-only apps, httpOnly prevents XSS theft |
| Embed location | `cmd/pacta/` over `internal/server/` | Go embed paths are relative to source file; must be at build root |
| Build pipeline | GoReleaser over manual scripts | Automated multi-platform builds, checksums, release management |

---

## License

MIT License. See [LICENSE](LICENSE) for details.
