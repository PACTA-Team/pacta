package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORS_Middleware(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}

	corsHandler := NewCORS()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	req.Header.Set("Origin", "http://127.0.0.1:3000")

	corsHandler(handler).ServeHTTP(rec, req)

	// Verify status code
	if rec.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rec.Code)
	}

	// Verify CORS headers
	origin := rec.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://127.0.0.1:3000" {
		t.Errorf("Expected Access-Control-Allow-Origin to be 'http://127.0.0.1:3000', got %q", origin)
	}

	credentials := rec.Header().Get("Access-Control-Allow-Credentials")
	if credentials != "true" {
		t.Errorf("Expected Access-Control-Allow-Credentials to be 'true', got %q", credentials)
	}
}

func TestCORS_PreflightRequest(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}

	corsHandler := NewCORS()

	// Simulate OPTIONS preflight
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "http://127.0.0.1:3000")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)

	rec := httptest.NewRecorder()
	corsHandler(handler).ServeHTTP(rec, req)

	// Preflight should return 200 OK
	if rec.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rec.Code)
	}

	// Verify preflight headers
	origin := rec.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://127.0.0.1:3000" {
		t.Errorf("Expected Access-Control-Allow-Origin, got %q", origin)
	}

	methods := rec.Header().Get("Access-Control-Allow-Methods")
	if methods == "" {
		t.Errorf("Expected Access-Control-Allow-Methods header to be set")
	}

	maxAge := rec.Header().Get("Access-Control-Max-Age")
	if maxAge == "" {
		t.Errorf("Expected Access-Control-Max-Age header to be set")
	}
}

func TestCORS_AllowedOrigins(t *testing.T) {
	tests := []struct {
		name     string
		origin   string
		expected bool
	}{
		{
			name:     "localhost origin allowed",
			origin:   "http://127.0.0.1:3000",
			expected: true,
		},
		{
			name:     "production origin allowed",
			origin:   "https://app.pacta.local",
			expected: true,
		},
		{
			name:     "malicious origin not allowed",
			origin:   "https://evil.com",
			expected: false,
		},
		{
			name:     "empty origin not allowed",
			origin:   "",
			expected: false,
		},
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}

	corsHandler := NewCORS()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}

			rec := httptest.NewRecorder()
			corsHandler(handler).ServeHTTP(rec, req)

			header := rec.Header().Get("Access-Control-Allow-Origin")
			if tt.expected {
				if header == "" {
					t.Errorf("Expected CORS header to be set for origin %q, got empty", tt.origin)
				}
			} else {
				if header != "" {
					t.Errorf("Expected no CORS header for origin %q, got %q", tt.origin, header)
				}
			}
		})
	}
}

func TestCORS_AllowedMethods(t *testing.T) {
	corsHandler := NewCORS()
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "http://127.0.0.1:3000")
	rec := httptest.NewRecorder()
	corsHandler(handler).ServeHTTP(rec, req)

	methods := rec.Header().Get("Access-Control-Allow-Methods")
	if methods == "" {
		t.Errorf("Expected Access-Control-Allow-Methods header, got empty")
	}

	expectedMethods := []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	for _, m := range expectedMethods {
		if !strings.Contains(methods, m) {
			t.Errorf("Expected methods to contain %q, got %q", m, methods)
		}
	}
}

func TestCORS_AllowedHeaders(t *testing.T) {
	corsHandler := NewCORS()
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "http://127.0.0.1:3000")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type, X-CSRF-Token")
	rec := httptest.NewRecorder()
	corsHandler(handler).ServeHTTP(rec, req)

	// Preflight should echo back requested headers
	headers := rec.Header().Get("Access-Control-Allow-Headers")
	if headers == "" {
		t.Errorf("Expected Access-Control-Allow-Headers header, got empty")
	}
}

func TestCORS_ExposedHeaders(t *testing.T) {
	corsHandler := NewCORS()
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Total-Count", "42")
		w.WriteHeader(http.StatusOK)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "http://127.0.0.1:3000")
	rec := httptest.NewRecorder()
	corsHandler(handler).ServeHTTP(rec, req)

	exposed := rec.Header().Get("Access-Control-Expose-Headers")
	if exposed == "" {
		t.Errorf("Expected Access-Control-Expose-Headers header, got empty")
	}
	if !strings.Contains(exposed, "X-Total-Count") {
		t.Errorf("Expected exposed headers to contain X-Total-Count, got %q", exposed)
	}
}
