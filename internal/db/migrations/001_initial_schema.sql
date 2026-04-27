-- +goose Up
-- Consolidated Migration: 001_initial_schema
-- All base tables (combined from 001-013)
-- Date: 2026-04-25
--
-- Tables: users, companies, user_companies, sessions, clients, suppliers,
--         authorized_signers, contracts, supplements, documents, notifications,
--         audit_logs, registration_codes, pending_approvals
--
-- CIRCULAR DEPENDENCY RESOLUTION:
-- companies.created_by → users.id  AND  users.company_id → companies.id
-- Solution: Create companies WITHOUT created_by first, then users, then ALTER companies.
--
-- +goose NO TRANSACTION
PRAGMA foreign_keys=off;
BEGIN;

-- ==================== COMPANIES (013) - FIRST, without created_by ====================
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    tax_id TEXT,
    company_type TEXT NOT NULL DEFAULT 'single'
        CHECK (company_type IN ('single', 'parent', 'subsidiary')),
    parent_id INTEGER REFERENCES companies(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(company_type);
CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_id);

-- ==================== USERS (001 + 025 + 037 status expansion) ====================
-- users.company_id references companies (which now exists)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked', 'pending_email', 'pending_approval', 'pending_activation')),
    company_id INTEGER REFERENCES companies(id),
    last_access DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    setup_completed BOOLEAN DEFAULT 0,
    role_at_company VARCHAR(50) DEFAULT NULL,
    digital_signature_url TEXT,
    digital_signature_key TEXT,
    public_cert_url TEXT,
    public_cert_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

-- ==================== RESOLVE CIRCULAR DEPENDENCY ====================
-- Now that users exists, add created_by to companies
ALTER TABLE companies ADD COLUMN created_by INTEGER REFERENCES users(id);

-- ==================== USER_COMPANIES (many-to-many) ====================
CREATE TABLE IF NOT EXISTS user_companies (
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    is_default INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

-- ==================== SESSIONS (010) ====================
-- NOTE: No DEFAULT on company_id - application always provides explicit companyID.
-- DEFAULT 0 would violate FK (company IDs start at 1) and cause insert failures.
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ==================== CLIENTS (002) ====================
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    reu_code TEXT,
    contacts TEXT,
    company_id INTEGER REFERENCES companies(id),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

-- ==================== SUPPLIERS (003) ====================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    reu_code TEXT,
    contacts TEXT,
    company_id INTEGER REFERENCES companies(id),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);

-- ==================== AUTHORIZED_SIGNERS (004) ====================
CREATE TABLE IF NOT EXISTS authorized_signers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    company_type TEXT NOT NULL CHECK (company_type IN ('client', 'supplier')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id, company_type);

-- ==================== CONTRACTS (005 + 011 + 031 + 032 + 033 + 035 + 038) ====================
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_number TEXT NOT NULL UNIQUE,
    title TEXT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'prestacion_servicios',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'completed')),
    description TEXT,
    internal_id TEXT NOT NULL DEFAULT '',
    company_id INTEGER NOT NULL DEFAULT 1,
    -- Legal fields (033)
    object TEXT,
    fulfillment_place TEXT,
    dispute_resolution TEXT,
    has_confidentiality INTEGER DEFAULT 0,
    guarantees TEXT,
    renewal_type TEXT,
    -- Document fields (038)
    document_url TEXT NULL,
    document_key TEXT NULL,
    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_internal_id ON contracts(internal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);

-- ==================== SUPPLEMENTS (006 + 012 + 022 + 034) ====================
CREATE TABLE IF NOT EXISTS supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    supplement_number INTEGER NOT NULL,
    description TEXT,
    effective_date DATE,
    modifications TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active')),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    internal_id TEXT,
    company_id INTEGER REFERENCES companies(id),
    modification_type TEXT CHECK (modification_type IN ('modificacion', 'prorroga', 'concrecion')),
    deleted_at DATETIME,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplements_internal_id ON supplements(internal_id);
CREATE INDEX IF NOT EXISTS idx_supplements_contract ON supplements(contract_id);
CREATE INDEX IF NOT EXISTS idx_supplements_status ON supplements(status);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements(company_id);

-- ==================== DOCUMENTS (007) ====================
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    company_id INTEGER REFERENCES companies(id),
    uploaded_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);

