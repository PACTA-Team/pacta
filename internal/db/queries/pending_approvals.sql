-- ============================================================
-- pending_approvals queries
-- ============================================================

-- name: ListPendingApprovals :many
SELECT pa.id, pa.user_id, u.name, u.email, pa.company_name, pa.company_id, pa.requested_role, pa.status, pa.created_at
FROM pending_approvals pa
JOIN users u ON u.id = pa.user_id
WHERE pa.status = 'pending' AND u.deleted_at IS NULL
ORDER BY pa.created_at DESC;

-- name: GetPendingApproval :one
SELECT id, user_id, company_name, company_id, requested_role, status
FROM pending_approvals
WHERE id = ? AND status = 'pending'
LIMIT 1;

-- name: GetPendingApprovalUser :one
SELECT user_id, company_name FROM pending_approvals
WHERE id = ? AND status = 'pending'
LIMIT 1;

-- name: ApprovePendingApproval :exec
UPDATE pending_approvals
SET status = 'approved', reviewed_by = ?, reviewed_at = ?, company_id = ?, notes = ?
WHERE id = ?;

-- name: RejectPendingApproval :exec
UPDATE pending_approvals
SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, notes = ?
WHERE id = ?;
