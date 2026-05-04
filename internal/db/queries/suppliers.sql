-- ============================================================
-- suppliers queries
-- ============================================================

-- name: GetSupplierByID :one
SELECT id, company_id, name, address, reu_code, contacts,
       created_by, created_at, updated_at
FROM suppliers
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: GetSupplierByIDWithCompany :one
SELECT id, company_id, name, address, reu_code, contacts,
       created_by, created_at, updated_at
FROM suppliers
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: ListSuppliersByCompany :many
SELECT id, name, address, reu_code, contacts
FROM suppliers
WHERE company_id = ? AND deleted_at IS NULL
ORDER BY name;

-- name: GetSupplierName :one
SELECT name FROM suppliers
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: SupplierExists :one
SELECT COUNT(*) FROM suppliers
WHERE id = ? AND company_id = ? AND deleted_at IS NULL;

-- name: CountSuppliersByCompany :one
SELECT COUNT(*) FROM suppliers
WHERE company_id = ? AND deleted_at IS NULL;

-- name: CreateSupplier :one
INSERT INTO suppliers (
  company_id, name, address, reu_code, contacts,
  created_by, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateSupplier :one
UPDATE suppliers
SET name = ?, address = ?, reu_code = ?, contacts = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND company_id = ? AND deleted_at IS NULL
RETURNING *;

-- name: DeleteSupplier :exec
UPDATE suppliers
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND company_id = ? AND deleted_at IS NULL;
