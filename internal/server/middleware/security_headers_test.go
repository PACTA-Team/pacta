package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestSecurityHeaders_Development(t *testing.T) {
	// Set environment to development
	os.Setenv("ENVIRONMENT", "development")
	defer os.Unsetenv("ENVIRONMENT")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	securityHandler := SecurityHeaders()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)

	securityHandler(handler).ServeHTTP(rec, req)

	// Verify all security headers are present in development mode

	// X-Frame-Options should be DENY
	xfo := rec.Header().Get("X-Frame-Options")
	if xfo != "DENY" {
		t.Errorf("Expected X-Frame-Options to be 'DENY', got %q", xfo)
	}

	// X-Content-Type-Options should be nosniff
	xcto := rec.Header().Get("X-Content-Type-Options")
	if xcto != "nosniff" {
		t.Errorf("Expected X-Content-Type-Options to be 'nosniff', got %q", xcto)
	}

	// X-XSS-Protection should be "1; mode=block"
	xxss := rec.Header().Get("X-XSS-Protection")
	if xxss != "1; mode=block" {
		t.Errorf("Expected X-XSS-Protection to be '1; mode=block', got %q", xxss)
	}

	// Content-Security-Policy should contain default-src 'self'
	csp := rec.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Errorf("Expected Content-Security-Policy header to be set")
	} else if !contains(csp, "default-src 'self'") {
		t.Errorf("Expected CSP to contain \"default-src 'self'\", got %q", csp)
	}

	// Referrer-Policy should be strict-origin-when-cross-origin
	referrer := rec.Header().Get("Referrer-Policy")
	if referrer != "strict-origin-when-cross-origin" {
		t.Errorf("Expected Referrer-Policy to be 'strict-origin-when-cross-origin', got %q", referrer)
	}

	// Permissions-Policy should be set with restrictive values
	permissions := rec.Header().Get("Permissions-Policy")
	if permissions == "" {
		t.Errorf("Expected Permissions-Policy header to be set")
	} else if !contains(permissions, "camera=()") || !contains(permissions, "microphone=()") {
		t.Errorf("Expected Permissions-Policy to restrict camera and microphone, got %q", permissions)
	}

	// COOP should be set
	coop := rec.Header().Get("Cross-Origin-Opener-Policy")
	if coop != "same-origin" {
		t.Errorf("Expected Cross-Origin-Opener-Policy to be 'same-origin', got %q", coop)
	}

	// COEP should be set
	coep := rec.Header().Get("Cross-Origin-Embedder-Policy")
	if coep != "require-corp" {
		t.Errorf("Expected Cross-Origin-Embedder-Policy to be 'require-corp', got %q", coep)
	}

	// CORP should be set
	corp := rec.Header().Get("Cross-Origin-Resource-Policy")
	if corp != "same-origin" {
		t.Errorf("Expected Cross-Origin-Resource-Policy to be 'same-origin', got %q", corp)
	}

	// HSTS should NOT be present in development
	hsts := rec.Header().Get("Strict-Transport-Security")
	if hsts != "" {
		t.Errorf("Expected Strict-Transport-Security to be absent in development, got %q", hsts)
	}

	// Server header should be removed
	server := rec.Header().Get("Server")
	if server != "" {
		t.Errorf("Expected Server header to be removed, got %q", server)
	}

	// X-Powered-By should be removed
	xpb := rec.Header().Get("X-Powered-By")
	if xpb != "" {
		t.Errorf("Expected X-Powered-By header to be removed, got %q", xpb)
	}
}

