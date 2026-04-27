package email

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"time"
)

const tokenExpiry = 30 * time.Minute

// GenerateResetToken generates a new random reset token for the given user ID.
// Returns the token string, expiration time, and any error.
func GenerateResetToken(userID int64) (string, time.Time, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", time.Time{}, fmt.Errorf("failed to generate random bytes: %w", err)
	}
	token := base64.URLEncoding.EncodeToString(b)
	expiresAt := time.Now().Add(tokenExpiry)
	return token, expiresAt, nil
}

// SaveResetToken saves a password reset token to the database.
func SaveResetToken(db *sql.DB, userID int64, token string, expiresAt time.Time) error {
	_, err := db.Exec(
		"INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
		userID, token, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save reset token: %w", err)
	}
	return nil
}

// ValidateResetToken validates a password reset token.
// Checks that the token exists, has not been used (usedAt IS NULL), and has not expired.
// Returns the user ID associated with the token, or an error.
func ValidateResetToken(db *sql.DB, token string) (int64, error) {
	var userID int64
	var expiresAt time.Time
	var usedAt sql.NullTime

	err := db.QueryRow(
		"SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?",
		token,
	).Scan(&userID, &expiresAt, &usedAt)

	if err == sql.ErrNoRows {
		return 0, fmt.Errorf("token not found")
	}
	if err != nil {
		return 0, fmt.Errorf("failed to query reset token: %w", err)
	}

	if usedAt.Valid {
		return 0, fmt.Errorf("token already used")
	}

	if time.Now().After(expiresAt) {
		return 0, fmt.Errorf("token expired")
	}

	return userID, nil
}

// MarkTokenUsed marks a reset token as used by setting the used_at timestamp.
func MarkTokenUsed(db *sql.DB, token string) error {
	result, err := db.Exec(
		"UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ? AND used_at IS NULL",
		token,
	)
	if err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("token not found or already used")
	}

	return nil
}

// CleanupExpiredTokens deletes expired and unused tokens from the database.
// Returns the number of tokens deleted.
func CleanupExpiredTokens(db *sql.DB) (int64, error) {
	result, err := db.Exec(
		"DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP AND used_at IS NULL",
	)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired tokens: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rowsAffected, nil
}
