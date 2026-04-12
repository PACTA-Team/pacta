-- +goose Up
-- Add company_id to authorized_signers (if not already present)
-- This migration is handled individually for idempotency
ALTER TABLE authorized_signers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id);

-- +goose Down
-- SQLite does not support DROP COLUMN. This migration cannot be fully reversed.