func TestSecurityHeaders_Production(t *testing.T) {
	// Set environment to production
	os.Setenv("ENVIRONMENT", "production")
	defer os.Unsetenv("ENVIRONMENT")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	securityHandler := SecurityHeaders()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)

	securityHandler(handler).ServeHTTP(rec, req)

	// All development headers should still be present...

	// X-Frame-Options
	xfo := rec.Header().Get("X-Frame-Options")
	if xfo != "DENY" {
		t.Errorf("Expected X-Frame-Options to be 'DENY', got %q", xfo)
	}

	// X-Content-Type-Options
	xcto := rec.Header().Get("X-Content-Type-Options")
	if xcto != "nosniff" {
		t.Errorf("Expected X-Content-Type-Options to be 'nosniff', got %q", xcto)
	}

	// X-XSS-Protection
	xxss := rec.Header().Get("X-XSS-Protection")
	if xxss != "1; mode=block" {
		t.Errorf("Expected X-XSS-Protection to be '1; mode=block', got %q", xxss)
	}

	// CSP
	csp := rec.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Errorf("Expected Content-Security-Policy header to be set")
	}

	// HSTS SHOULD be present in production
	hsts := rec.Header().Get("Strict-Transport-Security")
	if hsts == "" {
		t.Errorf("Expected Strict-Transport-Security header to be set in production")
	} else if !contains(hsts, "max-age=31536000") {
		t.Errorf("Expected HSTS to contain max-age=31536000, got %q", hsts)
	} else if !contains(hsts, "includeSubDomains") {
		t.Errorf("Expected HSTS to contain includeSubDomains, got %q", hsts)
	} else if !contains(hsts, "preload") {
		t.Errorf("Expected HSTS to contain preload, got %q", hsts)
	}

	// Server and X-Powered-By should still be removed
	server := rec.Header().Get("Server")
	if server != "" {
		t.Errorf("Expected Server header to be removed, got %q", server)
	}

	xpb := rec.Header().Get("X-Powered-By")
	if xpb != "" {
		t.Errorf("Expected X-Powered-By header to be removed, got %q", xpb)
	}
}

func TestSecurityHeaders_CSP_BlocksUnsafeInline(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	defer os.Unsetenv("ENVIRONMENT")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	securityHandler := SecurityHeaders()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	securityHandler(handler).ServeHTTP(rec, req)

	csp := rec.Header().Get("Content-Security-Policy")

	// CSP should include strict directives
	if !contains(csp, "default-src 'self'") {
		t.Errorf("Expected CSP to contain \"default-src 'self'\" directive")
	}

	// Frame-ancestors should block embedding
	if !contains(csp, "frame-ancestors 'none'") {
		t.Errorf("Expected CSP to contain \"frame-ancestors 'none'\" directive")
	}

	// Form action restricted
	if !contains(csp, "form-action 'self'") {
		t.Errorf("Expected CSP to contain \"form-action 'self'\" directive")
	}

	// Base URI restricted
	if !contains(csp, "base-uri 'self'") {
		t.Errorf("Expected CSP to contain \"base-uri 'self'\" directive")
	}
}

// TestSecurityHeaders_Staging tests that staging doesn't have HSTS (use same as dev)
func TestSecurityHeaders_Staging(t *testing.T) {
	os.Setenv("ENVIRONMENT", "staging")
	defer os.Unsetenv("ENVIRONMENT")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	securityHandler := SecurityHeaders()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	securityHandler(handler).ServeHTTP(rec, req)

	// HSTS should NOT be present in staging
	hsts := rec.Header().Get("Strict-Transport-Security")
	if hsts != "" {
		t.Errorf("Expected HSTS to be absent in staging, got %q", hsts)
	}
}

// TestSecurityHeaders_CustomEnvironment tests that only production gets HSTS
func TestSecurityHeaders_CustomEnvironment(t *testing.T) {
	os.Setenv("ENVIRONMENT", "custom")
	defer os.Unsetenv("ENVIRONMENT")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	securityHandler := SecurityHeaders()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	securityHandler(handler).ServeHTTP(rec, req)

	// HSTS should NOT be present for custom env
	hsts := rec.Header().Get("Strict-Transport-Security")
	if hsts != "" {
		t.Errorf("Expected HSTS to be absent for custom environment, got %q", hsts)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
