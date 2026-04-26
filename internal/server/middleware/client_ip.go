package middleware

import (
	"context"
	"net/http"
	"strings"
)

type clientIPKey struct{}

// ClientIP extracts the real client IP, trusting X-Forwarded-For only from localhost (Caddy proxy)
func ClientIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var ip string
		remote := r.RemoteAddr
		// If remote is localhost, trust X-Forwarded-For (Caddy adds it)
		if strings.HasPrefix(remote, "127.0.0.1") || strings.HasPrefix(remote, "[::1]") {
			if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
				// First IP in list is original client
				parts := strings.Split(xff, ",")
				ip = strings.TrimSpace(parts[0])
			} else {
				ip = remote
			}
		} else {
			ip = remote
		}
		ctx := context.WithValue(r.Context(), clientIPKey{}, ip)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetClientIP retrieves client IP from request context
func GetClientIP(r *http.Request) string {
	if v := r.Context().Value(clientIPKey{}); v != nil {
		return v.(string)
	}
	return r.RemoteAddr // fallback
}
