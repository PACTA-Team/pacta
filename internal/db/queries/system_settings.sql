-- ============================================================
-- system_settings queries
-- ============================================================
-- Soft-delete pattern: All SELECTs include "AND deleted_at IS NULL"
-- unless explicitly fetching all (including deleted).
-- ============================================================

-- name: GetSettingValue :one
SELECT value FROM system_settings
WHERE key = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: SetSettingValue :exec
INSERT INTO system_settings (key, value, category, updated_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  category = excluded.category,
  updated_at = CURRENT_TIMESTAMP;

-- name: GetAllSettings :many
SELECT key, value, category, updated_at
FROM system_settings
WHERE deleted_at IS NULL
ORDER BY category, key;

-- name: GetSettingsByKeys :many
SELECT key, value FROM system_settings
WHERE key IN ($1, $2, $3, $4)
  AND deleted_at IS NULL;

-- name: GetBoolSetting :one
SELECT value FROM system_settings
WHERE key = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: UpdateSettingValue :exec
UPDATE system_settings
SET value = $2, updated_at = CURRENT_TIMESTAMP
WHERE key = $1 AND deleted_at IS NULL;

-- name: DeleteSetting :exec
UPDATE system_settings
SET deleted_at = CURRENT_TIMESTAMP
WHERE key = $1 AND deleted_at IS NULL;
