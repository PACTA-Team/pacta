-- ============================================================
-- sessions queries
-- ============================================================

-- name: CreateSession :one
INSERT INTO sessions (token, user_id, company_id, expires_at, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetSessionByToken :one
SELECT token, user_id, company_id, expires_at, created_at
FROM sessions
WHERE token = $1
LIMIT 1;

-- name: UpdateSessionExpiry :exec
UPDATE sessions
SET expires_at = $2
WHERE token = $1;

-- name: GetSessionForRefresh :one
SELECT last_activity, expires_at
FROM sessions
WHERE token = $1 AND expires_at > datetime('now')
LIMIT 1;

-- name: UpdateSessionActivityAndExpiry :exec
UPDATE sessions
SET last_activity = CURRENT_TIMESTAMP, expires_at = $2
WHERE token = $1;

-- name: DeleteSessionByUserID :exec
DELETE FROM sessions WHERE user_id = $1;

-- name: GetActiveSessionByToken :one
SELECT * FROM sessions
WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
LIMIT 1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions
WHERE expires_at < CURRENT_TIMESTAMP;

-- name: SessionExists :one
SELECT COUNT(*) FROM sessions
WHERE token = $1;

-- name: UpdateSessionCompany :exec
UPDATE sessions
SET company_id = $2
WHERE token = $1;
