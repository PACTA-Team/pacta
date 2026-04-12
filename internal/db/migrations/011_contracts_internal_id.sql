-- +goose Up
-- Add internal_id column to contracts for system-level tracking
-- This is independent of the user-entered contract_number (legal contract number)

ALTER TABLE contracts ADD COLUMN internal_id TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_internal_id ON contracts(internal_id);

-- +goose Down
-- SQLite does not support DROP COLUMN. This migration cannot be fully reversed.
