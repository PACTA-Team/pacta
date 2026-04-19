-- +goose Up
-- Migration: User Digital Certificates
-- Date: 2026-04-18

ALTER TABLE users ADD COLUMN digital_signature_url TEXT;
ALTER TABLE users ADD COLUMN digital_signature_key TEXT;
ALTER TABLE users ADD COLUMN public_cert_url TEXT;
ALTER TABLE users ADD COLUMN public_cert_key TEXT;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS digital_signature_url;
ALTER TABLE users DROP COLUMN IF EXISTS digital_signature_key;
ALTER TABLE users DROP COLUMN IF EXISTS public_cert_url;
ALTER TABLE users DROP COLUMN IF EXISTS public_cert_key;