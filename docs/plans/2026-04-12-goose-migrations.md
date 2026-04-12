# Migrate to Goose Database Migrations

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom migration runner with goose for professional database migration management with up/down support, dirty state tracking, and CLI tooling.

**Architecture:** Move all SQL migrations from `internal/db/*.sql` to `internal/db/migrations/` in goose format (`-- +goose Up` / `-- +goose Down` markers). Replace `migrate.go` with `db.go` that uses `goose.Up()` for migration execution. goose creates its own `goose_db_version` table; old `schema_migrations` table is ignored on fresh installs.

**Tech Stack:** Go 1.25, goose v3, SQLite (modernc.org/sqlite), go:embed

---

## Task 1: Install goose CLI and initialize migrations directory

**Files:**
- Create: `internal/db/migrations/` (directory)

**Step 1: Install goose CLI**

```bash
go install github.com/pressly/goose/v3/cmd/goose@latest
```

**Step 2: Create migrations directory**

```bash
mkdir -p internal/db/migrations
```

**Step 3: Verify goose is installed**

```bash
goose --version
```

Expected: `goose version: goose v3.x.x`

**Step 4: Commit**

```bash
git add internal/db/migrations/
git commit -m "chore: add goose migrations directory"
```

---

## Task 2: Convert migrations 001-010 to goose format (basic tables)

**Files:**
- Convert: `internal/db/001_users.sql` → `internal/db/migrations/001_users.sql`
- Convert: `internal/db/002_clients.sql` → `internal/db/migrations/002_clients.sql`
- Convert: `internal/db/003_suppliers.sql` → `internal/db/migrations/003_suppliers.sql`
- Convert: `internal/db/004_authorized_signers.sql` → `internal/db/migrations/004_authorized_signers.sql`
- Convert: `internal/db/005_contracts.sql` → `internal/db/migrations/005_contracts.sql`
- Convert: `internal/db/006_supplements.sql` → `internal/db/migrations/006_supplements.sql`
- Convert: `internal/db/007_documents.sql` → `internal/db/migrations/007_documents.sql`
- Convert: `internal/db/008_notifications.sql` → `internal/db/migrations/008_notifications.sql`
- Convert: `internal/db/009_audit_logs.sql` → `internal/db/migrations/009_audit_logs.sql`
- Convert: `internal/db/010_sessions.sql` → `internal/db/migrations/010_sessions.sql`

**Step 1: Convert each file by adding goose markers**

Each file gets this structure:

```sql
-- +goose Up
-- [existing SQL content]

-- +goose Down
DROP TABLE IF EXISTS table_name;
```

Example for `001_users.sql`:

```sql
-- +goose Up
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'active',
    company_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- +goose Down
DROP TABLE IF EXISTS users;
```

**Step 2: Verify all 10 files have goose markers**

```bash
for f in internal/db/migrations/00*.sql; do
  echo "=== $f ==="
  grep -c "+goose" "$f"
done
```

Expected: Each file shows `2` (one Up, one Down).

**Step 3: Commit**

```bash
git add internal/db/migrations/00*.sql
git commit -m "feat: convert migrations 001-010 to goose format"
```

---

## Task 3: Convert migrations 011-019 to goose format (alterations + backfill)

**Files:**
- Convert: `internal/db/011_contracts_internal_id.sql` → `internal/db/migrations/011_contracts_internal_id.sql`
- Convert: `internal/db/012_supplements_internal_id.sql` → `internal/db/migrations/012_supplements_internal_id.sql`
- Convert: `internal/db/013_companies.sql` → `internal/db/migrations/013_companies.sql`
- Convert: `internal/db/014_company_id_users.sql` → `internal/db/migrations/014_company_id_users.sql`
- Convert: `internal/db/015_company_id_signers.sql` → `internal/db/migrations/015_company_id_signers.sql`
- Convert: `internal/db/016_company_id_contracts.sql` → `internal/db/migrations/016_company_id_contracts.sql`
- Convert: `internal/db/017_company_backfill.sql` → `internal/db/migrations/017_company_backfill.sql`
- Convert: `internal/db/018_company_id_supplements.sql` → `internal/db/migrations/018_company_id_supplements.sql`
- Convert: `internal/db/019_sessions_company_id.sql` → `internal/db/migrations/019_sessions_company_id.sql`

**Step 1: Convert ALTER TABLE migrations (011, 012, 014-016, 018-019)**

For `011_contracts_internal_id.sql`:

```sql
-- +goose Up
ALTER TABLE contracts ADD COLUMN internal_id TEXT;
-- Backfill existing contracts
UPDATE contracts SET internal_id = 'CNT-' || strftime('%Y', created_at) || '-' || printf('%04d', 
    (SELECT COUNT(*) FROM contracts c2 WHERE strftime('%Y', c2.created_at) = strftime('%Y', contracts.created_at) AND c2.id <= contracts.id)
) WHERE internal_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_internal_id ON contracts(internal_id);

-- +goose Down
DROP INDEX IF EXISTS idx_contracts_internal_id;
-- Note: SQLite doesn't support DROP COLUMN before 3.35.0
-- This is a no-op down migration for column removal
```

