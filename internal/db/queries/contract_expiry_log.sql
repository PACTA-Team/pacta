-- name: UpsertNotificationLog :exec
INSERT INTO contract_expiry_notification_log
    (contract_id, threshold_days, sent_to_user, sent_to_admin, sent_at, delivery_status, error_message, channel)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (contract_id, threshold_days)
DO UPDATE SET
    sent_to_user = excluded.sent_to_user,
    sent_to_admin = excluded.sent_to_admin,
    sent_at = excluded.sent_at,
    delivery_status = excluded.delivery_status,
    error_message = excluded.error_message,
    channel = excluded.channel;
