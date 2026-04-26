package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"

	// Using filippo.io/csrf/gorilla backport (CVE-2025-47909)
	"filippo.io/csrf/gorilla"
)

// CSRFProtection returns a CSRF protection middleware using gorilla/csrf
// Paths in exemptPaths are excluded from CSRF checks (exact path match, not prefix)
func CSRFProtection(exemptPaths []string) func(http.Handler) http.Handler {
	secret := getCSRFSecret()

	csrfMW := csrf.Protect(
		[]byte(secret),
		csrf.Secure(isProduction()),
		csrf.Path("/"),
		csrf.MaxAge(86400*30), // 30 days
		csrf.HttpOnly(true),
		csrf.SameSite(csrf.SameSiteStrictMode),
		csrf.CookieName("_csrf_token"),
		csrf.RequestHeader("X-CSRF-Token"),
		csrf.ErrorHandler(http.HandlerFunc(csrfErrorHandler)),
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if path is exempt (exact match only)
			for _, path := range exemptPaths {
				if r.URL.Path == path {
					next.ServeHTTP(w, r)
					return
				}
			}
			// Apply CSRF protection for non-exempt paths
			csrfMW(next).ServeHTTP(w, r)
		})
	}
}

// getCSRFSecret retrieves or generates the CSRF secret
func getCSRFSecret() string {
	secret := os.Getenv("CSRF_SECRET")
	if secret == "" {
		if isProduction() {
			panic("CSRF_SECRET must be set in production")
		}
		secret = generateRandomString(32)
		fmt.Printf("Generated CSRF secret (set CSRF_SECRET for persistence)\n")
	}
	return secret
}

// generateRandomString creates a cryptographically secure random string
func generateRandomString(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// Fallback to less secure but still random enough for dev
		for i := range b {
			r, _ := rand.Int(rand.Reader, big.NewInt(26))
			b[i] = byte(65) + byte(r.Int64())
		}
		return base64.StdEncoding.EncodeToString(b)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// csrfErrorHandler handles CSRF validation failures
func csrfErrorHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	json.NewEncoder(w).Encode(map[string]string{
		"error": "CSRF validation failed",
	})
}

// ExemptFromCSRF is kept for backwards compatibility but not used
// Use CSRFProtection(exemptPaths) instead
func ExemptFromCSRF(paths []string) func(http.Handler) http.Handler {
	// No-op - actual exemption handled by CSRFProtection
	return func(next http.Handler) http.Handler { return next }
}

// isProduction checks if we're in production mode
func isProduction() bool {
	return os.Getenv("ENV") == "production" || os.Getenv("ENV") == "prod"
}

