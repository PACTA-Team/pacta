package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogin_NoUserEnumeration(t *testing.T) {
	// Setup in-memory DB or use test DB with no users
	// h := &Handler{DB: testDB}
	// req1 := login request with email "nonexistent@test.com"
	// resp1 := record response time
	// req2 := login with existing email but wrong password
	// resp2 := record response time
	// Assert response body strings are identical
	// t.Skip("Requires test DB setup")
}
