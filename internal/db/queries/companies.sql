-- ============================================================
-- companies queries
-- ============================================================

-- name: GetCompanyByID :one
SELECT id, name, address, tax_id, company_type,
       parent_id, created_at, updated_at
FROM companies
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: ListCompanies :many
SELECT id, name, company_type, parent_id, created_at
FROM companies
WHERE deleted_at IS NULL
ORDER BY name;

-- name: GetCompanyType :one
SELECT company_type FROM companies
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: CreateCompany :one
INSERT INTO companies (
  name, address, tax_id, company_type, parent_id,
  created_by, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateCompany :one
UPDATE companies
SET name = $2, address = $3, tax_id = $4,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $5 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteCompany :exec
UPDATE companies
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetSubsidiaries :many
SELECT id, name, company_type
FROM companies
WHERE parent_id = $1 AND deleted_at IS NULL
ORDER BY name;
