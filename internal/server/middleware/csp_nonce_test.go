package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSecurityHeaders_NonceInCSP(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := SecurityHeadersWithNonce()(next)

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	csp := resp.Header.Get("Content-Security-Policy")

	if !strings.Contains(csp, "'nonce-") {
		t.Errorf("CSP missing nonce directive: %s", csp)
	}
	if strings.Contains(csp, "'unsafe-inline'") || strings.Contains(csp, "'unsafe-eval'") {
		t.Errorf("CSP still contains unsafe-inline or unsafe-eval: %s", csp)
	}
}
