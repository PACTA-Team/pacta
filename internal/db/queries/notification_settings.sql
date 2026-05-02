-- ============================================================
-- notification_settings queries
-- ============================================================

-- name: GetNotificationSettings :one
SELECT id, user_id, company_id, enabled, thresholds, recipients, created_at, updated_at
FROM notification_settings
WHERE user_id = $1 AND company_id = $2
LIMIT 1;

-- name: UpsertNotificationSettings :exec
INSERT INTO notification_settings (user_id, company_id, enabled, thresholds, recipients, updated_at)
VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, company_id) DO UPDATE SET
  enabled = excluded.enabled,
  thresholds = excluded.thresholds,
  recipients = excluded.recipients,
  updated_at = CURRENT_TIMESTAMP;
