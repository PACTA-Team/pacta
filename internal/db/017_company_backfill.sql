-- Create default company from existing data
-- Use the first client name as company name, or 'Mi Empresa' if none exists
INSERT INTO companies (name, company_type, created_at, updated_at)
SELECT
    COALESCE(
        (SELECT name FROM clients WHERE deleted_at IS NULL LIMIT 1),
        'Mi Empresa'
    ),
    'single',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM companies);

-- Link all users to default company
UPDATE users SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all clients to default company
UPDATE clients SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all suppliers to default company
UPDATE suppliers SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all signers to default company
UPDATE authorized_signers SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all contracts to default company
UPDATE contracts SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all supplements to default company
UPDATE supplements SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all documents to default company
UPDATE documents SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all notifications to default company
UPDATE notifications SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all audit logs to default company
UPDATE audit_logs SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Create user_companies entries for all existing users
INSERT OR IGNORE INTO user_companies (user_id, company_id, is_default)
SELECT id, 1, 1 FROM users WHERE deleted_at IS NULL;
