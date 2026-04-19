-- +goose Up
ALTER TABLE contracts ADD COLUMN object TEXT;
ALTER TABLE contracts ADD COLUMN fulfillment_place TEXT;
ALTER TABLE contracts ADD COLUMN dispute_resolution TEXT;
ALTER TABLE contracts ADD COLUMN has_confidentiality INTEGER DEFAULT 0;
ALTER TABLE contracts ADD COLUMN guarantees TEXT;
ALTER TABLE contracts ADD COLUMN renewal_type TEXT;

-- +goose Down
ALTER TABLE contracts DROP COLUMN object;
ALTER TABLE contracts DROP COLUMN fulfillment_place;
ALTER TABLE contracts DROP COLUMN dispute_resolution;
ALTER TABLE contracts DROP COLUMN has_confidentiality;
ALTER TABLE contracts DROP COLUMN guarantees;
ALTER TABLE contracts DROP COLUMN renewal_type;