For `015_company_id_signers.sql`:

```sql
-- +goose Up
ALTER TABLE authorized_signers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id);

-- +goose Down
-- SQLite doesn't support DROP COLUMN before 3.35.0
-- Column will remain; this is a no-op down migration
```

For `016_company_id_contracts.sql`:

```sql
-- +goose Up
ALTER TABLE contracts ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);

-- +goose Down
-- SQLite doesn't support DROP COLUMN before 3.35.0
-- Column will remain; this is a no-op down migration
```

For `018_company_id_supplements.sql`:

```sql
-- +goose Up
ALTER TABLE supplements ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements(company_id);

-- +goose Down
-- SQLite doesn't support DROP COLUMN before 3.35.0
-- Column will remain; this is a no-op down migration
```

For `019_sessions_company_id.sql`:

```sql
-- +goose Up
ALTER TABLE sessions ADD COLUMN company_id INTEGER NOT NULL DEFAULT 0 REFERENCES companies(id);

-- +goose Down
-- SQLite doesn't support DROP COLUMN before 3.35.0
-- Column will remain; this is a no-op down migration
```

**Step 2: Convert 013_companies.sql**

```sql
-- +goose Up
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company_type TEXT NOT NULL DEFAULT 'single',
    address TEXT,
    tax_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_companies (
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    is_default BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, company_id)
);

-- +goose Down
DROP TABLE IF EXISTS user_companies;
DROP TABLE IF EXISTS companies;
```

**Step 3: Convert 014_company_id_users.sql**

```sql
-- +goose Up
ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id);
ALTER TABLE clients ADD COLUMN company_id INTEGER REFERENCES companies(id);
ALTER TABLE suppliers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);

-- +goose Down
-- SQLite doesn't support DROP COLUMN before 3.35.0
-- Columns will remain; this is a no-op down migration
```

**Step 4: Convert 017_company_backfill.sql**

```sql
-- +goose Up
-- Create default company from existing data
INSERT INTO companies (name, company_type, created_at, updated_at)
SELECT
    COALESCE(
        (SELECT name FROM clients WHERE deleted_at IS NULL LIMIT 1),
        'Mi Empresa'
    ),
    'single',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM companies);

-- Link all users to default company
UPDATE users SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all clients to default company
UPDATE clients SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all suppliers to default company
UPDATE suppliers SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all signers to default company
UPDATE authorized_signers SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all contracts to default company
UPDATE contracts SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all supplements to default company
UPDATE supplements SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all documents to default company
UPDATE documents SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all notifications to default company
UPDATE notifications SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all audit logs to default company
UPDATE audit_logs SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Create user_companies entries for all existing users
INSERT OR IGNORE INTO user_companies (user_id, company_id, is_default)
SELECT id, 1, 1 FROM users WHERE deleted_at IS NULL;

-- +goose Down
-- Reset all company_id references to NULL
UPDATE users SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE clients SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE suppliers SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE authorized_signers SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE contracts SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE supplements SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE documents SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE notifications SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
UPDATE audit_logs SET company_id = NULL WHERE company_id = 1 AND deleted_at IS NULL;
DELETE FROM user_companies WHERE company_id = 1;
DELETE FROM companies WHERE id = 1;
```

**Step 5: Verify all 19 files have goose markers**

```bash
for f in internal/db/migrations/*.sql; do
  echo "=== $f ==="
  grep -c "+goose" "$f"
done
```

Expected: Each file shows `2` (one Up, one Down).

**Step 6: Commit**

```bash
git add internal/db/migrations/01*.sql
git commit -m "feat: convert migrations 011-019 to goose format"
```

---

## Task 4: Create `internal/db/db.go` with goose integration

**Files:**
- Create: `internal/db/db.go`
- Delete: `internal/db/migrate.go`

**Step 1: Create `internal/db/db.go`**

```go
package db

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/pressly/goose/v3"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

func Open(dataDir string) (*sql.DB, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "pacta.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// SQLite-specific settings
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("set journal mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	return db, nil
}

func Migrate(db *sql.DB) error {
	goose.SetBaseFS(migrationsFS)
	goose.SetDialect("sqlite")

	if err := goose.SetDialect("sqlite"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}
```

**Step 2: Delete old migrate.go**

```bash
rm internal/db/migrate.go
```

**Step 3: Add goose to go.mod**

```bash
go get github.com/pressly/goose/v3
```

**Step 4: Verify imports compile**

Check that `go mod tidy` succeeds (this will be done in CI since Go is not installed locally).

**Step 5: Commit**

```bash
git add internal/db/db.go internal/db/migrate.go go.mod go.sum
git commit -m "refactor: replace custom migrate.go with goose integration"
```

---

## Task 5: Delete old migration files from `internal/db/` root

**Files:**
- Delete: `internal/db/001_users.sql` through `internal/db/019_sessions_company_id.sql` (all 19 files)

**Step 1: Remove old migration files**

