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

func TestForgotPassword(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	companyID := createCompany(t, db, "ResetTestCo")
	createUser(t, db, "existing@example.com", "Existing User", companyID, "viewer")

	h := &Handler{DB: db}

	doForgot := func(email string) int {
		reqBody := map[string]string{"email": email}
		encoded, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/auth/forgot-password", bytes.NewReader(encoded))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.ForgotPassword(rec, req)
		return rec.Code
	}

	// Non-existent email should return 202 Accepted (prevent enumeration)
	code := doForgot("nonexistent@example.com")
	assert.Equal(t, http.StatusAccepted, code)

	// Existing email should also return 202 Accepted
	code = doForgot("existing@example.com")
	assert.Equal(t, http.StatusAccepted, code)
}

func TestResetPassword(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	companyID := createCompany(t, db, "ResetTestCo2")
	userID := createUser(t, db, "reset@example.com", "Reset User", companyID, "viewer")

	h := &Handler{DB: db}

	// Generate a valid token directly in DB for testing
	token, _, err := generateTestResetToken(t, db, userID)
	assert.NoError(t, err)

	doReset := func(token, newPassword string) int {
		reqBody := map[string]string{"token": token, "new_password": newPassword}
		encoded, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/auth/reset-password", bytes.NewReader(encoded))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.ResetPassword(rec, req)
		return rec.Code
	}

	// Valid token with new password
	code := doReset(token, "NewPass123!")
	assert.Equal(t, http.StatusOK, code)

	// Verify password was changed
	var hash string
	err = db.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&hash)
	assert.NoError(t, err)
	assert.NotEmpty(t, hash)

	// Verify new password works
	user, err := auth.Authenticate(db, "reset@example.com", "NewPass123!")
	assert.NoError(t, err)
	assert.Equal(t, userID, user.ID)

	// Invalid token
	code = doReset("invalid-token", "AnotherPass123!")
	assert.Equal(t, http.StatusBadRequest, code)
}

func TestValidateResetToken(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	companyID := createCompany(t, db, "ResetTestCo3")
	userID := createUser(t, db, "validate@example.com", "Validate User", companyID, "viewer")

	h := &Handler{DB: db}

	// Generate a valid token directly in DB for testing
	token, _, err := generateTestResetToken(t, db, userID)
	assert.NoError(t, err)

	doValidate := func(token string) int {
		req := httptest.NewRequest("GET", "/api/auth/validate-token/"+token, nil)
		rec := httptest.NewRecorder()
		h.ValidateResetToken(rec, req)
		return rec.Code
	}

	// Valid token
	code := doValidate(token)
	assert.Equal(t, http.StatusOK, code)

	// Invalid token
	code = doValidate("invalid-token")
	assert.Equal(t, http.StatusBadRequest, code)
}

// generateTestResetToken creates a reset token directly in the database for testing.
func generateTestResetToken(t *testing.T, db *sql.DB, userID int64) (string, time.Time, error) {
	token := "test-token-" + time.Now().Format("20060102150405.000000")
	expiresAt := time.Now().Add(30 * time.Minute)

	_, err := db.Exec(
		"INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
		userID, token, expiresAt,
	)
	if err != nil {
		return "", time.Time{}, err
	}

	return token, expiresAt, nil
}
