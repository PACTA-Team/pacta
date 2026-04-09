package auth

import (
	"database/sql"
	"fmt"

	"github.com/PACTA-Team/pacta/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func Authenticate(db *sql.DB, email, password string) (*models.User, error) {
	var u models.User
	err := db.QueryRow(`
		SELECT id, name, email, password_hash, role, status
		FROM users WHERE email = ? AND deleted_at IS NULL
	`, email).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Status)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	if !CheckPassword(password, u.PasswordHash) {
		return nil, fmt.Errorf("invalid password")
	}
	if u.Status != "active" {
		return nil, fmt.Errorf("user account is %s", u.Status)
	}
	return &u, nil
}
