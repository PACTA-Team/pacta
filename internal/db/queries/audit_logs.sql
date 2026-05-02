-- ============================================================
-- audit_logs queries
-- Note: audit_logs table does NOT have deleted_at (audit trail)
-- ============================================================

-- name: CreateAuditLog :exec
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, company_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP);

-- name: ListAuditLogsByCompany :many
SELECT id, user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at
FROM audit_logs
WHERE company_id = $1
ORDER BY created_at DESC
LIMIT 100;

-- name: ListAuditLogsByFilters :many
SELECT id, user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at
FROM audit_logs
WHERE company_id = $1
  AND ($2 = '' OR entity_type = $2)
  AND ($3 = 0 OR entity_id = $3)
  AND ($4 = 0 OR user_id = $4)
  AND ($5 = '' OR action = $5)
ORDER BY created_at DESC
LIMIT 100;
