-- ============================================================
-- authorized_signers queries
-- ============================================================

-- name: GetSignerByID :one
SELECT
  id, company_id, company_type, first_name, last_name,
  position, phone, email, created_at, updated_at
FROM authorized_signers
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: ListSignersByCompany :many
SELECT id, company_id, company_type, first_name, last_name, position, phone, email
FROM authorized_signers
WHERE company_id = ? AND deleted_at IS NULL
ORDER BY last_name, first_name;

-- name: GetSignerCompanyOwnership :one
SELECT company_id FROM authorized_signers
WHERE id = ? AND deleted_at IS NULL;

-- name: ListSignersByClient :many
SELECT s.id, s.first_name, s.last_name, s.position, s.phone, s.email
FROM authorized_signers s
WHERE s.company_id = ? AND s.company_type = 'client'
  AND s.deleted_at IS NULL
ORDER BY s.last_name, s.first_name;

-- name: ListSignersBySupplier :many
SELECT s.id, s.first_name, s.last_name, s.position, s.phone, s.email
FROM authorized_signers s
WHERE s.company_id = ? AND s.company_type = 'supplier'
  AND s.deleted_at IS NULL
ORDER BY s.last_name, s.first_name;

-- name: ListSignersByCompanyAndType :many
SELECT id, company_id, company_type, first_name, last_name, position, phone, email
FROM authorized_signers
WHERE company_id = ? AND company_type = ? AND deleted_at IS NULL
ORDER BY last_name, first_name;

-- name: GetSignerForAudit :one
SELECT company_id, company_type, first_name, last_name, position, phone, email
FROM authorized_signers
WHERE id = ? AND deleted_at IS NULL;

-- name: GetSignerForContractValidation :one
SELECT company_id, company_type, first_name, last_name
FROM authorized_signers
WHERE id = ? AND deleted_at IS NULL
  AND company_id IN (
    SELECT cl.id FROM clients cl WHERE company_id = ? AND deleted_at IS NULL
    UNION ALL
    SELECT s.id FROM suppliers s WHERE company_id = ? AND deleted_at IS NULL
  )
LIMIT 1;

-- name: GetSignerWithValidation :one
SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
FROM authorized_signers
WHERE id = ? AND deleted_at IS NULL
  AND company_id IN (
    SELECT cl.id FROM clients cl WHERE company_id = ? AND deleted_at IS NULL
    UNION ALL
    SELECT s.id FROM suppliers s WHERE company_id = ? AND deleted_at IS NULL
  )
LIMIT 1;

-- name: GetSignerByIDWithCompany :one
SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
FROM authorized_signers
WHERE id = ? AND company_id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: SignerExists :one
SELECT COUNT(*) FROM authorized_signers
WHERE id = ? AND deleted_at IS NULL AND company_id = ?;

-- name: CreateSigner :one
INSERT INTO authorized_signers (
  company_id, company_type, first_name, last_name,
  position, phone, email, created_by, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateSigner :one
UPDATE authorized_signers
SET
  company_id = ?, company_type = ?, first_name = ?, last_name = ?,
  position = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL
RETURNING *;

-- name: DeleteSigner :exec
UPDATE authorized_signers
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;
