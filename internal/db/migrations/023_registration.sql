-- +goose Up
-- Registration codes for email verification
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

-- Pending approvals for admin review
CREATE TABLE pending_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_name TEXT NOT NULL,
    company_id INTEGER REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pending_approvals_status ON pending_approvals(status);

-- +goose Down
DROP INDEX IF EXISTS idx_pending_approvals_status;
DROP TABLE IF EXISTS pending_approvals;
DROP INDEX IF EXISTS idx_registration_codes_expires;
DROP INDEX IF EXISTS idx_registration_codes_user_id;
DROP TABLE IF EXISTS registration_codes;
