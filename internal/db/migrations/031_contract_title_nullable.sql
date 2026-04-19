-- +goose Up
ALTER TABLE contracts ALTER COLUMN title TEXT;

-- +goose Down
ALTER TABLE contracts ALTER COLUMN title TEXT NOT NULL;