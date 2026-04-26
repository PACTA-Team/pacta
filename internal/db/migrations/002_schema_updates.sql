-- +goose Up
-- Consolidated Migration: 002_schema_updates
-- All schema updates after initial schema (combined from 014-038, excluding placeholders)
-- Date: 2026-04-25
--
-- This migration:
-- 1. Backfills company_id for all entities
-- 2. Creates default company if needed
-- 3. Ensures referential integrity
--
-- ==================== INITIAL DATA BACKFILL (020) ====================
-- Create default company from existing data
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
UPDATE supplements SET company_id = 1 WHERE company_id IS NULL;

-- Link all documents to default company
UPDATE documents SET company_id = 1 WHERE company_id IS NULL;

-- Link all notifications to default company
UPDATE notifications SET company_id = 1 WHERE company_id IS NULL;

-- Link all audit logs to default company
UPDATE audit_logs SET company_id = 1 WHERE company_id IS NULL;

-- Create user_companies entries for all existing users
INSERT OR IGNORE INTO user_companies (user_id, company_id, is_default)
SELECT id, 1, 1 FROM users WHERE deleted_at IS NULL;

-- ==================== BACKFILL SUPPLEMENTS INTERNAL_ID (012) ====================
UPDATE supplements SET internal_id = 'SPL-' || strftime('%Y', created_at) || '-' ||
    printf('%04d', (
        SELECT COUNT(*) FROM supplements s2
        WHERE s2.id <= supplements.id
        AND strftime('%Y', s2.created_at) = strftime('%Y', supplements.created_at)
    ))
WHERE internal_id IS NULL;

UPDATE supplements SET internal_id = '' WHERE internal_id IS NULL;

-- +goose Down
-- Reverse company backfill: reset company_id to NULL, delete user_companies entries, delete default company
UPDATE users SET company_id = NULL WHERE company_id = 1;
UPDATE clients SET company_id = NULL WHERE company_id = 1;
UPDATE suppliers SET company_id = NULL WHERE company_id = 1;
UPDATE authorized_signers SET company_id = NULL WHERE company_id = 1;
UPDATE contracts SET company_id = NULL WHERE company_id = 1;
UPDATE supplements SET company_id = NULL WHERE company_id = 1;
UPDATE documents SET company_id = NULL WHERE company_id = 1;
UPDATE notifications SET company_id = NULL WHERE company_id = 1;
UPDATE audit_logs SET company_id = NULL WHERE company_id = 1;
DELETE FROM user_companies WHERE company_id = 1;
DELETE FROM companies WHERE id = 1;