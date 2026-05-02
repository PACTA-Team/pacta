-- ============================================================
-- notifications queries
-- ============================================================

-- name: CreateNotification :one
INSERT INTO notifications (user_id, type, title, message, entity_id, entity_type, company_id, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
RETURNING *;

-- name: ListNotificationsByUser :many
SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
FROM notifications
WHERE user_id = ? AND company_id = ? AND read_at IS NULL
ORDER BY created_at DESC;

-- name: ListAllNotificationsByUser :many
SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
FROM notifications
WHERE user_id = ? AND company_id = ?
ORDER BY created_at DESC
LIMIT 100;

-- name: GetNotification :one
SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
FROM notifications
WHERE id = ? AND user_id = ? AND company_id = ?
LIMIT 1;

-- name: MarkNotificationRead :exec
UPDATE notifications
SET read_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ? AND company_id = ?;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications
SET read_at = CURRENT_TIMESTAMP
WHERE user_id = ? AND company_id = ? AND read_at IS NULL;

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = ? AND company_id = ? AND read_at IS NULL;

-- name: DeleteNotification :exec
DELETE FROM notifications
WHERE id = ? AND user_id = ? AND company_id = ?;
