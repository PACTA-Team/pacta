package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	cmw "github.com/go-chi/chi/v5/middleware"
	"github.com/stretchr/testify/assert"
)

func TestSecurityMiddlewareStack(t *testing.T) {
	// Helper to create a test router with full middleware stack and test endpoints
	newRouter := func() *chi.Mux {
		r := chi.NewRouter()

	// Apply middleware in the same order as production server
	r.Use(NewCORS())
	r.Use(cmw.Logger)
	r.Use(cmw.Recoverer)
	// CSRF protection with exempt paths matching production
	r.Use(CSRFProtection([]string{
		"/api/auth/login",
		"/api/auth/register",
		"/api/auth/logout",
		"/api/auth/verify-code",
		"/api/setup/status",
		"/api/setup",
	}))
	r.Use(RateLimit())
	// Security headers (adds X-Frame-Options, CSP, etc.)
	r.Use(SecurityHeaders())

		// Test endpoint: health check
		r.Get("/api/v1/health", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		}))

		// Test endpoint: contracts (protected by CSRF)
		r.Post("/api/v1/contracts", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"id":1}`))
		}))

		return r
	}

	tests := []struct {
		name           string
		method         string
		path           string
		origin         string
		expectedStatus int
		checkHeaders   func(*testing.T, http.Header)
	}{
		{
			name:           "CORS preflight request succeeds",
			method:         "OPTIONS",
			path:           "/api/v1/contracts",
			origin:         "http://127.0.0.1:3000",
			expectedStatus: 200,
			checkHeaders: func(t *testing.T, h http.Header) {
				assert.Equal(t, "http://127.0.0.1:3000", h.Get("Access-Control-Allow-Origin"))
			},
		},
		{
			name:           "Security headers present on all responses",
			method:         "GET",
			path:           "/api/v1/health",
			origin:         "",
			expectedStatus: 200,
			checkHeaders: func(t *testing.T, h http.Header) {
				assert.NotEmpty(t, h.Get("X-Frame-Options"))
				assert.NotEmpty(t, h.Get("X-Content-Type-Options"))
				assert.NotEmpty(t, h.Get("Content-Security-Policy"))
			},
		},
		{
			name:           "Unauthenticated POST without CSRF fails",
			method:         "POST",
			path:           "/api/v1/contracts",
			origin:         "",
			expectedStatus: 403,
			checkHeaders:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newRouter()
			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			// For preflight, indicate requested method
			if tt.method == "OPTIONS" {
				req.Header.Set("Access-Control-Request-Method", "POST")
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			assert.Equal(t, tt.expectedStatus, rec.Code)
			if tt.checkHeaders != nil {
				tt.checkHeaders(t, rec.Header())
			}
		})
	}
}
