-- +goose Up
-- Add deleted_at column to supplements table for soft delete support
ALTER TABLE supplements ADD COLUMN deleted_at DATETIME;

-- +goose Down
-- Note: SQLite doesn't support DROP COLUMN directly in older versions
-- This would require recreating the table
-- For rollback, the column will remain but unused
