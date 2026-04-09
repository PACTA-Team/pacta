package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/models"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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

	session, err := auth.CreateSession(h.DB, user.ID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
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
