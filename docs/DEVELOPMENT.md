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
cmd/pacta/              - Entry point (embeds React build from pacta_appweb/dist)
internal/
  server/               - HTTP server, chi router, static serving
  db/                   - SQLite setup, migrations (goose), and sqlc queries
  handlers/             - REST API handlers (inject *db.Queries)
  models/               - Go data structs (passed to frontend)
  auth/                 - Bcrypt password hashing & session management
  config/               - App configuration (port, data dir, version)
  ai/                   - MiniRAG (local AI: cgo + ollama + external modes)
  email/                - SMTP email sending (Handlebars templates)
  worker/               - Background workers (contract expiry alerts)
pacta_appweb/           - React frontend (Vite, TypeScript, Tailwind CSS, shadcn/ui)
  src/app/              - Pages and routes (app directory)
  src/components/       - React components (shadcn/ui + custom)
  src/components/landing/ - Landing page with Framer Motion animations
  src/contexts/         - React context providers (Auth, Theme)
  src/lib/              - Utility functions (API client, validators)
  src/types/            - TypeScript type definitions
docs/                   - Documentation
  plans/                - Implementation plans (pre-coding design docs)
  architecture/         - Architecture Decision Records (ADRs)
  adr/                  - ADRs including sqlc migration decision
frontend/out/           - Static build output (embedded in Go binary)
.github/workflows/      - CI/CD (build, test, release)
```

---

## Database Layer (sqlc)

PACTA uses **sqlc v2** for type-safe SQL queries. All queries are written in `.sql` files and generate Go code at build time.

### Directory Structure

```
internal/db/
├── migrations/          # goose migrations (versioned schema changes, auto-applied)
│   ├── 000_initial.sql
│   ├── 001_add_users_table.sql
│   └── ...
├── models.go            # Go structs representing table rows (users, contracts, etc.)
├── queries/             # SQL files organized by domain (SOURCE OF TRUTH)
│   ├── system_settings.sql   # 7 queries
│   ├── users.sql             # 11 queries
│   ├── clients.sql           # 8 queries
│   ├── suppliers.sql         # 8 queries
│   ├── contracts.sql         # 15 queries
│   ├── supplements.sql       # 10 queries
│   ├── documents.sql         # 6 queries
│   ├── authorized_signers.sql # 8 queries
│   ├── sessions.sql          # 5 queries
│   ├── password_reset_tokens.sql
│   ├── registration_codes.sql
│   ├── ai_rate_limits.sql
│   ├── ai_legal.sql          # AI legal documents + chat history
│   ├── companies.sql
│   ├── notifications.sql
│   ├── audit_logs.sql
│   └── ... (~22 files total, 215+ queries)
├── queries_gen.go       # GENERATED CODE — DO NOT EDIT MANUALLY
├── sqlc.yaml            # sqlc configuration (SQLite + interface emission)
├── db.go                # Open(dataDir) and Migrate() helpers
└── rls.go               # RLS (Row Level Security) dynamic policies (manual, not sqlc)
```

### sqlc Configuration

File: `internal/db/sqlc.yaml`

```yaml
version: "2"
sql:
  - schema: "internal/db/migrations/*.sql"   # source for table schemas
    queries: "internal/db/queries/*.sql"     # query files to generate from
    engine: "sqlite"
    gen:
      go_package:
        mode: "query"
        name: "db"
      emit:
        interface: true  # emits Queries interface (for mocking & WithTx)
```

### Generated Code

After `sqlc generate`, `internal/db/queries_gen.go` contains:

- `type Queries struct { db *sql.DB }`
- `func New(db *sql.DB) *Queries` — constructor
- One method per query in `.sql` files, e.g.:

```go
func (q *Queries) GetUserByID(ctx context.Context, id int) (User, error)
func (q *Queries) ListContractsByCompany(ctx context.Context, companyID int) ([]Contract, error)
func (q *Queries) CreateClient(ctx context.Context, arg CreateClientParams) (Client, error)
```

All methods are **type-safe** (correct parameter/return types) and use `context.Context`.

### Using Queries in Handlers

Handlers inject `*db.Queries`:

```go
// internal/handlers/handler.go
type Handler struct {
    DB       *sql.DB
    Queries  *db.Queries
    DataDir  string
    // ...
}

