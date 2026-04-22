-- +goose Up
-- Restore internal_id column that was lost during migration 031 (table recreation)
-- The column was added in 011_contracts_internal_id.sql but lost when 031 recreated the table
ALTER TABLE contracts ADD COLUMN internal_id TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE contracts DROP COLUMN internal_id;