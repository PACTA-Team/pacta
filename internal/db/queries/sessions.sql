-- ============================================================
-- sessions queries
-- ============================================================

-- name: CreateSession :exec
INSERT INTO sessions (token, user_id, company_id, expires_at, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);

-- name: GetSessionByToken :one
SELECT token, user_id, company_id, expires_at, created_at
FROM sessions
WHERE token = $1
LIMIT 1;

-- name: UpdateSessionExpiry :exec
UPDATE sessions
SET expires_at = $2
WHERE token = $1;

-- name: DeleteSession :exec
DELETE FROM sessions
WHERE token = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions
WHERE expires_at < CURRENT_TIMESTAMP;

-- name: SessionExists :one
SELECT COUNT(*) FROM sessions
WHERE token = $1;
