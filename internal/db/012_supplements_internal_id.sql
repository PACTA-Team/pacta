-- Add internal_id column for system-generated supplement identifiers (SPL-YYYY-NNNN)
ALTER TABLE supplements ADD COLUMN internal_id TEXT;

-- Backfill existing records with SPL-YYYY-NNNN format
UPDATE supplements SET internal_id = 'SPL-' || strftime('%Y', created_at) || '-' ||
    printf('%04d', (
        SELECT COUNT(*) FROM supplements s2
        WHERE s2.id <= supplements.id
        AND strftime('%Y', s2.created_at) = strftime('%Y', supplements.created_at)
    ))
WHERE internal_id IS NULL;

-- Enforce NOT NULL and uniqueness
UPDATE supplements SET internal_id = '' WHERE internal_id IS NULL;
CREATE UNIQUE INDEX idx_supplements_internal_id ON supplements(internal_id);
