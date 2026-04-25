package handlers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/db"
)

func setupTestDB(t *testing.T) *sql.DB {
	dir := t.TempDir()
	database, err := db.Open(dir)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	if err := db.Migrate(database); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}
	return database
}

func createCompany(t *testing.T, db *sql.DB, name string) int64 {
	res, err := db.Exec(
		"INSERT INTO companies (name, address, tax_id, company_type) VALUES (?, ?, ?, ?)",
		name, "", "", "single",
	)
	if err != nil {
		t.Fatalf("Failed to create company: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}

func createUser(t *testing.T, db *sql.DB, email, name string, companyID int64, role string) int64 {
	hash, err := auth.HashPassword("password")
	if err != nil {
		t.Fatal(err)
	}
	res, err := db.Exec(
		"INSERT INTO users (name, email, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		name, email, hash, role, "active", companyID,
	)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}

func createSession(t *testing.T, db *sql.DB, userID, companyID int64) string {
	token := "test_token_" + time.Now().Format("20060102150405")
	expires := time.Now().Add(24 * time.Hour)
	_, err := db.Exec(
		"INSERT INTO sessions (token, user_id, company_id, expires_at) VALUES (?, ?, ?, ?)",
		token, userID, companyID, expires,
	)
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	return token
}

// TestTenantContextMiddleware_ValidSession tests that the middleware
// correctly sets tenant context and allows request to proceed.
func TestTenantContextMiddleware_ValidSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Setup: create company, user, session
	companyID := createCompany(t, db, "TestCo")
	userID := createUser(t, db, "test@example.com", "Test User", companyID, "editor")
	sessionToken := createSession(t, db, userID, companyID)

	h := &Handler{DB: db}

	// Create test handler that checks context
	handlerCalled := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify tenant context is set
		tenantID, ok := r.Context().Value("tenant_id").(int64)
		assert.True(t, ok, "tenant_id should be in context")
		assert.Equal(t, companyID, tenantID, "tenant_id should match session company")
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	// Create request with session cookie
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: sessionToken})
	rec := httptest.NewRecorder()

	// Apply middleware
	middleware := h.TenantContextMiddleware(handler)
	middleware.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, handlerCalled, "handler should have been called")
}

// TestTenantContextMiddleware_InvalidSession tests that requests without
// valid session are rejected with 401.
func TestTenantContextMiddleware_InvalidSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	h := &Handler{DB: db}

	// Request with no session cookie
	req := httptest.NewRequest("GET", "/api/test", nil)
	rec := httptest.NewRecorder()

	middleware := h.TenantContextMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	middleware.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestTenantContextMiddleware_AuthRoutesBypass verifies that auth routes
// skip tenant context requirement.
func TestTenantContextMiddleware_AuthRoutesBypass(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	h := &Handler{DB: db}

	bypassCalled := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bypassCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/auth/login", nil) // No session needed
	rec := httptest.NewRecorder()

	middleware := h.TenantContextMiddleware(handler)
	middleware.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, bypassCalled, "auth route should bypass tenant check")
}
