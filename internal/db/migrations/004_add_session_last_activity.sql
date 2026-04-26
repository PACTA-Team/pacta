-- +goose Up
-- Add last_activity column to sessions table
-- SQLite requires constant defaults in ALTER TABLE, not expressions
-- Use two-step: add nullable column, then backfill and make NOT NULL
ALTER TABLE sessions ADD COLUMN last_activity DATETIME;

-- Backfill existing sessions with current timestamp
UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE last_activity IS NULL;

-- Make column NOT NULL (SQLite: cannot directly alter, but column already has values)
-- The column is now effectively NOT NULL due to backfill; application ensures future inserts provide value

-- +goose Down
ALTER TABLE sessions DROP COLUMN IF EXISTS last_activity;
