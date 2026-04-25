package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// TestCSRF_ProtectionEnabled tests CSRF protection behavior
func TestCSRF_ProtectionEnabled(t *testing.T) {
	exemptPaths := []string{"/api/auth/login", "/api/auth/register"}

	// Create a test server with CSRF protection
	csrfMiddleware := CSRFProtection(exemptPaths)

	// Test handlers
	loginHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Create router
	r := chi.NewRouter()
	r.Use(csrfMiddleware)
	r.Post("/api/auth/login", loginHandler)
	r.Post("/api/protected", protectedHandler)

	// Test 1: POST to exempt path without CSRF token should pass
	t.Run("POST to exempt endpoint without token passes", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/auth/login", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
		}
	})

	// Test 2: POST to protected path without CSRF token should fail (403)
	t.Run("POST to protected endpoint without token fails", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/protected", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("Expected status 403, got %d. Body: %s", rec.Code, rec.Body.String())
		}
	})

	// Test 3: POST to protected with valid CSRF token should pass
	t.Run("POST to protected endpoint with valid token passes", func(t *testing.T) {
		// First make a GET request to any endpoint to get CSRF token cookie
		// The CSRF middleware sets cookie on any response
		req1 := httptest.NewRequest("GET", "/api/auth/login", nil)
		rec1 := httptest.NewRecorder()
		r.ServeHTTP(rec1, req1)

		// Extract CSRF token from Set-Cookie header
		cookieHeader := rec1.Header().Get("Set-Cookie")
		if cookieHeader == "" {
			t.Fatal("CSRF cookie not set on GET request")
		}

		// Parse the cookie value (format: _csrf_token=...; Path=/; ...)
		var csrfToken string
		parts := strings.Split(cookieHeader, ";")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if strings.HasPrefix(trimmed, "_csrf_token=") {
				csrfToken = strings.TrimPrefix(trimmed, "_csrf_token=")
				break
			}
		}

		if csrfToken == "" {
			t.Fatal("Failed to extract CSRF token from cookie")
		}

		// Now POST with token
		req2 := httptest.NewRequest("POST", "/api/protected", nil)
		req2.Header.Set("X-CSRF-Token", csrfToken)
		rec2 := httptest.NewRecorder()
		r.ServeHTTP(rec2, req2)

		if rec2.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d. Body: %s", rec2.Code, rec2.Body.String())
		}
	})
}

// TestCSRF_Configuration tests CSRF cookie settings
func TestCSRF_Configuration(t *testing.T) {
	exemptPaths := []string{"/api/auth/login"}
	csrfMiddleware := CSRFProtection(exemptPaths)

	loginHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	r := chi.NewRouter()
	r.Use(csrfMiddleware)
	r.Post("/api/auth/login", loginHandler)

	// Make a request to trigger CSRF cookie setting
	req := httptest.NewRequest("POST", "/api/auth/login", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	// Verify CSRF cookie is set in response
	cookies := rec.Result().Cookies()
	var csrfCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "_csrf_token" {
			csrfCookie = cookie
			break
		}
	}

	if csrfCookie == nil {
		t.Fatal("CSRF cookie not set")
	}

	// Test 2: Verify cookie is HttpOnly
	t.Run("Cookie is HttpOnly", func(t *testing.T) {
		if !csrfCookie.HttpOnly {
			t.Errorf("Expected CSRF cookie to be HttpOnly, got %v", csrfCookie.HttpOnly)
		}
	})

	// Test 3: Verify cookie path is "/"
	t.Run("Cookie path is /", func(t *testing.T) {
		if csrfCookie.Path != "/" {
			t.Errorf("Expected CSRF cookie path to be '/', got '%s'", csrfCookie.Path)
		}
	})

	// Test 4: Verify cookie has value
	t.Run("Cookie has non-empty value", func(t *testing.T) {
		if csrfCookie.Value == "" {
			t.Error("CSRF cookie value should not be empty")
		}
	})
}

// TestCSRF_ExemptPaths tests that exempt paths bypass CSRF checks
func TestCSRF_ExemptPaths(t *testing.T) {
	exemptPaths := []string{"/api/public", "/api/setup"}
	csrfMiddleware := CSRFProtection(exemptPaths)

	// Handler for public endpoint
	publicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	r := chi.NewRouter()
	r.Use(csrfMiddleware)
	r.Post("/api/public/companies", publicHandler)
	r.Post("/api/setup", protectedHandler)
	r.Post("/api/companies", protectedHandler)

	tests := []struct {
		name          string
		path          string
		method        string
		expectSuccess bool
	}{
		{"POST to exempt path succeeds", "/api/public/companies", "POST", true},
		{"POST to another exempt path succeeds", "/api/setup", "POST", true},
		{"POST to protected path fails without token", "/api/companies", "POST", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if tt.expectSuccess {
				if rec.Code != http.StatusOK {
					t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
				}
			} else {
				if rec.Code != http.StatusForbidden {
					t.Errorf("Expected status 403, got %d. Body: %s", rec.Code, rec.Body.String())
				}
			}
})
 	}
}
