package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func generateToken() string {
	// Simple token generation - in production use crypto/rand
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func Authenticate(queries *db.Queries, email, password string) (*models.User, error) {
	user, err := queries.GetUserForSignIn(context.Background(), email)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	if !CheckPassword(password, user.PasswordHash) {
		return nil, fmt.Errorf("invalid password")
	}
	if user.Status != "active" {
		return nil, fmt.Errorf("user account is %s", user.Status)
	}
	return &models.User{
		ID:           user.ID,
		Name:         user.Name,
		Email:        user.Email,
		PasswordHash: user.PasswordHash,
		Role:         user.Role,
		Status:       user.Status,
		CompanyID:    user.CompanyID,
		SetupCompleted: user.SetupCompleted,
	}, nil
}

func CreateSession(queries *db.Queries, userID, companyID int) (*db.Session, error) {
	token := generateToken()
	expiresAt := time.Now().Add(24 * time.Hour)
	err := queries.CreateSession(context.Background(), db.CreateSessionParams{
		Token:     token,
		UserID:    int64(userID),
		CompanyID: int64(companyID),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, err
	}
	return &db.Session{
		Token:     token,
		UserID:    int64(userID),
		CompanyID: int64(companyID),
		ExpiresAt: expiresAt,
	}, nil
}

func DeleteSession(queries *db.Queries, token string) error {
	return queries.DeleteSession(context.Background(), token)
}

func GetUserID(queries *db.Queries, token string) (int, error) {
	session, err := queries.GetSessionByToken(context.Background(), token)
	if err != nil {
		return 0, err
	}
	return int(session.UserID), nil
}
