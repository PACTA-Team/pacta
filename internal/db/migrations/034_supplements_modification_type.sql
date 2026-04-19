-- +goose Up
ALTER TABLE supplements ADD COLUMN modification_type TEXT CHECK (modification_type IN ('modificacion', 'prorroga', 'concrecion'));

-- +goose Down
ALTER TABLE supplements DROP COLUMN modification_type;