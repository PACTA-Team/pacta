CREATE TABLE IF NOT EXISTS authorized_signers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    company_type TEXT NOT NULL CHECK (company_type IN ('client', 'supplier')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id, company_type);
