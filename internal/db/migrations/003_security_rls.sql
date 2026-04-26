-- +goose Up
-- Consolidated Migration: 003_security_rls
-- Security and RLS preparation (040 + 041)
-- Date: 2026-04-25
--
-- This migration:
-- 1. Enhances audit logging for multi-tenant security monitoring
-- 2. Creates tenant isolation tracking tables
-- 3. Documents RLS strategy (application-level filtering)
--
-- ==================== AUDIT LOGGING ENHANCEMENT (040) ====================
-- Add new columns to audit_logs for richer context
-- Note: ip_address already exists from initial schema
ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN session_id TEXT;
ALTER TABLE audit_logs ADD COLUMN violation_flag BOOLEAN DEFAULT FALSE;

-- Create indexes for audit queries
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_violation ON audit_logs(violation_flag);

-- Create helper table for tenant context sessions
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

-- Create view to detect potential cross-company access patterns
-- NOTE: audit_logs uses entity_type (not table_name) to track entity kind
CREATE VIEW v_potential_cross_tenant_access AS
SELECT
    al.id,
    al.user_id,
    al.company_id,
    al.action,
    al.entity_type AS table_name,
    al.created_at,
    u.email as user_email,
    c.name as company_name
FROM audit_logs al
JOIN users u ON al.user_id = u.id
JOIN companies c ON al.company_id = c.id
WHERE al.created_at > datetime('now', '-1 day')
    AND al.action IN ('SELECT', 'UPDATE', 'DELETE')
    AND al.entity_type IN ('contracts', 'clients', 'suppliers', 'documents')
ORDER BY al.created_at DESC;

-- Create trigger to automatically set company_id from user
-- SQLite doesn't support BEFORE INSERT to modify NEW values
-- Use INSTEAD OF trigger is not applicable for tables
-- Solution: Remove trigger and handle in application layer
-- company_id is nullable, will be set via application logic or backfill

-- ==================== RLS PREPARATION (041) ====================
-- Create configuration table for tenant context documentation
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert documentation about RLS variables
INSERT OR IGNORE INTO app_config (key, value) VALUES
    ('rls_variable_tenant_id', 'app.current_tenant_id'),
    ('rls_variable_user_id', 'app.current_user_id'),
    ('rls_note', 'SQLite: use application-level WHERE filters. Not PostgreSQL RLS.');

-- Create tenant isolation policies tracking table
CREATE TABLE IF NOT EXISTS tenant_isolation_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL UNIQUE,
    tenant_column TEXT NOT NULL DEFAULT 'company_id',
    policy_type TEXT NOT NULL CHECK(policy_type IN ('RLS', 'TRIGGER', 'APPLICATION')),
    enabled BOOLEAN DEFAULT TRUE,
    notes TEXT
);

INSERT OR IGNORE INTO tenant_isolation_policies (table_name, tenant_column, policy_type, enabled, notes) VALUES
    ('contracts', 'company_id', 'APPLICATION', TRUE, 'Application WHERE filter'),
    ('clients', 'company_id', 'APPLICATION', TRUE, 'Application WHERE filter'),
    ('suppliers', 'company_id', 'APPLICATION', TRUE, 'Application WHERE filter'),
    ('documents', 'company_id', 'APPLICATION', TRUE, 'Application WHERE filter'),
    ('notifications', 'company_id', 'APPLICATION', TRUE, 'Application WHERE filter'),
    ('users', 'company_id', 'APPLICATION', TRUE, 'Users: read all in company, update self only');

-- Create database capabilities tracking
CREATE TABLE IF NOT EXISTS db_capabilities (
    capability TEXT PRIMARY KEY,
    supported BOOLEAN NOT NULL,
    notes TEXT
);

INSERT OR IGNORE INTO db_capabilities (capability, supported, notes) VALUES
    ('row_level_security', FALSE, 'SQLite: not supported. Use application filters.'),
    ('session_variables', FALSE, 'SQLite: use per-request context in Go code'),
    ('check_constraints', TRUE, 'Supported via FOREIGN KEY and CHECK'),
    ('triggers', TRUE, 'Supported but avoid for RLS due to connection pooling');

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
-- Note: ip_address kept as it existed from initial schema

DROP TABLE IF EXISTS db_capabilities;
DROP TABLE IF EXISTS tenant_isolation_policies;
DROP TABLE IF EXISTS app_config;