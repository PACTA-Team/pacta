package auth

import (
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
)

type Session struct {
	Token     string
	UserID    int
	CompanyID int
	ExpiresAt time.Time
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func CreateSession(queries *db.Queries, userID int, companyID int) (*Session, error) {
	token, err := generateToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(8 * time.Hour)
	lastActivity := time.Now()

	// Delete existing sessions for this user before creating new one (prevents session fixation)
	_ = queries.DeleteSessionByUserID(context.Background(), int64(userID))

	_, err = queries.CreateSession(context.Background(), db.CreateSessionParams{
		Token:        token,
		UserID:      int64(userID),
		CompanyID:   int64(companyID),
		ExpiresAt:   expiresAt,
		LastActivity: lastActivity,
	})
	if err != nil {
		return nil, err
	}
	return &Session{Token: token, UserID: userID, CompanyID: companyID, ExpiresAt: expiresAt}, nil
}

func GetSession(queries *db.Queries, token string) (*Session, error) {
	row, err := queries.GetSessionByToken(context.Background(), token)
	if err != nil {
		return nil, err
	}
	if row.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("session expired")
	}
	return &Session{
		Token:     row.Token,
		UserID:    int(row.UserID),
		CompanyID: int(row.CompanyID),
		ExpiresAt: row.ExpiresAt,
	}, nil
}

func DeleteSession(queries *db.Queries, token string) error {
	return queries.DeleteSession(context.Background(), token)
}

func GetUserID(queries *db.Queries, token string) (int, error) {
	s, err := GetSession(queries, token)
	if err != nil {
		return 0, err
	}
	return s.UserID, nil
}
