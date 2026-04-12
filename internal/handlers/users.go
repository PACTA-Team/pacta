package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/models"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) HandleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listUsers(w, r)
	case http.MethodPost:
		h.createUser(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) HandleUserByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/users/")
	idStr = strings.TrimSuffix(idStr, "/reset-password")
	idStr = strings.TrimSuffix(idStr, "/status")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getUser(w, id)
	case http.MethodPut:
		h.updateUser(w, r, id)
	case http.MethodDelete:
		h.deleteUser(w, r, id)
	case http.MethodPatch:
		if strings.HasSuffix(r.URL.Path, "/reset-password") {
			h.resetPassword(w, r, id)
		} else if strings.HasSuffix(r.URL.Path, "/status") {
			h.updateUserStatus(w, r, id)
		} else {
			h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, name, email, role, status, last_access, created_at, updated_at
		FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC
	`)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Status,
			&u.LastAccess, &u.CreatedAt, &u.UpdatedAt); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list users")
			return
		}
		users = append(users, u)
	}
	if users == nil {
		users = []models.User{}
	}
	h.JSON(w, http.StatusOK, users)
}

func (h *Handler) getUser(w http.ResponseWriter, id int) {
	var u models.User
	err := h.DB.QueryRow(`
		SELECT id, name, email, role, status, last_access, created_at, updated_at
		FROM users WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Status,
		&u.LastAccess, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, u)
}

type createUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Name == "" || req.Email == "" || req.Password == "" {
		h.Error(w, http.StatusBadRequest, "name, email, and password are required")
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	if req.Role != "admin" && req.Role != "manager" && req.Role != "editor" && req.Role != "viewer" {
		h.Error(w, http.StatusBadRequest, "role must be 'admin', 'manager', 'editor', or 'viewer'")
		return
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(`
		INSERT INTO users (name, email, password_hash, role, status)
		VALUES (?, ?, ?, ?, 'active')
	`, req.Name, req.Email, hashedPassword, req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
			h.Error(w, http.StatusConflict, "email '"+req.Email+"' already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	h.auditLog(r, userID, "create", "user", &id, nil, map[string]interface{}{
		"id":    id,
		"name":  req.Name,
		"email": req.Email,
		"role":  req.Role,
	})

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":     id,
		"name":   req.Name,
		"email":  req.Email,
		"role":   req.Role,
		"status": "created",
	})
}

type updateUserRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request, id int) {
	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Role != "" && req.Role != "admin" && req.Role != "manager" && req.Role != "editor" && req.Role != "viewer" {
		h.Error(w, http.StatusBadRequest, "role must be 'admin', 'manager', 'editor', or 'viewer'")
		return
	}

	// Fetch previous state
	var prevName, prevEmail, prevRole string
	err := h.DB.QueryRow(`
		SELECT name, email, role FROM users WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&prevName, &prevEmail, &prevRole)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	// Prevent self-demotion from admin
	currentUserID := h.getUserID(r)
	if currentUserID == id && req.Role != "" && req.Role != "admin" {
		h.Error(w, http.StatusBadRequest, "cannot change your own admin role")
		return
	}

	_, err = h.DB.Exec(`
		UPDATE users SET name=?, email=?, role=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, req.Name, req.Email, req.Role, id)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
			h.Error(w, http.StatusConflict, "email '"+req.Email+"' already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	h.auditLog(r, currentUserID, "update", "user", &id, map[string]interface{}{
		"name":  prevName,
		"email": prevEmail,
		"role":  prevRole,
	}, map[string]interface{}{
		"name":  req.Name,
		"email": req.Email,
		"role":  req.Role,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteUser(w http.ResponseWriter, r *http.Request, id int) {
	var prevName, prevEmail, prevRole string
	err := h.DB.QueryRow("SELECT name, email, role FROM users WHERE id = ? AND deleted_at IS NULL", id).Scan(&prevName, &prevEmail, &prevRole)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	currentUserID := h.getUserID(r)
	if currentUserID == id {
		h.Error(w, http.StatusBadRequest, "cannot delete your own account")
		return
	}

	_, err = h.DB.Exec("UPDATE users SET deleted_at=CURRENT_TIMESTAMP WHERE id=?", id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete user")
		return
	}

	h.auditLog(r, currentUserID, "delete", "user", &id, map[string]interface{}{
		"id":    id,
		"name":  prevName,
		"email": prevEmail,
		"role":  prevRole,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type resetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request, id int) {
	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.NewPassword == "" {
		h.Error(w, http.StatusBadRequest, "new_password is required")
		return
	}

	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	_, err = h.DB.Exec("UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL", hashedPassword, id)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	h.auditLog(r, h.getUserID(r), "reset_password", "user", &id, nil, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "password reset"})
}

type updateUserStatusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) updateUserStatus(w http.ResponseWriter, r *http.Request, id int) {
	var req updateUserStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Status != "active" && req.Status != "inactive" && req.Status != "locked" {
		h.Error(w, http.StatusBadRequest, "status must be 'active', 'inactive', or 'locked'")
		return
	}

	currentUserID := h.getUserID(r)
	if currentUserID == id && req.Status != "active" {
		h.Error(w, http.StatusBadRequest, "cannot change your own status")
		return
	}

	_, err := h.DB.Exec("UPDATE users SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL", req.Status, id)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	h.auditLog(r, currentUserID, "update_status", "user", &id, nil, map[string]interface{}{
		"id":     id,
		"status": req.Status,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) HandleUserCompanies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	rows, err := h.DB.Query(`
		SELECT uc.user_id, uc.company_id, c.name, uc.is_default
		FROM user_companies uc
		JOIN companies c ON c.id = uc.company_id
		WHERE uc.user_id = ? AND c.deleted_at IS NULL
		ORDER BY uc.is_default DESC, c.name
	`, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list user companies")
		return
	}
	defer rows.Close()

	var companies []models.UserCompany
	for rows.Next() {
		var uc models.UserCompany
		rows.Scan(&uc.UserID, &uc.CompanyID, &uc.CompanyName, &uc.IsDefault)
		companies = append(companies, uc)
	}
	if companies == nil {
		companies = []models.UserCompany{}
	}

	h.JSON(w, http.StatusOK, companies)
}

func (h *Handler) HandleSwitchCompany(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	idStr := chi.URLParam(r, "id")
	companyID, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid company ID")
		return
	}

	var exists int
	h.DB.QueryRow("SELECT COUNT(*) FROM user_companies WHERE user_id = ? AND company_id = ?", userID, companyID).Scan(&exists)
	if exists == 0 {
		h.Error(w, http.StatusForbidden, "access denied to this company")
		return
	}

	cookie, err := r.Cookie("session")
	if err == nil {
		h.DB.Exec("UPDATE sessions SET company_id = ? WHERE token = ?", companyID, cookie.Value)
	}

	h.DB.Exec("UPDATE user_companies SET is_default = 0 WHERE user_id = ?", userID)
	h.DB.Exec("UPDATE user_companies SET is_default = 1 WHERE user_id = ? AND company_id = ?", userID, companyID)

	h.JSON(w, http.StatusOK, map[string]interface{}{"company_id": companyID})
}
