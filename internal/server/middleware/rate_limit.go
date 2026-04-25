package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/httprate"
)

// RateLimitConfig defines rate limit parameters
type RateLimitConfig struct {
	Requests int
	Window   time.Duration
}

// Default global rate limit: 100 requests per minute
var globalLimit = RateLimitConfig{Requests: 100, Window: time.Minute}

// RateLimit returns rate limiting middleware using chi/httprate
func RateLimit() func(http.Handler) http.Handler {
	// Using chi/httprate's middleware pattern
	// Rate limit by IP address
	return httprate.LimitAll(globalLimit.Requests, globalLimit.Window)
}

// RateLimitByEndpoint returns middleware that rate limits per endpoint
func RateLimitByEndpoint(requests int, window time.Duration) func(http.Handler) http.Handler {
	return httprate.Limit(
		requests,
		window,
		httprate.WithKeyFuncs(httprate.KeyByIP, httprate.KeyByEndpoint),
	)
}

// RateLimitByKey returns middleware that rate limits using custom key function
func RateLimitByKey(requests int, window time.Duration, keyFunc httprate.KeyFunc) func(http.Handler) http.Handler {
	return httprate.Limit(requests, window, httprate.WithKeyFuncs(keyFunc))
}

// isCriticalEndpoint checks if path needs stricter rate limiting
func isCriticalEndpoint(path string) bool {
	criticalPaths := []string{
		"/api/auth/login",
		"/api/auth/register",
		"/api/auth/logout",
		"/api/auth/verify-code",
	}
	for _, cp := range criticalPaths {
		if strings.HasPrefix(path, cp) {
			return true
		}
	}
	return false
}