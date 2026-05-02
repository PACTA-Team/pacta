-- ============================================================
-- authorized_signers queries
-- ============================================================

-- name: GetSignerByID :one
SELECT
  id, company_id, company_type, first_name, last_name,
  position, phone, email, created_at, updated_at
FROM authorized_signers
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: ListSignersByCompany :many
SELECT id, company_id, company_type, first_name, last_name, position, phone, email
FROM authorized_signers
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY last_name, first_name;

-- name: GetSignerCompanyOwnership :one
SELECT company_id FROM authorized_signers
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListSignersByClient :many
SELECT s.id, s.first_name, s.last_name, s.position, s.phone, s.email
FROM authorized_signers s
WHERE s.company_id = $1 AND s.company_type = 'client'
  AND s.deleted_at IS NULL
ORDER BY s.last_name, s.first_name;

-- name: ListSignersBySupplier :many
SELECT s.id, s.first_name, s.last_name, s.position, s.phone, s.email
FROM authorized_signers s
WHERE s.company_id = $1 AND s.company_type = 'supplier'
  AND s.deleted_at IS NULL
ORDER BY s.last_name, s.first_name;

-- name: ListSignersByCompanyAndType :many
SELECT id, company_id, company_type, first_name, last_name, position, phone, email
FROM authorized_signers
WHERE company_id = $1 AND company_type = $2 AND deleted_at IS NULL
ORDER BY last_name, first_name;

-- name: GetSignerForAudit :one
SELECT company_id, company_type, first_name, last_name, position, phone, email
FROM authorized_signers
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetSignerForContractValidation :one
SELECT company_id, company_type, first_name, last_name
FROM authorized_signers
WHERE id = $1 AND deleted_at IS NULL
  AND company_id IN (
    SELECT id FROM clients WHERE company_id = $2 AND deleted_at IS NULL
    UNION ALL
    SELECT id FROM suppliers WHERE company_id = $2 AND deleted_at IS NULL
  )
LIMIT 1;

-- name: GetSignerWithValidation :one
SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
FROM authorized_signers
WHERE id = $1 AND deleted_at IS NULL
  AND company_id IN (
    SELECT id FROM clients WHERE company_id = $2 AND deleted_at IS NULL
    UNION ALL
    SELECT id FROM suppliers WHERE company_id = $2 AND deleted_at IS NULL
  )
LIMIT 1;

-- name: GetSignerByIDWithCompany :one
SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
FROM authorized_signers
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: SignerExists :one
SELECT COUNT(*) FROM authorized_signers
WHERE id = $1 AND deleted_at IS NULL AND company_id = $2;

-- name: CreateSigner :one
INSERT INTO authorized_signers (
  company_id, company_type, first_name, last_name,
  position, phone, email, created_by, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateSigner :one
UPDATE authorized_signers
SET
  company_id = $2, company_type = $3, first_name = $4, last_name = $5,
  position = $6, phone = $7, email = $8, updated_at = CURRENT_TIMESTAMP
WHERE id = $9 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteSigner :exec
UPDATE authorized_signers
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_at IS NULL;
