-- +goose Up
-- Remap contract types to Decreto No. 310 taxonomy
ALTER TABLE contracts ADD COLUMN type_new TEXT;

-- Map existing values to new taxonomy
UPDATE contracts SET type_new = 
  CASE type
    WHEN 'service' THEN 'prestacion_servicios'
    WHEN 'purchase' THEN 'compraventa'
    WHEN 'lease' THEN 'arrendamiento'
    WHEN 'partnership' THEN 'cooperacion'
    WHEN 'employment' THEN 'otro'
    WHEN 'nda' THEN 'otro'
    ELSE 'otro'
  END;

-- Replace old column with new
ALTER TABLE contracts DROP COLUMN type;
ALTER TABLE contracts RENAME COLUMN type_new TO type;

-- +goose Down
-- Not reversible - would need manual backup/restore