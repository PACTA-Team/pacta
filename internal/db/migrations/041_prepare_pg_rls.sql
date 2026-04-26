-- +goose Up
-- Migration: 041_prepare_pg_rls
-- Description: Preparatory schema for multi-tenant security (SQLite-only)
-- Date: 2026-04-24
-- Reason: This migration creates tracking tables for RLS planning.
--         PostgreSQL native RLS is NOT used - we use application-level filtering.
--         This migration is compatible with SQLite only.

-- 1. Create configuration table for tenant context documentation
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert documentation about RLS variables
INSERT OR IGNORE INTO app_config (key, value) VALUES
    ('rls_variable_tenant_id', 'app.current_tenant_id'),
    ('rls_variable_user_id', 'app.current_user_id'),
    ('rls_note', 'SQLite: use application-level WHERE filters. Not PostgreSQL RLS.');

-- 2. Create tenant isolation policies tracking table
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

-- 3. Create database capabilities tracking
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
DROP TABLE IF EXISTS db_capabilities;
DROP TABLE IF EXISTS tenant_isolation_policies;
DROP TABLE IF EXISTS app_config;
