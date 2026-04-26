package middleware

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"os"
	"strings"
)

// cspNonceKey is a private key type for storing the CSP nonce in request context.
type cspNonceKey struct{}

// SecurityHeaders returns a middleware that sets comprehensive security headers.
// It configures headers for clickjacking protection, XSS protection, CSP with nonce,
// referrer policy, permissions policy, HSTS (production only), and removes
// fingerprinting headers like Server and X-Powered-By.
func SecurityHeaders() func(http.Handler) http.Handler {
	return SecurityHeadersWithNonce()
}

// SecurityHeadersWithNonce returns a middleware that sets security headers including
// a randomly generated CSP nonce stored in the request context.
func SecurityHeadersWithNonce() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Generate a random nonce (16 bytes, base64-encoded)
			nonceBytes := make([]byte, 16)
			if _, err := rand.Read(nonceBytes); err != nil {
				// Fallback to a deterministic nonce if rand fails (should not happen)
				nonceBytes = []byte("fallback-nonce")
			}
			nonce := base64.StdEncoding.EncodeToString(nonceBytes)

			// Store nonce in request context for later retrieval by handlers
			ctx := context.WithValue(r.Context(), cspNonceKey{}, nonce)
			r = r.WithContext(ctx)

			// Build Content-Security-Policy with nonce-based directives
			csp := strings.Join([]string{
				"default-src 'self';",
				"script-src 'self' 'nonce-" + nonce + "';",
				"style-src 'self' 'nonce-" + nonce + "';",
				"img-src 'self' data: https:;",
				"font-src 'self' data:;",
				"connect-src 'self' wss: ws:;",
				"frame-ancestors 'none';",
				"form-action 'self';",
				"base-uri 'self';",
			}, " ")
			w.Header().Set("Content-Security-Policy", csp)

			// X-Frame-Options: Prevent clickjacking
			w.Header().Set("X-Frame-Options", "DENY")

			// X-Content-Type-Options: Prevent MIME sniffing
			w.Header().Set("X-Content-Type-Options", "nosniff")

			// X-XSS-Protection: Legacy browser XSS protection
			w.Header().Set("X-XSS-Protection", "1; mode=block")

			// Referrer-Policy: Control referrer information leakage
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

			// Permissions-Policy: Restrict browser features
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")

			// HSTS: Only in production environment
			if os.Getenv("ENVIRONMENT") == "production" {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			}

			// Cross-Origin policies for additional isolation
			w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

			// Remove fingerprinting headers
			w.Header().Del("Server")
			w.Header().Del("X-Powered-By")

			next.ServeHTTP(w, r)
		})
	}
}

// GetCSPNonce retrieves the CSP nonce from the request context.
// Returns an empty string if no nonce is found (e.g., middleware not applied).
func GetCSPNonce(r *http.Request) string {
	if r == nil {
		return ""
	}
	nonce, ok := r.Context().Value(cspNonceKey{}).(string)
	if !ok {
		return ""
	}
	return nonce
}
