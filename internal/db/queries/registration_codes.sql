-- ============================================================
-- registration_codes queries
-- ============================================================

-- name: CreateRegistrationCode :exec
INSERT INTO registration_codes (user_id, code_hash, expires_at, created_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP);

-- name: GetLatestRegistrationCodeForUser :one
SELECT id, code_hash, expires_at, attempts
FROM registration_codes
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 1;

-- name: IncrementRegistrationAttempts :exec
UPDATE registration_codes
SET attempts = attempts + 1
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 1;

-- name: GetValidRegistrationCode :one
SELECT id, code_hash, user_id
FROM registration_codes
WHERE user_id = ? AND code_hash = ?
  AND expires_at > CURRENT_TIMESTAMP AND attempts < 3;

-- name: DeleteRegistrationCode :exec
DELETE FROM registration_codes
WHERE id = ?;

-- name: DeleteOldRegistrationCodes :exec
DELETE FROM registration_codes
WHERE expires_at < CURRENT_TIMESTAMP;
