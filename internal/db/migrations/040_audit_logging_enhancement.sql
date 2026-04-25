-- Migration: 040_audit_logging_enhancement
-- Description: Enhance audit logging for multi-tenant security monitoring
-- Date: 2026-04-24
-- Reason: Application-level tenant isolation needs monitoring to detect
--          potential cross-tenant data access bugs or malicious attempts.

-- 1. Add new columns to audit_logs for richer context
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS ip_address TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS session_id TEXT,
    ADD COLUMN IF NOT EXISTS violation_flag BOOLEAN DEFAULT FALSE;

-- 2. Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created 
    ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action 
    ON audit_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_violation 
    ON audit_logs(violation_flag) 
    WHERE violation_flag = TRUE;

-- 3. Create helper function to log tenant context switches
CREATE TABLE IF NOT EXISTS tenant_context_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_context_session 
    ON tenant_context_sessions(session_token, last_seen);

-- 4. Function to detect potential cross-company access patterns
-- (Run periodically via cron job or background worker)
CREATE VIEW IF NOT EXISTS v_potential_cross_tenant_access AS
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

-- 5. Insert trigger to automatically capture session metadata for writes
-- (Reads are logged manually via handler calls)
CREATE TRIGGER IF NOT EXISTS audit_logs_company_metadata
AFTER INSERT ON audit_logs
FOR EACH ROW
BEGIN
    -- Ensure company_id is always set; if NULL, try to infer from user's company
    UPDATE audit_logs 
    SET company_id = (
        SELECT company_id FROM users WHERE id = NEW.user_id
    )
    WHERE id = NEW.id AND NEW.company_id IS NULL;
END;

-- 6. Add a helper query to quickly check for data leaks (run manually or monitoring)
-- Returns contracts that belong to company A but were accessed by user from company B
-- (This is a detective control, not preventative)
-- SELECT 
--     al1.id as access_id,
--     al1.user_id as accessing_user,
--     u1.email as accessing_user_email,
--     u1.company_id as accessing_company_id,
--     c1.name as accessing_company_name,
--     al1.table_name,
--     al1.record_id,
--     al2.company_id as record_company_id
-- FROM audit_logs al1
-- JOIN users u1 ON al1.user_id = u1.id
-- JOIN companies c1 ON u1.company_id = c1.id
-- JOIN LATERAL (
--     SELECT company_id FROM contracts WHERE id = al1.record_id
-- ) AS rec ON TRUE
-- WHERE al1.action = 'SELECT' 
--   AND al1.table_name = 'contracts'
--   AND u1.company_id != rec.company_id
-- ORDER BY al1.created_at DESC
-- LIMIT 100;
