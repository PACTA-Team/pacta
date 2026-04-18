-- +goose Up
-- Migration: Email Settings from Database
-- Date: 2026-04-17

INSERT INTO system_settings (key, value, category) VALUES
('email_notifications_enabled', 'false', 'email'),
('email_contract_expiry_enabled', 'false', 'email'),
('email_verification_required', 'false', 'email'),
('smtp_enabled', 'false', 'email'),
('brevo_enabled', 'false', 'email'),
('brevo_api_key', '', 'email');

-- +goose Down
DELETE FROM system_settings WHERE category = 'email';