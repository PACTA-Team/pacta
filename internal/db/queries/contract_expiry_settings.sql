-- name: GetContractExpirySettings :one
SELECT id, enabled, frequency_hours, thresholds_days, updated_by, updated_at
FROM contract_expiry_notification_settings
WHERE id = 1;
