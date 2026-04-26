package middleware

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/PACTA-Team/pacta/internal/auth"
)

// SessionRefresh extends session expiration on activity (sliding window).
// It updates last_activity and expires_at if the session is still valid and
// the last activity was less than 1 hour ago.
func SessionRefresh(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("session")
			if err == nil {
				// Only refresh if session exists and hasn't expired
				var lastAct time.Time
				err := db.QueryRow(
					"SELECT last_activity FROM sessions WHERE token = ? AND expires_at > datetime('now')",
					cookie.Value,
				).Scan(&lastAct)
				if err == nil && time.Since(lastAct) < time.Hour {
					// Extend expiry by 8 hours from now (sliding window)
					newExpiry := time.Now().Add(8 * time.Hour)
					db.Exec(`UPDATE sessions SET last_activity = datetime('now'), expires_at = ? WHERE token = ?`, newExpiry, cookie.Value)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
