-- +goose Up
-- SQLite doesn't support ALTER COLUMN for nullability changes directly
-- We need to recreate the table
ALTER TABLE contracts RENAME TO contracts_old;

CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_number TEXT NOT NULL UNIQUE,
    title TEXT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'service',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'completed')),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    company_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Copy data from old table
INSERT INTO contracts (id, contract_number, title, client_id, supplier_id, client_signer_id, supplier_signer_id, start_date, end_date, amount, type, status, description, created_by, created_at, updated_at, deleted_at, company_id)
SELECT id, contract_number, title, client_id, supplier_id, client_signer_id, supplier_signer_id, start_date, end_date, amount, type, status, description, created_by, created_at, updated_at, deleted_at, COALESCE(company_id, 1)
FROM contracts_old;

-- Drop old table
DROP TABLE contracts_old;

-- +goose Down
-- Reverse: recreate table with NOT NULL title
ALTER TABLE contracts RENAME TO contracts_old;

CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'service',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'completed')),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    company_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

INSERT INTO contracts (id, contract_number, title, client_id, supplier_id, client_signer_id, supplier_signer_id, start_date, end_date, amount, type, status, description, created_by, created_at, updated_at, deleted_at, company_id)
SELECT id, contract_number, COALESCE(title, ''), client_id, supplier_id, client_signer_id, supplier_signer_id, start_date, end_date, amount, type, status, description, created_by, created_at, updated_at, deleted_at, COALESCE(company_id, 1)
FROM contracts_old;

DROP TABLE contracts_old;