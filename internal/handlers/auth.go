package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/email"
	"github.com/PACTA-Team/pacta/internal/models"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Mode        string `json:"mode"`
	CompanyName string `json:"company_name"`
	CompanyID   *int   `json:"company_id,omitempty"`
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

	// Check if email already exists
	var existing int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = ? AND deleted_at IS NULL", req.Email).Scan(&existing)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check email")
		return
	}
	if existing > 0 {
		h.Error(w, http.StatusConflict, "a user with this email already exists")
		return
	}

	// Determine role: first user gets admin, others get viewer
	var userCount int
	err = h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&userCount)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to determine role")
		return
	}

	role := "viewer"
	status := "active"
	if userCount == 0 {
		role = "admin"
	} else {
		if req.Mode == "email" {
			status = "pending_email"
		} else if req.Mode == "approval" {
			status = "pending_approval"
		}
	}

	// Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to process registration")
		return
	}

	// Insert user
	result, err := h.DB.Exec(
		"INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
		req.Name, req.Email, hash, role, status,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			h.Error(w, http.StatusConflict, "a user with this email already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	userID, _ := result.LastInsertId()

	if userCount > 0 {
		if req.Mode == "email" && email.IsEnabled() {
			code, err := generateCode()
			if err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to generate code")
				return
			}
			codeHash, _ := auth.HashPassword(code)
			h.DB.Exec(
				"INSERT INTO registration_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
				userID, codeHash, time.Now().Add(5*time.Minute),
			)

			ctx := context.Background()
			email.SendVerificationCode(ctx, req.Email, code)

			h.JSON(w, http.StatusCreated, map[string]interface{}{
				"id":     userID,
				"name":   req.Name,
				"email":  req.Email,
				"role":   role,
				"status": "pending_email",
			})
			return
		}

		if req.Mode == "approval" {
			companyName := req.CompanyName
			if req.CompanyID != nil && *req.CompanyID > 0 {
				var existingName string
				err := h.DB.QueryRow("SELECT name FROM companies WHERE id = ? AND deleted_at IS NULL", *req.CompanyID).Scan(&existingName)
				if err == nil {
					companyName = existingName
				}
			}
			h.DB.Exec(
				"INSERT INTO pending_approvals (user_id, company_name, company_id, requested_role) VALUES (?, ?, ?, ?)",
				userID, companyName, req.CompanyID, "viewer",
			)

			ctx := context.Background()
			sendAdminNotifications(ctx, h.DB, req.Name, req.Email, companyName)

			h.JSON(w, http.StatusCreated, map[string]interface{}{
				"id":     userID,
				"name":   req.Name,
				"email":  req.Email,
				"role":   role,
				"status": "pending_approval",
			})
			return
		}
	}

	// First user or active user: auto-login with company assignment
	var companyID int
	err = h.DB.QueryRow("SELECT id FROM companies LIMIT 1").Scan(&companyID)
	if err != nil && err != sql.ErrNoRows {
		h.Error(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	session, err := auth.CreateSession(h.DB, int(userID), companyID)
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

	var u models.User
	err = h.DB.QueryRow(`
		SELECT id, name, email, role, status, created_at, updated_at
		FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to retrieve created user")
		return
	}

	h.JSON(w, http.StatusCreated, sanitizeUser(&u))
}

func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := auth.Authenticate(h.DB, req.Email, req.Password)
	if err != nil {
		h.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	if user.Status == "pending_email" {
		h.Error(w, http.StatusForbidden, "please verify your email first. Check your inbox for the verification code.")
		return
	}
	if user.Status == "pending_approval" {
		h.Error(w, http.StatusForbidden, "your account is pending admin approval. You will be notified once approved.")
		return
	}

	if user.Status != "active" {
		h.Error(w, http.StatusForbidden, "account is "+user.Status)
		return
	}

	// Resolve user's default company
	var companyID int
	err = h.DB.QueryRow(`
		SELECT company_id FROM user_companies
		WHERE user_id = ? AND is_default = 1
	`, user.ID).Scan(&companyID)
	if err == sql.ErrNoRows {
		err = h.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", user.ID).Scan(&companyID)
	}
	if err != nil {
		h.Error(w, http.StatusForbidden, "no company assigned. Contact administrator.")
		return
	}

	session, err := auth.CreateSession(h.DB, user.ID, companyID)
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

	h.JSON(w, http.StatusOK, sanitizeUser(user))
}

func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session")
	if err == nil {
		auth.DeleteSession(h.DB, cookie.Value)
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
	var u models.User
	err := h.DB.QueryRow(`
		SELECT id, name, email, role, status, created_at, updated_at
		FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, u)
}

func sanitizeUser(u *models.User) map[string]interface{} {
	return map[string]interface{}{
		"id":    u.ID,
		"name":  u.Name,
		"email": u.Email,
		"role":  u.Role,
	}
}
