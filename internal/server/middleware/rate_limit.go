package middleware

import (
    "net/http"
    "net/http/httprate"
    "strconv"
    "strings"
    "sync"
    "time"
)

type RateLimitConfig struct {
    Global         RateRule
    Authenticated  RateRule
    Unauthenticated RateRule
    Critical       RateRule
}

type RateRule struct {
    Requests int
    Window   time.Duration
}

var defaultConfig = RateLimitConfig{
    Global: RateRule{Requests: 100, Window: time.Minute},
    Authenticated: RateRule{Requests: 1000, Window: time.Minute},
    Unauthenticated: RateRule{Requests: 50, Window: time.Minute},
    Critical: RateRule{Requests: 10, Window: time.Minute},
}

func RateLimit() func(http.Handler) http.Handler {
    var (
        globalLimiter     = httprate.NewLimiter(defaultConfig.Global.Requests, defaultConfig.Global.Window)
        criticalLimiter   = httprate.NewLimiter(defaultConfig.Critical.Requests, defaultConfig.Critical.Window)
        authLimiters      = make(map[string]*httprate.Limiter)
        unauthLimiter     = httprate.NewLimiter(defaultConfig.Unauthenticated.Requests, defaultConfig.Unauthenticated.Window)
        mu                sync.RWMutex
    )

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            var limiter *httprate.Limiter

            if isCriticalEndpoint(r.URL.Path) {
                limiter = criticalLimiter
            } else if userID := getUserID(r); userID != "" {
                mu.RLock()
                userLimiter, exists := authLimiters[userID]
                mu.RUnlock()

                if !exists {
                    mu.Lock()
                    userLimiter, exists = authLimiters[userID]
                    if !exists {
                        userLimiter = httprate.NewLimiter(defaultConfig.Authenticated.Requests, defaultConfig.Authenticated.Window)
                        authLimiters[userID] = userLimiter
                    }
                    mu.Unlock()
                }
                limiter = userLimiter
            } else {
                limiter = unauthLimiter
            }

            if !limiter.Allow() {
                w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limiter.Limit()))
                w.Header().Set("X-RateLimit-Remaining", "0")
                w.Header().Set("Retry-After", "60")
                http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
                return
            }

            w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limiter.Limit()))
            w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(limiter.Remaining()))
            next.ServeHTTP(w, r)
        })
    }
}

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

func getUserID(r *http.Request) string {
    if userID, ok := r.Context().Value("user_id").(string); ok && userID != "" {
        return userID
    }
    return ""
}
