-- ============================================================
-- clients queries
-- ============================================================

-- name: GetClientByID :one
SELECT id, company_id, name, address, reu_code, contacts,
       created_by, created_at, updated_at
FROM clients
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetClientByIDWithCompany :one
SELECT id, company_id, name, address, reu_code, contacts,
       created_by, created_at, updated_at
FROM clients
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: ListClientsByCompany :many
SELECT id, name, address, reu_code, contacts
FROM clients
WHERE company_id = ? AND deleted_at IS NULL
ORDER BY name;

-- name: GetClientName :one
SELECT name FROM clients
WHERE id = ? AND deleted_at IS NULL AND company_id = ?
LIMIT 1;

-- name: ClientExists :one
SELECT COUNT(*) FROM clients
WHERE id = ? AND company_id = ? AND deleted_at IS NULL;

-- name: CountClientsByCompany :one
SELECT COUNT(*) FROM clients
WHERE company_id = ? AND deleted_at IS NULL;

-- name: CreateClient :one
INSERT INTO clients (
  company_id, name, address, reu_code, contacts,
  created_by, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateClient :one
UPDATE clients
SET name = ?, address = ?, reu_code = ?, contacts = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND company_id = ? AND deleted_at IS NULL
RETURNING *;

-- name: DeleteClient :exec
UPDATE clients
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND company_id = ? AND deleted_at IS NULL;