func NewHandler(db *sql.DB, queries *db.Queries, ...) *Handler {
    return &Handler{
        DB: db,
        Queries: queries,
        // ...
    }
}
```

Usage:

```go
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    user, err := h.Queries.GetUserByID(ctx, id)  // type-safe, no SQL string
    if err != nil {
        h.Error(w, http.StatusNotFound, "user not found")
        return
    }

    h.JSON(w, http.StatusOK, user)
}
```

### Adding a New Query

**Step-by-step**:

1. **Create SQL file** (or edit existing): `internal/db/queries/users.sql`

   ```sql
   -- name: GetActiveUsers :many
   SELECT id, name, email, role
   FROM users
   WHERE status = 'active' AND deleted_at IS NULL
   ORDER BY name;
   ```

2. **Generate code**:
   ```bash
   cd internal/db
   sqlc generate
   ```
   This updates `queries_gen.go` with:
   ```go
   func (q *Queries) GetActiveUsers(ctx context.Context) ([]User, error)
   ```

3. **Use in handler**:
   ```go
   users, err := h.Queries.GetActiveUsers(r.Context())
   ```

4. **Commit both files**:
   ```bash
   git add internal/db/queries/users.sql internal/db/queries_gen.go
   git commit -m "feat: add GetActiveUsers query"
   ```

### Modifying Existing Queries

1. Edit the `.sql` file
2. Run `sqlc generate`
3. Update callers if method signature changed
4. Run tests: `go test ./...`
5. Commit both `.sql` and `queries_gen.go`

### Soft-Delete Pattern

All tables with `deleted_at TIMESTAMP` **must** filter `deleted_at IS NULL`:

```sql
SELECT * FROM contracts
WHERE id = $1 AND deleted_at IS NULL;
```

**Exception**: Admin endpoints that need to include deleted records should explicitly NOT include the filter (rare).

### Transactions

Use transaction-aware methods:

```go
tx, err := h.Queries.BeginTx(ctx)
if err != nil { return err }
defer tx.Rollback()

// Use tx.Queries (same methods, but within transaction)
user, err := tx.GetUserByID(ctx, id)
if err != nil { return err }

if err := tx.CreateAuditLog(ctx, CreateAuditLogParams{...}); err != nil {
    return err
}

return tx.Commit()
```

### Testing with sqlc

Since `Queries` is an interface, mocking is straightforward:

```go
type MockQueries struct{}

func (m *MockQueries) GetUserByID(ctx context.Context, id int) (User, error) {
    return User{ID: id, Name: "Test User"}, nil
}

// In test:
handler := NewHandler(nil, &MockQueries{}, ...)
```

---

## Migrations (goose)

Database schema migrations use [goose](https://github.com/pressly/goose). Migrations auto-run on app startup.

### Creating a Migration

```bash
# Create file: internal/db/migrations/042_add_ai_settings.sql
-- +goose Up
CREATE TABLE ai_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE ai_settings;
```

**Naming**: `NNN_description.sql` — sequential 3-digit number (000, 001, ...). Description in snake_case.

**Never edit** already-applied migrations in production. Create a new one instead.

### Running Migrations Manually

```bash
go run ./cmd/pacta  # migrations run automatically on startup
```

Or for dev (with in-memory DB):
```bash
go test ./internal/db -run TestMigrate -v
```

---

## Frontend Development

### Running Dev Server

```bash
cd pacta_appweb
npm ci        # first time only
npm run dev
```

Dev server: `http://localhost:5173` (Vite default). API calls proxy to `http://127.0.0.1:3000`.

### Building for Production

```bash
cd pacta_appweb
npm run build
```

Output: `pacta_appweb/dist/` — embedded into Go binary at build time.

### Component Library (shadcn/ui)

