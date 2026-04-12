-- Add company_id to authorized_signers
ALTER TABLE authorized_signers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id);

-- Add company_id to contracts
ALTER TABLE contracts ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);

-- Add company_id to supplements (denormalized for query performance)
ALTER TABLE supplements ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements(company_id);
