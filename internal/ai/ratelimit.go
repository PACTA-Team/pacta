package ai

import (
	"database/sql"
	"fmt"
	"time"
)

// RateLimiter enforces daily rate limits per company using shared DB storage.
type RateLimiter struct {
	db    *sql.DB
	limit int // max requests per day (default 100)
}

// NewRateLimiter creates a RateLimiter backed by the provided DB.
func NewRateLimiter(db *sql.DB) *RateLimiter {
	return &RateLimiter{
		db:    db,
		limit: 100,
	}
}

// Allow checks if companyID has remaining quota for today.
// It increments the counter if allowed. Returns (remaining, ok).
func (rl *RateLimiter) Allow(companyID int) (remaining int, ok bool) {
	today := time.Now().UTC().Format("2006-01-02")

	// Begin transaction to avoid race conditions
	tx, err := rl.db.Begin()
	if err != nil {
		return 0, false
	}
	defer tx.Rollback()

	var count int
	err = tx.QueryRow("SELECT count FROM ai_rate_limits WHERE company_id = ? AND date = ?", companyID, today).Scan(&count)
	if err != nil && err != sql.ErrNoRows {
		return 0, false
	}

	// Already at limit?
	if count >= rl.limit {
		return 0, false
	}

	// Increment counter
	if err == sql.ErrNoRows {
		_, err = tx.Exec("INSERT INTO ai_rate_limits (company_id, date, count) VALUES (?, ?, 1)", companyID, today)
	} else {
		_, err = tx.Exec("UPDATE ai_rate_limits SET count = count + 1 WHERE company_id = ? AND date = ?", companyID, today)
	}
	if err != nil {
		return 0, false
	}

	if err = tx.Commit(); err != nil {
		return 0, false
	}

	remaining = rl.limit - (count + 1)
	if remaining < 0 {
		remaining = 0
	}
	return remaining, true
}

// SetLimit allows overriding the default daily limit (not persisted).
func (rl *RateLimiter) SetLimit(limit int) {
	rl.limit = limit
}

