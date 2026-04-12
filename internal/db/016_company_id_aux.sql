-- Add company_id to documents
ALTER TABLE documents ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);

-- Add company_id to notifications
ALTER TABLE notifications ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);

-- Add company_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
