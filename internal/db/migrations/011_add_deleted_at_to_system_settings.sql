-- +goose Up
-- Add soft-delete support to system_settings table
-- Aligns with other tables (users, clients, suppliers, contracts, etc.)
ALTER TABLE system_settings ADD COLUMN deleted_at DATETIME;

-- Optional: index for queries filtering by deleted_at
CREATE INDEX IF NOT EXISTS idx_system_settings_deleted_at ON system_settings(deleted_at);

-- +goose Down
-- SQLite does not support DROP COLUMN directly.
-- This migration is marked as partially irreversible.
-- To fully rollback, you would need to:
-- 1. Create a temporary table without deleted_at
-- 2. Copy data: INSERT INTO system_settings_temp SELECT id, key, value, category, updated_by, updated_at FROM system_settings;
-- 3. Drop old table, rename temp table
-- For practical purposes, this down migration is a no-op (column becomes orphaned).
