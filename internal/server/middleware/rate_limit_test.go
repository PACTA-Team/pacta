package middleware_test

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "pacta/internal/server/middleware"
)

func TestRateLimit_Global(t *testing.T) {
    handler := middleware.RateLimit()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))

    req := httptest.NewRequest("GET", "/", nil)
    rec := httptest.NewRecorder()

    // Make 101 requests (limit is 100 per minute)
    for i := 0; i < 101; i++ {
        handler.ServeHTTP(rec, req)
        if rec.Code == http.StatusTooManyRequests {
            assert.Equal(t, http.StatusTooManyRequests, rec.Code)
            assert.Contains(t, rec.Body.String(), "rate limit exceeded")
            return
        }
    }
    t.Fatal("Expected 101st request to be rate limited")
}

func TestRateLimit_CriticalEndpoints(t *testing.T) {
    handler := middleware.RateLimit()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))

    req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
    rec := httptest.NewRecorder()

    // Critical limit is 10 per minute
    for i := 0; i < 11; i++ {
        handler.ServeHTTP(rec, req)
        if rec.Code == http.StatusTooManyRequests {
            assert.Equal(t, http.StatusTooManyRequests, rec.Code)
            return
        }
    }
    t.Fatal("Expected login rate limit to trigger at 10 requests")
}
