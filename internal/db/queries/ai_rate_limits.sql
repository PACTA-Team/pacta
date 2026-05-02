-- ============================================================
-- ai_rate_limits queries
-- Note: This table does NOT have deleted_at (metrics/audit data)
-- ============================================================

-- name: IncrementRateLimit :one
INSERT INTO ai_rate_limits (company_id, date, count)
VALUES (?, ?, 1)
ON CONFLICT (company_id, date)
DO UPDATE SET count = count + 1
RETURNING count;

-- name: GetTodayRateLimitCount :one
SELECT COALESCE(SUM(count), 0) FROM ai_rate_limits
WHERE company_id = ? AND date(created_at) = date('now');

-- name: IncrementRateLimitCount :exec
INSERT INTO ai_rate_limits (company_id, count, created_at)
VALUES (?, 1, CURRENT_TIMESTAMP);

-- name: GetRateLimitInfo :many
SELECT id, company_id, count, created_at
FROM ai_rate_limits
WHERE company_id = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: CleanupOldRateLimits :exec
DELETE FROM ai_rate_limits
WHERE created_at < datetime('now', '-30 days');
