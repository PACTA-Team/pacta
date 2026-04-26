package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/stretchr/testify/assert"
)

// TestLogin_NoUserEnumeration tests that login returns indistinguishable
// responses for non-existent email vs wrong password.
func TestLogin_NoUserEnumeration(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Create a company
	companyID := createCompany(t, db, "EnumTestCo")

	// Create an active user
	createUser(t, db, "existing@example.com", "Existing User", companyID, "viewer")

	h := &Handler{DB: db}

	doLogin := func(email, password string) (int, string) {
		reqBody := map[string]string{"email": email, "password": password}
		encoded, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(encoded))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.HandleLogin(rec, req)
		return rec.Code, rec.Body.String()
	}

	// Non-existent email
	codeA, bodyA := doLogin("nonexistent@example.com", "any")

	// Existing email, wrong password
	codeB, bodyB := doLogin("existing@example.com", "wrongpassword")

	assert.Equal(t, http.StatusUnauthorized, codeA)
	assert.Equal(t, http.StatusUnauthorized, codeB)
	assert.Equal(t, bodyA, bodyB, "login responses must be identical to prevent enumeration")
}

// TestVerifyCode_NoUserEnumeration tests that verify-code returns indistinguishable
// responses for non-existent email vs wrong code (and other failure modes).
func TestVerifyCode_NoUserEnumeration(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	companyID := createCompany(t, db, "VerifyTestCo")

	// Create a pending user with valid registration code
	userID, validCode := createPendingUserWithCode(t, db, "pending@example.com", "Pending User", companyID)
	t.Logf("created pending user %d with code %s", userID, validCode)

	h := &Handler{DB: db}

	doVerify := func(email, code string) (int, string) {
		reqBody := map[string]string{"email": email, "code": code}
		encoded, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/verify-code", bytes.NewReader(encoded))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.HandleVerifyCode(rec, req)
		return rec.Code, rec.Body.String()
	}

	// Scenario A: non-existent email
	codeA, bodyA := doVerify("nonexistent@example.com", "123456")

	// Scenario B: existing email but wrong code
	codeB, bodyB := doVerify("pending@example.com", "wrongcode")

	// Both should be 401 and identical body
	assert.Equal(t, http.StatusUnauthorized, codeA)
	assert.Equal(t, http.StatusUnauthorized, codeB)
	assert.Equal(t, bodyA, bodyB, "verify-code responses must be identical to prevent enumeration")
}

// createPendingUserWithCode creates a user with status 'pending_email' and a
// registration code that is valid (not expired). Returns userID and the plain code.
func createPendingUserWithCode(t *testing.T, db *sql.DB, email, name string, companyID int64) (int64, string) {
	hash, err := auth.HashPassword("dummypassword")
	if err != nil {
		t.Fatal(err)
	}
	res, err := db.Exec(
		"INSERT INTO users (name, email, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		name, email, hash, "viewer", "pending_email", companyID,
	)
	if err != nil {
		t.Fatal(err)
	}
	userID, _ := res.LastInsertId()

	plainCode := "123456"
	codeHash, err := auth.HashPassword(plainCode)
	if err != nil {
		t.Fatal(err)
	}
	expires := time.Now().Add(24 * time.Hour)
	_, err = db.Exec(
		"INSERT INTO registration_codes (user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
		userID, codeHash, expires,
	)
	if err != nil {
		t.Fatal(err)
	}
	return userID, plainCode
}
