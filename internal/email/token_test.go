package email

import (
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
	"github.com/stretchr/testify/assert"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	assert.NoError(t, err)

	// Create the password_reset_tokens table
	_, err = db.Exec(`
		CREATE TABLE password_reset_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			token TEXT NOT NULL UNIQUE,
			expires_at DATETIME NOT NULL,
			used_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`)
	assert.NoError(t, err)

	return db
}

func TestGenerateToken(t *testing.T) {
	token, expiresAt, err := GenerateResetToken(1)

	assert.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.WithinDuration(t, time.Now().Add(tokenExpiry), expiresAt, 5*time.Second)
}

func TestValidateToken(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userID := int64(42)
	token, expiresAt, err := GenerateResetToken(userID)
	assert.NoError(t, err)

	err = SaveResetToken(db, userID, token, expiresAt)
	assert.NoError(t, err)

	gotUserID, err := ValidateResetToken(db, token)
	assert.NoError(t, err)
	assert.Equal(t, userID, gotUserID)
}

func TestValidateToken_Expired(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userID := int64(42)
	token := "expired_token_test"

	// Save token with expiration in the past
	expiresAt := time.Now().Add(-time.Hour)
	err := SaveResetToken(db, userID, token, expiresAt)
	assert.NoError(t, err)

	_, err = ValidateResetToken(db, token)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expired")
}

func TestValidateToken_Used(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userID := int64(42)
	token, expiresAt, err := GenerateResetToken(userID)
	assert.NoError(t, err)

	err = SaveResetToken(db, userID, token, expiresAt)
	assert.NoError(t, err)

	// Mark token as used
	err = MarkTokenUsed(db, token)
	assert.NoError(t, err)

	_, err = ValidateResetToken(db, token)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already used")
}

func TestValidateToken_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	_, err := ValidateResetToken(db, "nonexistent_token")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestMarkTokenUsed(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userID := int64(42)
	token, expiresAt, err := GenerateResetToken(userID)
	assert.NoError(t, err)

	err = SaveResetToken(db, userID, token, expiresAt)
	assert.NoError(t, err)

	err = MarkTokenUsed(db, token)
	assert.NoError(t, err)

	// Verify token is marked as used
	var usedAt sql.NullTime
	err = db.QueryRow("SELECT used_at FROM password_reset_tokens WHERE token = ?", token).Scan(&usedAt)
	assert.NoError(t, err)
	assert.True(t, usedAt.Valid)
}

func TestCleanupExpiredTokens(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	userID := int64(42)

	// Create an expired token
	expiredToken := "expired_token"
	expiredExpiresAt := time.Now().Add(-time.Hour)
	err := SaveResetToken(db, userID, expiredToken, expiredExpiresAt)
	assert.NoError(t, err)

	// Create a valid token
	validToken, validExpiresAt, err := GenerateResetToken(userID)
	assert.NoError(t, err)
	err = SaveResetToken(db, userID, validToken, validExpiresAt)
	assert.NoError(t, err)

	// Cleanup expired tokens
	deleted, err := CleanupExpiredTokens(db)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), deleted)

	// Verify expired token is deleted
	_, err = ValidateResetToken(db, expiredToken)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")

	// Verify valid token still exists
	gotUserID, err := ValidateResetToken(db, validToken)
	assert.NoError(t, err)
	assert.Equal(t, userID, gotUserID)
}