Add components from [shadcn/ui](https://ui.shadcn.com):

```bash
cd pacta_appweb
npx shadcn@latest add button dialog card table
```

Components are installed to `src/components/ui/` and are **customizable** (copy-paste model, not a runtime dependency).

### Styling

- **Tailwind CSS v4** (browser runtime + JIT)
- **Theme**: Dark/light mode via `next-themes` (system-aware)
- **Colors**: CSS variables in `src/index.css` (background, foreground, muted, accent, etc.)
- **Responsive**: Mobile-first breakpoints (`sm:`, `md:`, `lg:`)

### API Client

Frontend talks to backend via REST:

```typescript
// src/lib/api.ts
export const apiClient = createApiClient('/api');

// Usage:
const { data } = await apiClient.get('/contracts');
```

See `src/types/api.ts` for TypeScript interfaces.

---

## Adding Migrations (goose)

**File location**: `internal/db/migrations/NNN_description.sql`

**Template**:
```sql
-- +goose Up
-- SQL to apply migration

-- +goose Down
-- SQL to revert migration
```

**Best practices**:
- Use `AUTOINCREMENT` for primary keys only when necessary (usually `INTEGER PRIMARY KEY` autoincrements)
- Add indexes explicitly (not in migrations unless critical)
- Always provide `-- +goose Down` for reversibility
- Test both up and down: `goose up`, then `goose down`

---

## Running Tests

```bash
# All tests
go test ./...

# With verbose output
go test ./... -v

# Specific package
go test ./internal/handlers -v

# Skip build cache
go test ./... -count=1

# Coverage
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

Frontend tests (if configured):
```bash
cd pacta_appweb
npm test
```

**Note**: Tests use in-memory SQLite (`:memory:`) with migrations auto-run in `TestMain`.

---

## CI/CD

GitHub Actions workflows:

- **build.yml**: Runs on every push — builds frontend, compiles Go binary, runs tests, creates release artifacts
- **release.yml**: On tag `v*` — publishes multi-platform releases via GoReleaser

CI verifies:
- `go test ./...` passes
- `go vet ./...` passes
- `sqlc generate` output is committed (`git diff --exit-code` check)
- Frontend builds (`npm run build` in `pacta_appweb/`)
- Go binary compiles for multiple platforms (linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64)

---

## Troubleshooting Development

### "sqlc: command not found"

Install:
```bash
go install github.com/kyleconroy/sqlc/cmd/sqlc@v1.46.0
```

### Queries not updating after `sqlc generate`

Make sure you're in `internal/db/` directory:
```bash
cd internal/db
sqlc generate
```

### Frontend changes not reflected

The Go binary embeds the frontend on build. After changing frontend code, you must rebuild:

```bash
cd pacta_appweb && npm run build && cd ..
go run ./cmd/pacta
```

### Database connection errors

Check data directory permissions:
```bash
ls -la ~/.pacta/  # default data dir
```

Ensure SQLite can write:
```bash
sqlite3 ~/.pacta/pacta.db "SELECT 1;"
```

### Migrations not running

The `Migrate()` function is called in `cmd/pacta/main.go`. Ensure `db.Migrate(db)` is present after `db.Open()`.

---

## Performance Tips

### Database Indexes

Common query patterns already have indexes:

- `users(email)` — login lookup
- `contracts(company_id, created_at)` — list contracts by company
- `system_settings(key, deleted_at)` — setting lookup

If adding a new frequent query, consider adding an index. Use `EXPLAIN QUERY PLAN` to check.

### SQLite WAL Mode

PACTA enables `PRAGMA journal_mode=WAL` for better concurrency. This creates `-wal` and `-shm` files alongside the database.

### Frontend Bundle Size

- `pacta_appweb/dist/` is embedded in binary (~2–3 MB gzipped)
- Large images → use WebP/AVIF, optimize with `imagemin`
- Code splitting handled by Vite (dynamic imports)

---

## Security Guidelines

- **Never commit secrets** — use environment variables or config files (`.env` ignored)
- **Encryption**: ai_api_key encrypted at rest (see `internal/ai/` for crypto)
- **Passwords**: bcrypt with cost 10 (in `internal/auth/`)
- **Sessions**: secure, httpOnly cookies (in `internal/auth/`)
- **SQL Injection**: prevented by sqlc (prepared statements)
- **XSS**: React escapes by default; use `dangerouslySetInnerHTML` sparingly
- **CSRF**: State-changing endpoints require POST/PUT/DELETE (no GET side-effects)

See [SECURITY.md](SECURITY.md) for responsible disclosure.


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
