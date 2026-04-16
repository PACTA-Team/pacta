-- Migration: System Settings
-- Date: 2026-04-16

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    category TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
('timezone', 'UTC', 'general');