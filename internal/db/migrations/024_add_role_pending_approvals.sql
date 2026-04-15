-- +goose Up
-- Add requested_role column to pending_approvals so admin can set role on approval
ALTER TABLE pending_approvals ADD COLUMN requested_role TEXT NOT NULL DEFAULT 'viewer';

-- +goose Down
-- Note: SQLite doesn't support DROP COLUMN on all versions, but this is fine for migration
ALTER TABLE pending_approvals DROP COLUMN requested_role;