-- ==================== NOTIFICATIONS (008) ====================
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    entity_id INTEGER,
    entity_type TEXT,
    company_id INTEGER REFERENCES companies(id),
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);

-- ==================== AUDIT_LOGS (009) ====================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    previous_state TEXT,
    new_state TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);

-- ==================== NOTIFICATION_SETTINGS (021) ====================
CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    enabled BOOLEAN DEFAULT 1,
    thresholds TEXT DEFAULT '[7,14,30]',
    recipients TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_company ON notification_settings(company_id);

-- ==================== REGISTRATION_CODES (023) ====================
CREATE TABLE registration_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_registration_codes_user_id ON registration_codes(user_id);
CREATE INDEX idx_registration_codes_expires ON registration_codes(expires_at);

-- ==================== PENDING_APPROVALS (023 + 024) ====================
CREATE TABLE pending_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_name TEXT NOT NULL,
    company_id INTEGER REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_role TEXT NOT NULL DEFAULT 'viewer',
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pending_approvals_status ON pending_approvals(status);

-- ==================== SYSTEM_SETTINGS (026) ====================
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    category TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==================== CONTRACT_EXPIRY_NOTIFICATIONS (027) ====================
CREATE TABLE contract_expiry_notification_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    frequency_hours INTEGER NOT NULL DEFAULT 6,
    thresholds_days TEXT NOT NULL DEFAULT '[30,14,7,1]',
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contract_expiry_notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    threshold_days INTEGER NOT NULL,
    sent_to_user BOOLEAN NOT NULL DEFAULT false,
    sent_to_admin BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'failed',
    error_message TEXT,
    channel VARCHAR(10) NOT NULL DEFAULT 'smtp',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_id, threshold_days)
);
CREATE INDEX idx_contract_expiry_log_contract ON contract_expiry_notification_log(contract_id);
CREATE INDEX idx_contract_expiry_log_threshold ON contract_expiry_notification_log(threshold_days);
CREATE INDEX idx_contract_expiry_log_created ON contract_expiry_notification_log(created_at DESC);

-- ==================== PENDING_ACTIVATIONS (036) ====================
CREATE TABLE IF NOT EXISTS pending_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,
    company_name TEXT,
    company_address TEXT,
    company_tax_id TEXT,
    company_phone TEXT,
    company_email TEXT,
    role_at_company VARCHAR(50),
    first_supplier_id INTEGER,
    first_client_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

COMMIT;
PRAGMA foreign_keys=on;

-- ==================== SEED DATA ====================
INSERT INTO system_settings (key, value, category) VALUES
    ('smtp_host', '', 'smtp'),
    ('smtp_user', '', 'smtp'),
    ('smtp_pass', '', 'smtp'),
    ('email_from', 'PACTA <noreply@pacta.duckdns.org>', 'smtp'),
    ('company_name', '', 'company'),
    ('company_email', '', 'company'),
    ('company_address', '', 'company'),
    ('registration_methods', 'email_verification', 'registration'),
    ('default_language', 'en', 'general'),
    ('timezone', 'UTC', 'general'),
    ('email_notifications_enabled', 'false', 'email'),
    ('email_contract_expiry_enabled', 'false', 'email'),
    ('email_verification_required', 'false', 'email'),
    ('smtp_enabled', 'false', 'email'),
    ('brevo_enabled', 'false', 'email'),
    ('brevo_api_key', '', 'email'),
    ('mailtrap_smtp_host', '', 'smtp'),
    ('mailtrap_smtp_user', '', 'smtp'),
    ('mailtrap_smtp_pass', '', 'smtp');

INSERT OR IGNORE INTO contract_expiry_notification_settings (id) VALUES (1);

-- +goose Down
-- Note: This consolidated migration cannot be fully reversed.
-- Requires manual table recreation for complex operations.
PRAGMA foreign_keys=off;
BEGIN;

DROP TABLE IF EXISTS pending_activations;
DROP TABLE IF EXISTS contract_expiry_notification_log;
DROP TABLE IF EXISTS contract_expiry_notification_settings;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS pending_approvals;
DROP TABLE IF EXISTS registration_codes;
DROP TABLE IF EXISTS notification_settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS supplements;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS authorized_signers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS user_companies;
-- Note: companies created first, must be dropped last among user tables
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS users;

COMMIT;
PRAGMA foreign_keys=on;
