package ai

import (
	"sync"
	"time"
)

// RateLimiter implements per-company daily rate limiting for AI endpoints.
// Allows up to maxPerDay requests per company per calendar day.
type RateLimiter struct {
	mu          sync.RWMutex
	counts      map[string]int      // key: "companyID:YYYY-MM-DD"
	lastReset   time.Time           // last date we reset counts
	maxPerDay   int                 // default 100
}

// NewRateLimiter creates a new RateLimiter with the given daily limit.
func NewRateLimiter(maxPerDay int) *RateLimiter {
	return &RateLimiter{
		counts:    make(map[string]int),
		lastReset: time.Now().Truncate(24 * time.Hour),
		maxPerDay: maxPerDay,
	}
}

// Allow checks if a request from the given companyID is allowed.
// It returns (remaining, true) if allowed, or (remaining, false) if limit exceeded.
func (rl *RateLimiter) Allow(companyID int) (int, bool) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Auto-reset if day changed
	today := time.Now().Format("2006-01-02")
	key := fmt.Sprintf("%d:%s", companyID, today)

	// Reset yesterday's counts lazily when we see a new day
	if rl.lastReset.Format("2006-01-02") != today {
		rl.counts = make(map[string]int)
		rl.lastReset = time.Now().Truncate(24 * time.Hour)
	}

	if rl.counts[key] >= rl.maxPerDay {
		return 0, false
	}
	rl.counts[key]++
	remaining := rl.maxPerDay - rl.counts[key]
	if remaining < 0 {
		remaining = 0
	}
	return remaining, true
}

// ResetIfNewDay resets counters if the day has changed. Returns true if reset happened.
func (rl *RateLimiter) ResetIfNewDay() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	today := time.Now().Format("2006-01-02")
	if rl.lastReset.Format("2006-01-02") != today {
		rl.counts = make(map[string]int)
		rl.lastReset = time.Now().Truncate(24 * time.Hour)
		return true
	}
	return false
}
