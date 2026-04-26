-- +goose Up
-- Migration: 040_audit_logging_enhancement
-- Description: Enhance audit logging for multi-tenant security monitoring
-- Date: 2026-04-24
-- Reason: Application-level tenant isolation needs monitoring to detect
--          potential cross-tenant data access bugs or malicious attempts.
--
-- SQLite compatibility: Use separate statements without IF NOT EXISTS on ADD COLUMN

-- 1. Add new columns to audit_logs for richer context
ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN session_id TEXT;
ALTER TABLE audit_logs ADD COLUMN violation_flag BOOLEAN DEFAULT FALSE;

-- 2. Create indexes for audit queries
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_violation ON audit_logs(violation_flag);

-- 3. Create helper table for tenant context sessions
CREATE TABLE tenant_context_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_context_session ON tenant_context_sessions(session_token, last_seen);

-- 4. Create view to detect potential cross-company access patterns
CREATE VIEW v_potential_cross_tenant_access AS
SELECT
    al.id,
    al.user_id,
    al.company_id,
    al.action,
    al.table_name,
    al.created_at,
    u.email as user_email,
    c.name as company_name
FROM audit_logs al
JOIN users u ON al.user_id = u.id
JOIN companies c ON al.company_id = c.id
WHERE al.created_at > datetime('now', '-1 day')
    AND al.action IN ('SELECT', 'UPDATE', 'DELETE')
    AND al.table_name IN ('contracts', 'clients', 'suppliers', 'documents')
ORDER BY al.created_at DESC;

-- 5. Create trigger to automatically set company_id from user
CREATE TRIGGER audit_logs_company_metadata
AFTER INSERT ON audit_logs
FOR EACH ROW
BEGIN
    UPDATE audit_logs
    SET company_id = (
        SELECT company_id FROM users WHERE id = NEW.user_id
    )
    WHERE id = NEW.id AND NEW.company_id IS NULL;
END;

-- +goose Down
DROP TRIGGER IF EXISTS audit_logs_company_metadata;
DROP VIEW IF EXISTS v_potential_cross_tenant_access;
DROP TABLE IF EXISTS tenant_context_sessions;
DROP INDEX IF EXISTS idx_audit_logs_violation;
DROP INDEX IF EXISTS idx_audit_logs_user_action;
DROP INDEX IF EXISTS idx_audit_logs_company_created;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS violation_flag;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS session_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS ip_address;
