-- +goose Up
-- Add company_id to contracts
ALTER TABLE contracts ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);

-- +goose Down
-- SQLite does not support DROP COLUMN. This migration cannot be fully reversed.
