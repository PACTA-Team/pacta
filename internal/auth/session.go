package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"time"
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

func CreateSession(db *sql.DB, userID int, companyID int) (*Session, error) {
	token, err := generateToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = db.Exec(
		"INSERT INTO sessions (token, user_id, company_id, expires_at) VALUES (?, ?, ?, ?)",
		token, userID, companyID, expiresAt,
	)
	if err != nil {
		return nil, err
	}
	return &Session{Token: token, UserID: userID, CompanyID: companyID, ExpiresAt: expiresAt}, nil
}

func GetSession(db *sql.DB, token string) (*Session, error) {
	var s Session
	err := db.QueryRow(
		"SELECT token, user_id, company_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?",
		token, time.Now(),
	).Scan(&s.Token, &s.UserID, &s.CompanyID, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func DeleteSession(db *sql.DB, token string) error {
	_, err := db.Exec("DELETE FROM sessions WHERE token = ?", token)
	return err
}

func GetUserID(db *sql.DB, token string) (int, error) {
	s, err := GetSession(db, token)
	if err != nil {
		return 0, err
	}
	return s.UserID, nil
}
