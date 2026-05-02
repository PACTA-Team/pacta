-- ============================================================
-- pending_activations queries
-- ============================================================

-- name: ListPendingActivations :many
SELECT pa.id, pa.user_id, u.name, u.email, pa.company_name, pa.company_id, pa.role_at_company, pa.status, pa.created_at
FROM pending_activations pa
JOIN users u ON u.id = pa.user_id
WHERE pa.status = 'pending_activation' AND u.deleted_at IS NULL
ORDER BY pa.created_at DESC;

-- name: CreatePendingActivation :exec
INSERT INTO pending_activations (user_id, company_id, company_name, role_at_company, status)
VALUES (?, ?, ?, ?, 'pending_activation');
