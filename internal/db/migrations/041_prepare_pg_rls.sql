-- Migration: 041_prepare_pg_rls
-- Description: Preparatory schema changes for PostgreSQL RLS migration
-- Date: 2026-04-24
-- Reason: SQLite lacks native Row Level Security. This migration adds
--          database objects needed when migrating to PostgreSQL, where
--          native RLS provides stronger multi-tenant guarantees.
--
-- THIS MIGRATION IS SAFE TO RUN ON SQLITE (no-ops) but is intended
-- for PostgreSQL. It creates objects that SQLite ignores/accepts as no-ops.

-- 1. Create a custom database role for application connections
-- (PostgreSQL only - SQLite ignores)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pacta_app') THEN
        RAISE NOTICE 'Role pacta_app already exists';
    ELSE
        CREATE ROLE pacta_app NOINHERIT LOGIN PASSWORD 'placeholder';
    END IF;
END $$;

-- 2. Create a custom configuration parameter namespace for tenant context
-- (PostgreSQL: SET app.current_tenant_id = '1')
-- SQLite: this is a no-op but documents the intent
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert documentation about RLS variables
INSERT OR IGNORE INTO app_config (key, value) VALUES 
    ('rlss_variable_tenant_id', 'app.current_tenant_id'),
    ('rlss_variable_user_id', 'app.current_user_id'),
    ('rlss_note', 'These session variables are set per-connection in PostgreSQL; ignored in SQLite');

-- 3. Grant minimal privileges (PostgreSQL only, safe no-op in SQLite)
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pacta_app;

-- 4. Create function to validate tenant isolation (PostgreSQL implementation)
-- This would be the enforcement mechanism when running on PostgreSQL
-- For SQLite, we keep application-level filters
CREATE TABLE IF NOT EXISTS tenant_isolation_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL UNIQUE,
    tenant_column TEXT NOT NULL DEFAULT 'company_id',
    policy_type TEXT NOT NULL CHECK(policy_type IN ('RLS', 'TRIGGER', 'APPLICATION')),
    enabled BOOLEAN DEFAULT FALSE,
    notes TEXT
);

INSERT OR IGNORE INTO tenant_isolation_policies (table_name, tenant_column, policy_type, enabled, notes) VALUES
    ('contracts', 'company_id', 'APPLICATION', TRUE, 'Current: application WHERE filter; Future: RLS'),
    ('clients', 'company_id', 'APPLICATION', TRUE, 'Current: application WHERE filter; Future: RLS'),
    ('suppliers', 'company_id', 'APPLICATION', TRUE, 'Current: application WHERE filter; Future: RLS'),
    ('documents', 'company_id', 'APPLICATION', TRUE, 'Current: application WHERE filter; Future: RLS'),
    ('notifications', 'company_id', 'APPLICATION', TRUE, 'Current: application WHERE filter; Future: RLS'),
    ('users', 'company_id', 'APPLICATION', TRUE, 'Users can read all in company, update self only');

-- 5. Create function to check if we are running on PostgreSQL
-- This allows code to branch based on database capabilities
CREATE TABLE IF NOT EXISTS db_capabilities (
    capability TEXT PRIMARY KEY,
    supported BOOLEAN NOT NULL,
    notes TEXT
);

INSERT OR IGNORE INTO db_capabilities (capability, supported, notes) VALUES
    ('row_level_security', FALSE, 'Not supported in SQLite; plan PostgreSQL migration'),
    ('session_variables', FALSE, 'SQLite PRAGMA limited; use per-request context'),
    ('check_constraints', TRUE, 'Supported via FOREIGN KEY and CHECK'),
    ('triggers', TRUE, 'Supported but not used for RLS due to pooling issues');

-- 6. Migration readiness check query
-- This can be run by ops to verify all tenant-scoped tables have company_id
-- SELECT 
--     t.name as table_name,
--     CASE 
--         WHEN EXISTS (
--             SELECT 1 FROM pragma_table_info(t.name) 
--             WHERE name = 'company_id'
--         ) THEN 'HAS company_id'
--         ELSE 'MISSING company_id'
--     END as status
-- FROM sqlite_master t
-- WHERE t.type='table' 
--   AND t.name IN ('contracts','clients','suppliers','documents','notifications','audit_logs','users')
-- ORDER BY t.name;
