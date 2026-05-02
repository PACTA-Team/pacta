-- ============================================================
-- password_reset_tokens queries
-- ============================================================

-- name: CreatePasswordResetToken :exec
INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP);

-- name: GetPasswordResetToken :one
SELECT id, user_id, token, expires_at, used_at, created_at
FROM password_reset_tokens
WHERE token = ?
LIMIT 1;

-- name: GetValidPasswordResetToken :one
SELECT id, user_id, token, expires_at, used_at, created_at
FROM password_reset_tokens
WHERE token = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
LIMIT 1;

-- name: MarkPasswordResetTokenUsed :exec
UPDATE password_reset_tokens
SET used_at = CURRENT_TIMESTAMP
WHERE token = ?;

-- name: GetLatestPasswordResetTokenForUser :one
SELECT id, token, expires_at, used_at
FROM password_reset_tokens
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 1;

-- name: DeleteUsedPasswordResetTokens :exec
DELETE FROM password_reset_tokens
WHERE used_at IS NOT NULL;

-- name: DeleteExpiredPasswordResetTokens :exec
DELETE FROM password_reset_tokens
WHERE expires_at < CURRENT_TIMESTAMP;
