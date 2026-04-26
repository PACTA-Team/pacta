-- +goose Up
-- Migration: 038_add_contract_document_url
-- Add document storage fields to contracts table for required document upload
ALTER TABLE contracts ADD COLUMN document_url TEXT NULL;
ALTER TABLE contracts ADD COLUMN document_key TEXT NULL;

-- +goose Down
-- Note: This migration cannot be safely rolled back if data exists.
-- Consider backing up before rollback.
ALTER TABLE contracts DROP COLUMN IF EXISTS document_url;
ALTER TABLE contracts DROP COLUMN IF EXISTS document_key;
