# PACTA — Contract Lifecycle Management

Local-first contract management system. Single binary, zero external dependencies.

## Quick Start

```bash
# Download the latest release for your platform
./pacta  # Opens http://127.0.0.1:3000
```

Default login: `admin@pacta.local` / `admin123`

## Features

- Contract CRUD operations with soft delete
- Client & supplier management
- Authorized signers tracking
- Supplements with approval workflow (draft → approved → active)
- Document attachments
- Notifications & alerts for expiring contracts
- Audit logging for all operations
- Role-based access control (admin, manager, editor, viewer)

## Architecture

Single Go binary embedding:
- **SQLite database** (pure Go via `modernc.org/sqlite`, no CGO)
- **Static Next.js frontend** (built with `output: export`)
- **SQL migrations** (applied on startup)

No internet required. All data stays local on your machine.

```
┌──────────────────────────────────────────┐
│  pacta (single Go binary, ~30-50MB)     │
│                                          │
│  1. //go:embed frontend/out/             │
│  2. //go:embed internal/db/*.sql         │
│  3. HTTP server on :3000                 │
│     ├── GET /*     → static files        │
│     └── /api/*     → Go REST API         │
│  4. Opens browser → http://127.0.0.1:3000│
└──────────────────────────────────────────┘
```

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## License

MIT
