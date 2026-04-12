-- +goose Up
-- Add company_id to supplements
ALTER TABLE supplements ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements(company_id);

-- +goose Down
-- SQLite does not support DROP COLUMN. This migration cannot be fully reversed.
