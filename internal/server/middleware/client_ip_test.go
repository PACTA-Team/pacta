package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIP_TrustsXForwardedForFromLocalhost(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := GetClientIP(r)
		if ip != "203.0.113.5" {
			t.Errorf("Expected 203.0.113.5, got %s", ip)
		}
	})
	handler := ClientIP(next)

	// Simulate request from Caddy (RemoteAddr=127.0.0.1) with X-Forwarded-For
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "127.0.0.1:12345"
	req.Header.Set("X-Forwarded-For", "203.0.113.5")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
}

func TestClientIP_UsesRemoteAddrWhenNotLocalhost(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := GetClientIP(r)
		if ip != "198.51.100.7" {
			t.Errorf("Expected 198.51.100.7, got %s", ip)
		}
	})
	handler := ClientIP(next)

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "198.51.100.7:12345"
	// No X-Forwarded-For
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
}
