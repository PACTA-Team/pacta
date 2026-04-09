# Development Guide

## Prerequisites

- Go 1.23+
- Node.js 22+
- npm

## Running locally

### Terminal 1: Build frontend
```bash
cd pacta_appweb
npm ci
npm run build
```

### Terminal 2: Run Go server
```bash
go run ./cmd/pacta
```

The server starts on `http://127.0.0.1:3000` and opens your browser automatically.

## Project Structure

```
cmd/pacta/              - Entry point
internal/
  server/               - HTTP server, chi router, static serving
  db/                   - SQLite setup & embedded migrations
  handlers/             - REST API handlers
  models/               - Go data structs
  auth/                 - Bcrypt password hashing & session management
  config/               - App configuration (port, data dir, version)
pacta_appweb/           - Next.js frontend (App Router, static export)
  src/app/              - Pages and routes
  src/components/       - React components (shadcn/ui)
  src/contexts/         - React context providers
  src/lib/              - Utility functions
  src/types/            - TypeScript type definitions
frontend/out/           - Static build output (embedded in Go binary)
.goreleaser.yml         - Release configuration
```

## Adding a migration

1. Create `internal/db/NNN_description.sql` in the `internal/db/` directory
2. The migration runner (`internal/db/migrate.go`) auto-applies it on next startup
3. Migrations are tracked in `schema_migrations` table

## Building for release

```bash
# Local build
goreleaser build --single-target --snapshot

# Full release (requires GitHub token)
goreleaser release --clean
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | No | Login with email/password |
| POST | /api/auth/logout | Yes | Destroy session |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/contracts | Yes | List all contracts |
| POST | /api/contracts | Yes | Create contract |
| GET | /api/contracts/{id} | Yes | Get contract |
| PUT | /api/contracts/{id} | Yes | Update contract |
| DELETE | /api/contracts/{id} | Yes | Soft delete contract |
| GET | /api/clients | Yes | List all clients |
| POST | /api/clients | Yes | Create client |
| GET | /api/suppliers | Yes | List all suppliers |
| POST | /api/suppliers | Yes | Create supplier |
