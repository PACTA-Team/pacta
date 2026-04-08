# PACTA Desktop — Monorepo Local-First Design

**Date:** 2026-04-08
**Status:** Approved
**Author:** brainstorming session

---

## Summary

Consolidate PACTA's 4 repositories into a single monorepo producing one self-contained Go binary. The binary embeds a static Next.js frontend and a SQLite-backed REST API backend. Zero external dependencies at runtime — no Node.js, no PostgreSQL, no internet required.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  pacta (single Go binary, ~30-50MB)                │
│                                                     │
│  1. //go:embed frontend/out/  (static HTML/CSS/JS) │
│  2. //go:embed migrations/*.sql (SQLite schema)     │
│                                                     │
│  3. HTTP server on :3000                            │
│     ├── GET /*        → static file server          │
│     └── /api/*        → Go backend (SQLite)         │
│                                                     │
│  4. Opens browser → http://127.0.0.1:3000           │
│  5. signal.Notify → clean shutdown                  │
└─────────────────────────────────────────────────────┘
```

**Key properties:**
- Single process, single binary
- No Node.js runtime bundled
- No PostgreSQL — SQLite via `modernc.org/sqlite` (pure Go, no CGO)
- No internet required — fully local
- Session-based auth via httpOnly cookies (no JWT)

---

## Repository Structure

```
pacta/                          (single repo, replaces all 4 current repos)
├── cmd/pacta/main.go           (entry point)
├── internal/
│   ├── server/                 (HTTP router, static + API serving)
│   ├── db/                     (SQLite setup, migrations)
│   ├── handlers/               (REST API handlers)
│   ├── models/                 (Go structs ↔ SQLite)
│   └── config/                 (port, data dir, version)
├── migrations/
│   ├── 001_users.sql
│   ├── 002_clients.sql
│   ├── 003_suppliers.sql
│   ├── 004_authorized_signers.sql
│   ├── 005_contracts.sql
│   ├── 006_supplements.sql
│   ├── 007_documents.sql
│   ├── 008_notifications.sql
│   ├── 009_audit_logs.sql
│   └── 010_refresh_tokens.sql
├── frontend/                   (Next.js App Router → output: export)
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── out/                    (static build → embedded in Go)
├── assets/                     (icons, splash, etc.)
├── .goreleaser.yml
└── go.mod
```

---

## Backend Go

| Layer | Technology | Detail |
|-------|-----------|--------|
| Database | SQLite (`modernc.org/sqlite`) | Pure Go, no CGO, cross-compiles cleanly |
| Migrations | Embedded SQL files | Applied on startup from `//go:embed` |
| Router | `net/http` stdlib + `chi` | Lightweight, no heavy framework |
| Auth | Session-based (httpOnly cookie) | bcrypt passwords, no JWT in localStorage |
| API | REST JSON | Same endpoints the frontend expects |

### API Modules (matching PRD v2.0)

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Contracts | `GET/POST/PUT/DELETE /api/contracts` |
| Clients | `GET/POST/PUT/DELETE /api/clients` |
| Suppliers | `GET/POST/PUT/DELETE /api/suppliers` |
| Signers | `GET/POST/PUT/DELETE /api/signers` |
| Supplements | `GET/POST/PUT /api/supplements` |
| Documents | `POST /api/documents`, `GET /api/documents/:id` |
| Reports | `GET /api/reports/*` |
| Notifications | `GET /api/notifications`, `PUT /api/notifications/:id/read` |
| Audit | `GET /api/audit` |
| Users | `GET/POST/PUT/DELETE /api/users` |

---

## Frontend Next.js

| Aspect | Configuration |
|--------|--------------|
| Output | `output: 'export'` → static HTML/CSS/JS |
| API calls | `fetch('/api/...')` → same origin (Go server) |
| Auth | Cookie-based sessions (no JWT) |
| Data fetching | Client-side (`useEffect` / SWR) |
| Styling | Tailwind CSS + shadcn/ui |
| No SSR needed | All static, hydrates in browser |

---

## Build Pipeline (GoReleaser CI)

```
before hooks:
  1. cd frontend && npm ci && npm run build
     → generates frontend/out/ (static)
  2. go build ./cmd/pacta
     → //go:embed includes frontend/out/ + migrations/

artifacts:
  - pacta_linux_amd64.tar.gz
  - pacta_darwin_amd64.tar.gz
  - pacta_darwin_arm64.tar.gz
  - pacta_windows_amd64.zip
  - pacta.deb
```

---

## Cleanup Plan

| Action | Detail |
|--------|--------|
| Delete | `pacta-backend/`, `pacta-desktop/`, `pacta-docs/`, `docs/` |
| Reference | `pacta_appweb/` kept as UI reference (frontend rewritten from scratch) |
| New | `pacta/` monorepo at root replaces everything |

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Local-first, no external DB server needed |
| Static frontend over Node.js subprocess | Single process, no zombie risk, smaller binary |
| Cookie sessions over JWT | Simpler for local-only, no token management |
| Pure Go SQLite driver | No CGO, clean cross-compilation |
| Next.js static export | Reuse existing UI patterns, no SSR overhead |
