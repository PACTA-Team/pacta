-- +goose Up
-- Add setup_completed and role_at_company fields to users
ALTER TABLE users ADD COLUMN setup_completed BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN role_at_company VARCHAR(50) DEFAULT NULL;

-- Create pending_activations table for setup completion tracking
CREATE TABLE IF NOT EXISTS pending_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,
    company_name TEXT,
    company_address TEXT,
    company_tax_id TEXT,
    company_phone TEXT,
    company_email TEXT,
    role_at_company VARCHAR(50),
    first_supplier_id INTEGER,
    first_client_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- +goose Down
DROP TABLE IF EXISTS pending_activations;
ALTER TABLE users DROP COLUMN IF EXISTS role_at_company;
ALTER TABLE users DROP COLUMN IF EXISTS setup_completed;