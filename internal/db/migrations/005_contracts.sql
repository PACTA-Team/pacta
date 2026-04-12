-- +goose Up
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
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);

-- +goose Down
DROP TABLE IF EXISTS contracts;
