package email

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
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

// SaveResetToken saves a password reset token to the database using sqlc Queries.
func SaveResetToken(queries *db.Queries, userID int64, token string, expiresAt time.Time) error {
	err := queries.CreatePasswordResetToken(context.Background(), db.CreatePasswordResetTokenParams{
		UserID:    userID,
		Token:     token,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return fmt.Errorf("failed to save reset token: %w", err)
	}
	return nil
}

// ValidateResetToken validates a password reset token using sqlc Queries.
// Checks that the token exists, has not been used, and has not expired.
// Returns the user ID associated with the token, or an error.
func ValidateResetToken(queries *db.Queries, token string) (int64, error) {
	row, err := queries.GetValidPasswordResetToken(context.Background(), token)
	if err != nil {
		return 0, fmt.Errorf("token not found or invalid")
	}

	if time.Now().After(row.ExpiresAt) {
		return 0, fmt.Errorf("token expired")
	}

	return row.UserID, nil
}

// MarkTokenUsed marks a reset token as used by setting the used_at timestamp.
func MarkTokenUsed(queries *db.Queries, token string) error {
	err := queries.MarkPasswordResetTokenUsed(context.Background(), token)
	if err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}
	return nil
}

// CleanupExpiredTokens deletes expired and unused tokens from the database.
// Returns the number of tokens deleted.
func CleanupExpiredTokens(queries *db.Queries) (int64, error) {
	err := queries.DeleteExpiredPasswordResetTokens(context.Background())
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired tokens: %w", err)
	}
	return 0, nil
}
