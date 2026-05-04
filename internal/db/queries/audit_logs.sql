-- ============================================================
-- audit_logs queries
-- Note: audit_logs table does NOT have deleted_at (audit trail)
-- ============================================================

-- name: CreateAuditLog :exec
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, company_id, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);

-- name: ListAuditLogsByCompany :many
SELECT id, user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at
FROM audit_logs
WHERE company_id = ?
ORDER BY created_at DESC
LIMIT 100;

-- name: ListAuditLogsByFilters :many
SELECT id, user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at
FROM audit_logs
WHERE company_id = ?
  AND (? = '' OR entity_type = ?)
  AND (? = 0 OR entity_id = ?)
  AND (? = 0 OR user_id = ?)
  AND (? = '' OR action = ?)
ORDER BY created_at DESC
LIMIT 100;
