package ai

import (
	"context"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
)

// RateLimiter enforces daily rate limits per company using shared DB storage.
type RateLimiter struct {
	queries *db.Queries
	limit   int // max requests per day (default 100)
}

// NewRateLimiter creates a RateLimiter backed by the provided Queries.
func NewRateLimiter(queries *db.Queries) *RateLimiter {
	return &RateLimiter{
		queries: queries,
		limit:   100,
	}
}

// Allow checks if companyID has remaining quota for today.
// It increments the counter if allowed. Returns (remaining, ok).
func (rl *RateLimiter) Allow(companyID int) (remaining int, ok bool) {
	today := time.Now().UTC().Format("2006-01-02")

	// Use the underlying DB to start a transaction (sqlc Queries doesn't expose Begin)
	tx, err := db.GetDB(rl.queries).Begin()
	if err != nil {
		return 0, false
	}
	defer tx.Rollback()

	// Create a Queries bound to this transaction
	txQueries := db.NewQueriesWithTx(tx)

	// Atomically increment and get new count
	newCount, err := txQueries.IncrementRateLimit(context.Background(), companyID, today)
	if err != nil {
		return 0, false
	}

	if newCount > rl.limit {
		return 0, false
	}

	remaining = rl.limit - newCount
	if remaining < 0 {
		remaining = 0
	}

	if err := tx.Commit(); err != nil {
		return 0, false
	}
	return remaining, true
}

// SetLimit allows overriding the default daily limit (not persisted).
func (rl *RateLimiter) SetLimit(limit int) {
	rl.limit = limit
}

