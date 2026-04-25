package middleware

import (
    "context"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/go-redis/redis/v8"
)

type RedisRateLimiter struct {
    client *redis.Client
    ctx    context.Context
}

func NewRedisRateLimiter(client *redis.Client) *RedisRateLimiter {
    return &RedisRateLimiter{client: client, ctx: context.Background()}
}

func (r *RedisRateLimiter) Allow(key string, limit int, window time.Duration) (bool, error) {
    redisKey := "ratelimit:" + key
    now := time.Now().Unix()
    windowStart := now - int64(window.Seconds())

    pipe := r.client.TxPipeline()
    pipe.ZRemRangeByScore(r.ctx, redisKey, "0", strconv.FormatInt(windowStart, 10))
    count, _ := pipe.ZCard(r.ctx, redisKey).Result()

    if int(count) >= limit {
        return false, nil
    }

    pipe.ZAdd(r.ctx, redisKey, &redis.Z{
        Score:  float64(now),
        Member: strconv.FormatInt(now, 10),
    })
    pipe.Expire(r.ctx, redisKey, window+time.Second)
    _, err := pipe.Exec(r.ctx)
    return err == nil, err
}

func RedisRateLimitMiddleware(client *redis.Client) func(http.Handler) http.Handler {
    limiter := NewRedisRateLimiter(client)
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := getClientIP(r)
            allowed, _ := limiter.Allow(ip, 100, time.Minute)
            if !allowed {
                http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

func getClientIP(r *http.Request) string {
    // Check X-Forwarded-For header first (for proxy scenarios)
    if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
        // X-Forwarded-For can contain multiple IPs, take the first one
        ips := strings.Split(xff, ",")
        if len(ips) > 0 {
            return strings.TrimSpace(ips[0])
        }
    }
    // Fallback to RemoteAddr
    ip := r.RemoteAddr
    // Remove port if present
    if idx := strings.LastIndex(ip, ":"); idx != -1 {
        ip = ip[:idx]
    }
    return ip
}
