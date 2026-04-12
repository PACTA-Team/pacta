-- Add company_id to users (nullable initially, backfilled later)
ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id);

-- Add company_id to clients
ALTER TABLE clients ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

-- Add company_id to suppliers
ALTER TABLE suppliers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
