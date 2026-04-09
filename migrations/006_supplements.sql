CREATE TABLE IF NOT EXISTS supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    supplement_number INTEGER NOT NULL,
    description TEXT,
    effective_date DATE,
    modifications TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active')),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplements_contract ON supplements(contract_id);
CREATE INDEX IF NOT EXISTS idx_supplements_status ON supplements(status);
