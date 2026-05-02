-- ============================================================
-- clients queries
-- ============================================================

-- name: GetClientByID :one
SELECT id, company_id, name, address, reu_code, contacts,
       created_by, created_at, updated_at
FROM clients
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: GetClientByIDWithCompany :one
SELECT id, company_id, name, address, reu_code, contacts,
       created_by, created_at, updated_at
FROM clients
WHERE id = $1 AND deleted_at IS NULL AND company_id = $2
LIMIT 1;

-- name: ListClientsByCompany :many
SELECT id, name, address, reu_code, contacts
FROM clients
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY name;

-- name: GetClientName :one
SELECT name FROM clients
WHERE id = $1 AND deleted_at IS NULL AND company_id = $2
LIMIT 1;

-- name: ClientExists :one
SELECT COUNT(*) FROM clients
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: CountClientsByCompany :one
SELECT COUNT(*) FROM clients
WHERE company_id = $1 AND deleted_at IS NULL;

-- name: CreateClient :one
INSERT INTO clients (
  company_id, name, address, reu_code, contacts,
  created_by, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateClient :one
UPDATE clients
SET name = $2, address = $3, reu_code = $4, contacts = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $6 AND company_id = $7 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteClient :exec
UPDATE clients
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
