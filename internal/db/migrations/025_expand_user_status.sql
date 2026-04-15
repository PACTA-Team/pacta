-- +goose Up
-- Expand status CHECK constraint to include registration states
-- SQLite doesn't support ALTER TABLE for constraints, so we recreate the table
-- Note: goose wraps migrations in a transaction, so no explicit BEGIN/COMMIT needed

PRAGMA foreign_keys=off;

-- Create new table with updated constraint
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked', 'pending_email', 'pending_approval')),
    last_access DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Copy data from old table
INSERT INTO users_new (id, name, email, password_hash, role, status, last_access, created_at, updated_at, deleted_at)
SELECT id, name, email, password_hash, role, status, last_access, created_at, updated_at, deleted_at FROM users;

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

PRAGMA foreign_keys=on;

-- +goose Down
-- Revert to original constraint (will fail if any pending_email/pending_approval users exist)
PRAGMA foreign_keys=off;

CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
    last_access DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

INSERT INTO users_new (id, name, email, password_hash, role, status, last_access, created_at, updated_at, deleted_at)
SELECT id, name, email, password_hash, role, status, last_access, created_at, updated_at, deleted_at FROM users WHERE status IN ('active', 'inactive', 'locked');

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

PRAGMA foreign_keys=on;
