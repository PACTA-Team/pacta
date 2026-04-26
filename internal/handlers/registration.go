package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/email"
)

type VerifyCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (h *Handler) HandleVerifyCode(w http.ResponseWriter, r *http.Request) {
	var req VerifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	var userID int
	var status string
	err := h.DB.QueryRow("SELECT id, status FROM users WHERE email = ? AND deleted_at IS NULL", req.Email).Scan(&userID, &status)
	if err != nil {
		log.Printf("[handlers/registration] ERROR: user lookup failed for %s: %v", req.Email, err)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	if status != "pending_email" {
		log.Printf("[handlers/registration] ERROR: user %d status not pending: %s", userID, status)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	var codeHash string
	var expiresAt time.Time
	err = h.DB.QueryRow(`
		SELECT code_hash, expires_at FROM registration_codes
		WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
	`, userID).Scan(&codeHash, &expiresAt)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "verification failed")
		return
	}

	if time.Now().After(expiresAt) {
		log.Printf("[handlers/registration] ERROR: verification code expired for user %d", userID)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	var attempts int
	h.DB.QueryRow("SELECT attempts FROM registration_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userID).Scan(&attempts)
	if attempts >= 5 {
		log.Printf("[handlers/registration] ERROR: too many attempts for user %d", userID)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	if !auth.CheckPassword(req.Code, codeHash) {
		h.DB.Exec("UPDATE registration_codes SET attempts = attempts + 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userID)
		log.Printf("[handlers/registration] ERROR: invalid verification code for user %d", userID)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	_, err = h.DB.Exec("UPDATE users SET status = 'active' WHERE id = ?", userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "verification failed")
		return
	}

	var companyID int
	err = h.DB.QueryRow("SELECT id FROM companies LIMIT 1").Scan(&companyID)
	if err == sql.ErrNoRows {
		result, _ := h.DB.Exec("INSERT INTO companies (name, company_type) VALUES (?, ?)", "Default Company", "client")
		id64, _ := result.LastInsertId()
		companyID = int(id64)
	}

	h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", userID, companyID)

	session, err := auth.CreateSession(h.DB, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "verified"})
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func sendAdminNotifications(ctx context.Context, db *sql.DB, userName, userEmail, companyName, lang string) error {
	rows, err := db.Query("SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var adminEmail string
		if err := rows.Scan(&adminEmail); err != nil {
			continue
		}
		email.SendAdminNotification(ctx, adminEmail, userName, userEmail, companyName, lang)
	}
	return nil
}
