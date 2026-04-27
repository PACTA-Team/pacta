package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/email"
	"github.com/go-chi/chi/v5"
	"github.com/wneessen/go-mail"
	"golang.org/x/crypto/bcrypt"
)

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if strings.TrimSpace(req.Email) == "" {
		h.Error(w, http.StatusBadRequest, "email is required")
		return
	}

	var userID int64
	var userName string
	var lang string
	err := h.DB.QueryRow(
		"SELECT id, name, language FROM users WHERE email = ? AND status != 'locked' AND deleted_at IS NULL",
		req.Email,
	).Scan(&userID, &userName, &lang)
	if err == sql.ErrNoRows {
		log.Printf("[password_reset] user not found for email: %s", req.Email)
		w.WriteHeader(http.StatusAccepted)
		return
	}
	if err != nil {
		log.Printf("[password_reset] error finding user: %v", err)
		w.WriteHeader(http.StatusAccepted)
		return
	}

	token, expiresAt, err := email.GenerateResetToken(userID)
	if err != nil {
		log.Printf("[password_reset] error generating token: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := email.SaveResetToken(h.DB, userID, token, expiresAt); err != nil {
		log.Printf("[password_reset] error saving token: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	resetLink := "http://" + r.Host + "/reset-password?token=" + token
	if lang == "" {
		lang = detectLanguageFromHeader(r.Header.Get("Accept-Language"))
	}
	template := email.GetPasswordResetTemplate(lang, resetLink, userName)

	msg := mail.NewMsg()
	if err := msg.From("PACTA <noreply@pacta.duckdns.org>"); err != nil {
		log.Printf("[password_reset] error setting from: %v", err)
		w.WriteHeader(http.StatusAccepted)
		return
	}
	if err := msg.To(req.Email); err != nil {
		log.Printf("[password_reset] error setting to: %v", err)
		w.WriteHeader(http.StatusAccepted)
		return
	}
	msg.Subject(template.Subject)
	msg.SetBodyString(mail.TypeTextHTML, template.HTML)
	if err := email.SendEmail(context.Background(), msg, h.DB); err != nil {
		log.Printf("[password_reset] error sending email to %s: %v", req.Email, err)
	}
	log.Printf("[password_reset] token generated for user %d", userID)
	w.WriteHeader(http.StatusAccepted)
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if strings.TrimSpace(req.Token) == "" {
		h.Error(w, http.StatusBadRequest, "token is required")
		return
	}
	if len(req.NewPassword) < 8 {
		h.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	userID, err := email.ValidateResetToken(h.DB, req.Token)
	if err != nil {
		log.Printf("[password_reset] invalid token: %v", err)
		h.Error(w, http.StatusBadRequest, "invalid or expired token")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[password_reset] error hashing password: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	_, err = h.DB.Exec(
		"UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		string(hashedPassword), userID,
	)
	if err != nil {
		log.Printf("[password_reset] error updating password: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := email.MarkTokenUsed(h.DB, req.Token); err != nil {
		log.Printf("[password_reset] error marking token used: %v", err)
	}

	log.Printf("[password_reset] password reset for user %d", userID)
	h.JSON(w, http.StatusOK, map[string]string{"message": "password reset successful"})
}

func (h *Handler) ValidateResetToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := chi.URLParam(r, "token")
	if token == "" {
		h.Error(w, http.StatusBadRequest, "token is required")
		return
	}

	_, err := email.ValidateResetToken(h.DB, token)
	if err != nil {
		log.Printf("[password_reset] invalid token validation: %v", err)
		h.Error(w, http.StatusBadRequest, "invalid or expired token")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"valid": "true"})
}

func detectLanguageFromHeader(acceptLangHeader string) string {
	if acceptLangHeader == "" {
		return "en"
	}
	for _, lang := range strings.Split(acceptLangHeader, ",") {
		code := strings.TrimSpace(strings.Split(lang, ";")[0])
		if strings.HasPrefix(code, "es") {
			return "es"
		}
		if strings.HasPrefix(code, "en") {
			return "en"
		}
	}
	return "en"
}
