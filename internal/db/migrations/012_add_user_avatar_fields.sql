-- +goose Up
-- Add avatar storage fields for user profile pictures
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN avatar_key TEXT;

-- +goose Down
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE users DROP COLUMN avatar_key;
