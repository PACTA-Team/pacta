-- ============================================================
-- system_settings queries
-- ============================================================
-- Soft-delete pattern: All SELECTs include "AND deleted_at IS NULL"
-- unless explicitly fetching all (including deleted).
-- ============================================================

-- name: GetSettingValue :one
SELECT value FROM system_settings
WHERE key = ? AND deleted_at IS NULL
LIMIT 1;

-- name: SetSettingValue :exec
INSERT INTO system_settings (key, value, category, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  category = excluded.category,
  updated_at = CURRENT_TIMESTAMP;

-- name: GetAllSettings :many
SELECT id, key, value, category, updated_by, updated_at
FROM system_settings
WHERE deleted_at IS NULL
ORDER BY category, key;

-- name: GetSettingsByKeys :many
SELECT key, value FROM system_settings
WHERE key IN (?, ?, ?, ?)
  AND deleted_at IS NULL;

-- name: GetBoolSetting :one
SELECT value FROM system_settings
WHERE key = ? AND deleted_at IS NULL
LIMIT 1;

-- name: UpdateSettingValue :exec
UPDATE system_settings
SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
WHERE key = ? AND deleted_at IS NULL;

-- name: DeleteSetting :exec
UPDATE system_settings
SET deleted_at = CURRENT_TIMESTAMP
WHERE key = ? AND deleted_at IS NULL;
