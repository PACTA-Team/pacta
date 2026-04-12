-- Add company_id to sessions for company context persistence
ALTER TABLE sessions ADD COLUMN company_id INTEGER NOT NULL DEFAULT 0 REFERENCES companies(id);
