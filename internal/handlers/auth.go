package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/db"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Name             string `json:"name"`
	Email           string `json:"email"`
	Password       string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
	Language       string `json:"language"`
}

func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		h.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if strings.TrimSpace(req.Email) == "" {
		h.Error(w, http.StatusBadRequest, "email is required")
		return
	}
	if len(req.Password) < 8 {
		h.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if req.Password != req.ConfirmPassword {
		h.Error(w, http.StatusBadRequest, "passwords do not match")
		return
	}

	// Check if email already exists
	existing, err := h.Queries.UserExists(r.Context(), req.Email)
	if err != nil {
		log.Printf("[register] ERROR checking email existence: %v", err)
		h.Error(w, http.StatusInternalServerError, "failed to check email")
		return
	}
	if existing > 0 {
		h.Error(w, http.StatusConflict, "If this email is not yet registered, please proceed with registration.")
		return
	}

	// Determine role: first user gets admin, others get viewer
	userCount, err := h.Queries.CountAllUsers(r.Context())
	if err != nil {
		log.Printf("[register] ERROR determining role (userCount): %v", err)
		h.Error(w, http.StatusInternalServerError, "failed to determine role")
		return
	}

	role := "viewer"
	status := "pending_approval"
	if userCount == 0 {
		role = "admin"
	}

	// Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("[register] ERROR hashing password: %v", err)
		h.Error(w, http.StatusInternalServerError, "failed to process registration")
		return
	}

	// Insert user
	user, err := h.Queries.CreateUser(r.Context(), db.CreateUserParams{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         role,
		Status:       status,
		CompanyID:    0,
	})
	if err != nil {
		log.Printf("[register] ERROR inserting user: %v", err)
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			h.Error(w, http.StatusConflict, "If this email is not yet registered, please proceed with registration.")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	// Create pending approval entry for admin review (company_name left empty since removed from registration)
	_, err = h.Queries.CreatePendingApproval(r.Context(), db.CreatePendingApprovalParams{
		UserID:     user.ID,
		CompanyName: "",
		Status:      "pending",
	})
	if err != nil {
		log.Printf("[register] ERROR inserting pending approval: %v", err)
		// Continue - user was created, just log the error
	}

	// Return pending response without creating session
	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":      user.ID,
		"name":    req.Name,
		"email":   req.Email,
		"status":  "pending_approval",
		"message": "Your account is pending admin approval. You will be notified once approved.",
	})
}

func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := auth.Authenticate(h.Queries, req.Email, req.Password)
	if err != nil {
		// Constant-time response to prevent user enumeration
		time.Sleep(50 * time.Millisecond)
		h.Error(w, http.StatusUnauthorized, "Invalid credentials or account not yet approved.")
		return
	}

	if user.Status == "pending_email" {
		h.Error(w, http.StatusForbidden, "please verify your email first. Check your inbox for the verification code.")
		return
	}

	// Check if user needs setup (pending_approval or pending_activation means no setup completed)
	if user.Status == "pending_approval" || user.Status == "pending_activation" {
		// Create session with company_id = 0 (no company yet)
		session, err := auth.CreateSession(h.Queries, user.ID, 0)
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

		h.JSON(w, http.StatusOK, map[string]interface{}{
			"user":        sanitizeUser(user),
			"needs_setup": true,
			"setup_status": user.Status,
		})
		return
	}

	if user.Status != "active" {
		// Constant-time for non-active status to prevent enumeration via status differences
		time.Sleep(30 * time.Millisecond)
		h.Error(w, http.StatusForbidden, "Invalid credentials or account not yet approved.")
		return
	}

	// Resolve user's default company
	companyID, err := h.Queries.GetUserCompanyID(r.Context(), user.ID)
	if err != nil {
		// Fallback to user's company_id from users table
		companyID = user.CompanyID
	}
	if companyID == 0 {
		h.Error(w, http.StatusForbidden, "no company assigned. Contact administrator.")
		return
	}

	session, err := auth.CreateSession(h.Queries, user.ID, int(companyID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	h.InsertAuditLog(user.ID, "LOGIN", "session", nil, nil, nil, r)

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	h.JSON(w, http.StatusOK, sanitizeUser(user))
}

func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session")
	if err == nil {
		auth.DeleteSession(h.Queries, cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		MaxAge:   -1,
	})
	h.JSON(w, http.StatusOK, map[string]string{"status": "logged out"})
}

func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	user, err := h.Queries.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		h.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, map[string]interface{}{
		"id":         user.ID,
		"name":       user.Name,
		"email":      user.Email,
		"role":       user.Role,
		"status":     user.Status,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
	})
}

func sanitizeUser(u *db.User) map[string]interface{} {
	return map[string]interface{}{
		"id":    u.ID,
		"name":  u.Name,
		"email": u.Email,
		"role":  u.Role,
	}
}

func detectLanguage(reqLang string, acceptLangHeader string) string {
	if reqLang != "" {
		if reqLang == "es" || reqLang == "en" {
			return reqLang
		}
	}
	if acceptLangHeader != "" {
		for _, lang := range strings.Split(acceptLangHeader, ",") {
			code := strings.TrimSpace(strings.Split(lang, ";")[0])
			if strings.HasPrefix(code, "es") {
				return "es"
			}
			if strings.HasPrefix(code, "en") {
				return "en"
			}
		}
	}
	return "en"
}
