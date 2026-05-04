-- ============================================================
-- users queries
-- ============================================================

-- name: GetUserByID :one
SELECT id, name, email, role, status, company_id, last_access,
       setup_completed, created_at, updated_at
FROM users
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserByEmail :one
SELECT id, name, email, role, status, company_id, last_access,
       setup_completed, created_at, updated_at
FROM users
WHERE email = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetBasicUserByEmail :one
SELECT id, name, email, role, status, company_id
FROM users
WHERE email = ? AND deleted_at IS NULL
LIMIT 1;

-- name: UserExists :one
SELECT COUNT(*) FROM users
WHERE email = ? AND deleted_at IS NULL;

-- name: CountAllUsers :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL;

-- name: GetUserRole :one
SELECT role FROM users
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserCompanyID :one
SELECT company_id FROM users
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetUsersByCompany :many
SELECT id, name, email, role, status
FROM users
WHERE company_id = ? AND deleted_at IS NULL
ORDER BY name;

-- name: ListAllUsers :many
SELECT id, name, email, role, status, company_id
FROM users
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- name: UpdateUserLastAccess :exec
UPDATE users
SET last_access = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: UpdateUserURLFields :exec
UPDATE users
SET avatar_url = ?, avatar_key = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: GetAvatarFields :one
SELECT avatar_url, avatar_key
FROM users
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserForSignIn :one
SELECT id, password_hash, role, status, company_id, setup_completed
FROM users
WHERE email = ? AND deleted_at IS NULL
LIMIT 1;

-- name: UpdateUserStatus :exec
UPDATE users
SET status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: UpdateUser :exec
UPDATE users
SET name = ?, email = ?, role = ?, status = ?,
    company_id = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: DeleteUser :exec
UPDATE users
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: GetUserCompanyIDUnscoped :one
SELECT company_id FROM users WHERE id = ?;

-- name: ListActiveAdminEmails :many
SELECT email FROM users
WHERE role = 'admin' AND status = 'active'
  AND deleted_at IS NULL;
