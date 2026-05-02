-- ============================================================
-- notifications queries
-- ============================================================

-- name: CreateNotification :one
INSERT INTO notifications (user_id, type, title, message, entity_id, entity_type, company_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
RETURNING *;

-- name: ListNotificationsByUser :many
SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
FROM notifications
WHERE user_id = $1 AND company_id = $2 AND read_at IS NULL
ORDER BY created_at DESC;

-- name: ListAllNotificationsByUser :many
SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
FROM notifications
WHERE user_id = $1 AND company_id = $2
ORDER BY created_at DESC
LIMIT 100;

-- name: GetNotification :one
SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
FROM notifications
WHERE id = $1 AND user_id = $2 AND company_id = $3
LIMIT 1;

-- name: MarkNotificationRead :exec
UPDATE notifications
SET read_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2 AND company_id = $3;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications
SET read_at = CURRENT_TIMESTAMP
WHERE user_id = $1 AND company_id = $2 AND read_at IS NULL;

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1 AND company_id = $2 AND read_at IS NULL;

-- name: DeleteNotification :exec
DELETE FROM notifications
WHERE id = $1 AND user_id = $2 AND company_id = $3;
