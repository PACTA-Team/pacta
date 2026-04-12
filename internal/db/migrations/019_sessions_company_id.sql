-- +goose Up
-- Add company_id to sessions for company context persistence
ALTER TABLE sessions ADD COLUMN company_id INTEGER NOT NULL DEFAULT 0 REFERENCES companies(id);

-- +goose Down
-- SQLite does not support DROP COLUMN. This migration cannot be fully reversed.
