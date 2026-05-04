package middleware

import (
	"net/http"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
)

// SessionRefresh extends session expiration on activity (sliding window).
// It updates last_activity and expires_at if the session is still valid and
// the last activity was less than 1 hour ago.
func SessionRefresh(queries *db.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("session")
			if err == nil {
				// Only refresh if session exists and hasn't expired
				session, err := queries.GetSessionForRefresh(r.Context(), cookie.Value)
				if err == nil && time.Since(session.LastActivity) < time.Hour {
					// Extend expiry by 8 hours from now (sliding window)
					newExpiry := time.Now().Add(8 * time.Hour)
					_ = queries.UpdateSessionActivityAndExpiry(r.Context(), db.UpdateSessionActivityAndExpiryParams{
						Token:     cookie.Value,
						ExpiresAt: newExpiry,
					})
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
