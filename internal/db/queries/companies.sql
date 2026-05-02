-- ============================================================
-- companies queries
-- ============================================================

-- name: ListAllCompanies :many
SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
       p.name as parent_name, c.created_by, c.created_at, c.updated_at
FROM companies c
LEFT JOIN companies p ON c.parent_id = p.id
WHERE c.deleted_at IS NULL
ORDER BY c.company_type DESC, c.name;

-- name: ListUserCompanies :many
SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
       p.name as parent_name, c.created_by, c.created_at, c.updated_at
FROM companies c
JOIN user_companies uc ON uc.company_id = c.id
LEFT JOIN companies p ON c.parent_id = p.id
WHERE uc.user_id = ? AND c.deleted_at IS NULL
ORDER BY c.company_type DESC, c.name;

-- name: GetCompanyByID :one
SELECT id, name, address, tax_id, company_type,
       parent_id, created_at, updated_at
FROM companies
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: ListCompanies :many
SELECT id, name, company_type, parent_id, created_at
FROM companies
WHERE deleted_at IS NULL
ORDER BY name;

-- name: GetCompanyType :one
SELECT company_type FROM companies
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetCompanyTypeByID :one
SELECT company_type FROM companies
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: CreateCompany :one
INSERT INTO companies (
  name, address, tax_id, company_type, parent_id,
  created_by, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateCompany :one
UPDATE companies
SET name = ?, address = ?, tax_id = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL
RETURNING *;

-- name: DeleteCompany :exec
UPDATE companies
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: GetSubsidiaries :many
SELECT id, name, company_type
FROM companies
WHERE parent_id = ? AND deleted_at IS NULL
ORDER BY name;

-- name: GetCompanyWithParent :one
SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
       p.name as parent_name, c.created_by, c.created_at, c.updated_at
FROM companies c
LEFT JOIN companies p ON c.parent_id = p.id
WHERE c.id = ? AND c.deleted_at IS NULL
LIMIT 1;

-- name: ListCompaniesForUser :many
SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
       p.name as parent_name, c.created_by, c.created_at, c.updated_at
FROM companies c
JOIN user_companies uc ON uc.company_id = c.id
LEFT JOIN companies p ON c.parent_id = p.id
WHERE uc.user_id = ? AND c.deleted_at IS NULL
ORDER BY c.company_type DESC, c.name;

-- name: ListAllCompaniesOrdered :many
SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
       p.name as parent_name, c.created_by, c.created_at, c.updated_at
FROM companies c
LEFT JOIN companies p ON c.parent_id = p.id
WHERE c.deleted_at IS NULL
ORDER BY c.company_type DESC, c.name;

-- name: CountCompanies :one
SELECT COUNT(*) FROM companies
WHERE deleted_at IS NULL;

-- name: CreateCompanySimple :one
INSERT INTO companies (
  name, company_type, created_at, updated_at
) VALUES (
  ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;



