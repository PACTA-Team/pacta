package middleware

import (
	"net/http"
	"os"
)

// SecurityHeaders returns a middleware that sets comprehensive security headers.
// It configures headers for clickjacking protection, XSS protection, CSP,
// referrer policy, permissions policy, HSTS (production only), and removes
// fingerprinting headers like Server and X-Powered-By.
func SecurityHeaders() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Content-Security-Policy with strict directives
			csp := "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:; frame-ancestors 'none'; form-action 'self'; base-uri 'self';"
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
