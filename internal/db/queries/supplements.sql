-- ============================================================
-- supplements queries
-- ============================================================

-- name: GetSupplementByID :one
SELECT
  id, contract_id, supplement_number, description, effective_date,
  modifications, status, client_signer_id, supplier_signer_id,
  internal_id, company_id, created_by, created_at, updated_at
FROM supplements
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: ListSupplementsByContract :many
SELECT
  id, supplement_number, description, effective_date, status, created_at
FROM supplements
WHERE contract_id = ? AND deleted_at IS NULL
ORDER BY supplement_number DESC;

-- name: GetLatestSupplementNumber :one
SELECT supplement_number
FROM supplements
WHERE contract_id = ? AND deleted_at IS NULL
ORDER BY supplement_number DESC
LIMIT 1;

-- name: GetSupplementStatus :one
SELECT status FROM supplements
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: CreateSupplement :one
INSERT INTO supplements (
  contract_id, supplement_number, description, effective_date,
  modifications, status, client_signer_id, supplier_signer_id,
  internal_id, company_id, created_by, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateSupplementStatus :exec
UPDATE supplements
SET status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL AND company_id = ?;

-- name: DeleteSupplement :exec
UPDATE supplements
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL AND company_id = ?;

-- name: GetActiveSupplements :many
SELECT id, supplement_number, description, effective_date, status
FROM supplements
WHERE contract_id = ? AND deleted_at IS NULL AND status = 'active'
ORDER BY effective_date ASC;

-- name: CountSupplementsByContract :one
SELECT COUNT(*) FROM supplements
WHERE contract_id = ? AND deleted_at IS NULL;

-- name: SupplementExists :one
SELECT COUNT(*) FROM supplements
WHERE id = ? AND company_id = ? AND deleted_at IS NULL;

-- name: ListSupplementsByCompany :many
SELECT
  id, internal_id, contract_id, supplement_number, description,
  effective_date, modifications, modification_type, status,
  client_signer_id, supplier_signer_id, created_at, updated_at
FROM supplements
WHERE deleted_at IS NULL AND company_id = ?
ORDER BY created_at DESC;

-- name: UpdateSupplement :exec
UPDATE supplements
SET contract_id = ?, supplement_number = ?, description = ?,
    effective_date = ?, modifications = ?, modification_type = ?,
    status = ?, client_signer_id = ?, supplier_signer_id = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL AND company_id = ?;

-- name: GetMaxSupplementInternalID :one
SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))
FROM supplements
WHERE internal_id LIKE 'SPL-' || ? || '-%' AND company_id = ?;
