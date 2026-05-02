-- ============================================================
-- password_reset_tokens queries
-- ============================================================

-- name: CreatePasswordResetToken :exec
INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP);

-- name: GetPasswordResetToken :one
SELECT id, user_id, token, expires_at, used, created_at
FROM password_reset_tokens
WHERE token = $1
LIMIT 1;

-- name: GetValidPasswordResetToken :one
SELECT id, user_id, token, expires_at, used, created_at
FROM password_reset_tokens
WHERE token = $1 AND used = 0 AND expires_at > CURRENT_TIMESTAMP
LIMIT 1;

-- name: MarkPasswordResetTokenUsed :exec
UPDATE password_reset_tokens
SET used = 1
WHERE token = $1;

-- name: GetLatestPasswordResetTokenForUser :one
SELECT id, token, expires_at, used
FROM password_reset_tokens
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- name: DeleteUsedPasswordResetTokens :exec
DELETE FROM password_reset_tokens
WHERE used = 1;

-- name: DeleteExpiredPasswordResetTokens :exec
DELETE FROM password_reset_tokens
WHERE expires_at < CURRENT_TIMESTAMP;