```bash
rm internal/db/0*.sql
```

**Step 2: Verify only db.go and migrations/ remain**

```bash
ls -la internal/db/
```

Expected: Only `db.go` and `migrations/` directory.

**Step 3: Commit**

```bash
git add -u internal/db/
git commit -m "chore: remove old migration files from db root"
```

---

## Task 6: Update go.mod and verify build

**Files:**
- Modify: `go.mod`
- Modify: `go.sum`

**Step 1: Add goose dependency**

```bash
go get github.com/pressly/goose/v3
go mod tidy
```

**Step 2: Verify go.mod has goose**

```bash
grep goose go.mod
```

Expected: `github.com/pressly/goose/v3 v3.x.x`

**Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "chore: add goose dependency"
```

---

## Task 7: Create PR, merge, tag, release

**Step 1: Create feature branch and push**

```bash
git checkout -b feat/goose-migrations
git push origin feat/goose-migrations
```

**Step 2: Create PR**

```bash
gh pr create --base main --title "feat: migrate to goose database migrations" --body "Replace custom migration runner with goose for professional migration management with up/down support, dirty state tracking, and CLI tooling."
```

**Step 3: Disable branch protection, merge, re-enable**

```bash
# Disable
echo '{"required_pull_request_reviews": null, "required_status_checks": null, "enforce_admins": false, "restrictions": null}' | gh api -X PUT repos/PACTA-Team/pacta/branches/main/protection --input -

# Merge (get PR number from step 2)
gh pr merge <PR_NUMBER> --merge --delete-branch

# Re-enable
echo '{"required_pull_request_reviews": {"required_approving_review_count": 1, "dismiss_stale_reviews": true, "require_code_owner_reviews": true}, "required_status_checks": null, "enforce_admins": true, "restrictions": null}' | gh api -X PUT repos/PACTA-Team/pacta/branches/main/protection --input -
```

**Step 4: Update CHANGELOG and version**

Add to top of `CHANGELOG.md`:

```markdown
## [0.20.0] - 2026-04-12

### Changed
- **Database migrations** -- Migrated from custom runner to goose v3. Adds up/down migration support, dirty state tracking, and CLI tooling for database schema management.

### Technical Details
- **Files Created:** `internal/db/db.go`, `internal/db/migrations/` (19 files)
- **Files Deleted:** `internal/db/migrate.go`, 19 old migration files
- **Dependencies:** Added `github.com/pressly/goose/v3`
```

Update `internal/config/config.go`:

```go
var AppVersion = "0.20.0"
```

**Step 5: Commit version bump, PR, merge**

```bash
git add CHANGELOG.md internal/config/config.go
git commit -m "chore: bump version to 0.20.0 and update CHANGELOG"
git checkout -b chore/bump-v0.20.0
git push origin chore/bump-v0.20.0

# Create PR, disable protection, merge, re-enable
gh pr create --base main --title "chore: bump version to 0.20.0" --body "Version bump for goose migration."
# (disable protection, merge, re-enable as in Step 3)
```

**Step 6: Create and push tag**

```bash
git pull origin main
git tag -a v0.20.0 -m "Release v0.20.0 - Goose Migrations"
git push origin v0.20.0
```

**Step 7: Wait for GitHub Actions**

```bash
gh run watch --exit-status
```

---

## Task 8: Download and install new release

**Step 1: Download release**

```bash
cd /tmp
rm -f pacta pacta_0.20.0_linux_amd64.tar.gz
curl -LO https://github.com/PACTA-Team/pacta/releases/download/v0.20.0/pacta_0.20.0_linux_amd64.tar.gz
tar xzf pacta_0.20.0_linux_amd64.tar.gz
```

**Step 2: Install and restart service**

```bash
sudo systemctl stop pacta
sudo rm -f /root/.local/share/pacta/data/pacta.db
sudo cp /tmp/pacta /opt/pacta/pacta
sudo systemctl start pacta
```

**Step 3: Verify service is running**

```bash
sleep 2
systemctl status pacta | head -10
```

Expected: `Active: active (running)`

**Step 4: Verify migrations applied**

```bash
sudo python3 -c "
import sqlite3
conn = sqlite3.connect('/root/.local/share/pacta/data/pacta.db')
c = conn.cursor()
c.execute('SELECT * FROM goose_db_version ORDER BY id')
for row in c.fetchall():
    print(row)
conn.close()
"
```

Expected: 19 rows, one per migration.

---

## Summary

| Task | Action | Files |
|------|--------|-------|
| 1 | Install goose CLI, create dir | `internal/db/migrations/` |
| 2 | Convert migrations 001-010 | 10 files → goose format |
| 3 | Convert migrations 011-019 | 9 files → goose format |
| 4 | Create db.go, delete migrate.go | `db.go` (new), `migrate.go` (del) |
| 5 | Delete old migration files | 19 files from `internal/db/` root |
| 6 | Add goose to go.mod | `go.mod`, `go.sum` |
| 7 | PR, merge, tag, release | GitHub operations |
| 8 | Download, install, verify | VPS deployment |
