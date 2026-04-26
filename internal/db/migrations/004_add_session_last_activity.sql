-- +goose Up
ALTER TABLE sessions ADD COLUMN last_activity DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP);

-- +goose Down
ALTER TABLE sessions DROP COLUMN IF EXISTS last_activity;
