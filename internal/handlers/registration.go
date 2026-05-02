package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/db"
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
	user, err := h.Queries.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("[handlers/registration] ERROR: user lookup failed for %s: %v", req.Email, err)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}
	userID = int(user.ID)
	status = user.Status

	if status != "pending_email" {
		log.Printf("[handlers/registration] ERROR: user %d status not pending: %s", userID, status)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	var codeHash string
	var expiresAt time.Time
	var attempts int
	code, err := h.Queries.GetLatestRegistrationCodeForUser(r.Context(), userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "verification failed")
		return
	}
	codeHash = code.CodeHash
	expiresAt = code.ExpiresAt
	attempts = code.Attempts

	if time.Now().After(expiresAt) {
		log.Printf("[handlers/registration] ERROR: verification code expired for user %d", userID)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	var attempts int
	row := h.Queries.GetLatestRegistrationCodeForUser(r.Context(), userID)
	attempts = row.Attempts
	if attempts >= 5 {
		log.Printf("[handlers/registration] ERROR: too many attempts for user %d", userID)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	if !auth.CheckPassword(req.Code, codeHash) {
		h.Queries.IncrementRegistrationAttempts(r.Context(), userID)
		log.Printf("[handlers/registration] ERROR: invalid verification code for user %d", userID)
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid verification code or account not approved.")
		return
	}

	err = h.Queries.UpdateUserStatus(r.Context(), db.UpdateUserStatusParams{
		Status: "active",
		ID:     userID,
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "verification failed")
		return
	}

	var companyID int
	company, err := h.Queries.GetCompanyByID(r.Context(), 1)
	if err != nil {
		_, err = h.Queries.CreateCompany(r.Context(), db.CreateCompanyParams{
			Name:      "Default Company",
			CompanyType: "client",
			CreatedBy:  0,
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create company")
			return
		}
		companyID = int(company.ID)
	} else {
		companyID = int(company.ID)
	}

	h.Queries.CreateUserCompany(r.Context(), db.CreateUserCompanyParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
		IsDefault:  true,
	})

	session, err := auth.CreateSession(h.Queries, userID, companyID)
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

func sendAdminNotifications(ctx context.Context, queries *db.Queries, userName, userEmail, companyName, lang string) error {
	rows, err := queries.ListAdminEmails(ctx)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var adminEmail string
		if err := rows.Scan(&adminEmail); err != nil {
			continue
		}
		email.SendAdminNotification(ctx, adminEmail, userName, userEmail, companyName, lang, queries)
	}
	return nil
}
