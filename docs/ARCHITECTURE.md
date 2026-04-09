# Architecture

## Overview

PACTA is a local-first Contract Lifecycle Management (CLM) system distributed as a single Go binary.

## Design Decisions

### Why SQLite?
- Zero external dependencies — no PostgreSQL server needed
- `modernc.org/sqlite` is pure Go — no CGO, clean cross-compilation
- Perfect for single-user local applications
- WAL mode provides good read concurrency

### Why static frontend?
- `output: 'export'` produces plain HTML/CSS/JS
- Go's `net/http` can serve it directly
- No Node.js runtime needed in the final binary
- Smaller binary, faster startup, no zombie processes

### Why cookie sessions?
- Simpler than JWT for local-only applications
- httpOnly cookies prevent XSS token theft
- No localStorage exposure
- Server-side session invalidation

## Data Flow

```
Browser → GET / → static HTML/CSS/JS (embedded)
Browser → POST /api/auth/login → Go handler → SQLite → set session cookie
Browser → GET /api/contracts + cookie → Go handler → SQLite → JSON
```

## Security Model

- All data stays on localhost (127.0.0.1)
- httpOnly, SameSite=Strict cookies
- bcrypt password hashing (cost 10)
- SQL parameterized queries (no injection)
- Role-based access control at API level
