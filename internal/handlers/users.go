package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
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
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
			h.Error(w, http.StatusConflict, "email '"+req.Email+"' already exists")
			return
		}
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
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
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	h.auditLog(r, userID, 0, "create", "user", &id, nil, map[string]interface{}{
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
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	h.auditLog(r, currentUserID, 0, "update", "user", &id, map[string]interface{}{
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
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	h.auditLog(r, currentUserID, 0, "delete", "user", &id, map[string]interface{}{
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

	h.auditLog(r, h.getUserID(r), 0, "reset_password", "user", &id, nil, nil)

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

	h.auditLog(r, currentUserID, 0, "update_status", "user", &id, nil, map[string]interface{}{
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

// HandleUserProfile handles GET and PATCH /api/user/profile
func (h *Handler) HandleUserProfile(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)

	switch r.Method {
	case http.MethodGet:
		h.getUserProfile(w, userID)
	case http.MethodPatch:
		h.updateUserProfile(w, r, userID)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getUserProfile(w http.ResponseWriter, userID int) {
	var u models.User
	err := h.DB.QueryRow(`
		SELECT id, name, email, role, status, last_access, created_at, updated_at
		FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Status,
		&u.LastAccess, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, u)
}

type updateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

func (h *Handler) updateUserProfile(w http.ResponseWriter, r *http.Request, userID int) {
	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Name == "" {
		h.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Email == "" {
		h.Error(w, http.StatusBadRequest, "email is required")
		return
	}

	// Fetch previous state for audit
	var prevName, prevEmail string
	err := h.DB.QueryRow(`
		SELECT name, email FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&prevName, &prevEmail)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	// Check email uniqueness (excluding current user)
	var existingID int
	err = h.DB.QueryRow(`
		SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL
	`, req.Email, userID).Scan(&existingID)
	if err == nil {
		h.Error(w, http.StatusConflict, "email already exists")
		return
	}

	_, err = h.DB.Exec(`
		UPDATE users SET name=?, email=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, req.Name, req.Email, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	h.auditLog(r, userID, 0, "update_profile", "user", &userID, map[string]interface{}{
		"name":  prevName,
		"email": prevEmail,
	}, map[string]interface{}{
		"name":  req.Name,
		"email": req.Email,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// HandleChangePassword handles POST /api/user/change-password
func (h *Handler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)

	type changePasswordRequest struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.CurrentPassword == "" {
		h.Error(w, http.StatusBadRequest, "current_password is required")
		return
	}
	if req.NewPassword == "" {
		h.Error(w, http.StatusBadRequest, "new_password is required")
		return
	}
	if len(req.NewPassword) < 8 {
		h.Error(w, http.StatusBadRequest, "new_password must be at least 8 characters")
		return
	}

	// Get current password hash
	var passwordHash string
	err := h.DB.QueryRow(`
		SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&passwordHash)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	// Verify current password
	if !auth.CheckPassword(req.CurrentPassword, passwordHash) {
		h.Error(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	// Hash new password
	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	_, err = h.DB.Exec(`
		UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, hashedPassword, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	h.auditLog(r, userID, 0, "change_password", "user", &userID, nil, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "password changed"})
}

const (
	maxCertSize    int64 = 1024 * 1024 // 1MB
	certStorageDir       = "certificates"
)

// HandleCertificate handles POST /api/user/certificate and DELETE /api/user/certificate/{type}
func (h *Handler) HandleCertificate(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.uploadCertificate(w, r)
	case http.MethodDelete:
		h.deleteCertificate(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) uploadCertificate(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)

	if err := r.ParseMultipartForm(maxCertSize); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	certType := r.FormValue("type")
	if certType != "digital_signature" && certType != "public_cert" {
		h.Error(w, http.StatusBadRequest, "type must be 'digital_signature' or 'public_cert'")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		h.Error(w, http.StatusBadRequest, "no file uploaded")
		return
	}
	defer file.Close()

	// Validate file extension
	var allowedExts []string
	if certType == "digital_signature" {
		allowedExts = []string{".p12", ".pfx"}
	} else {
		allowedExts = []string{".cer", ".crt", ".pem", ".der"}
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := false
	for _, e := range allowedExts {
		if ext == e {
			allowed = true
			break
		}
	}
	if !allowed {
		h.Error(w, http.StatusBadRequest, "invalid file type")
		return
	}

	// Generate storage filename
	storageName, err := generateUUID()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate filename")
		return
	}
	storagePath := filepath.Join(h.DataDir, certStorageDir, strconv.Itoa(userID), certType)
	if err := os.MkdirAll(storagePath, 0755); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create storage directory")
		return
	}

	dstPath := filepath.Join(storagePath, storageName+ext)
	dst, err := os.Create(dstPath)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		os.Remove(dstPath)
		h.Error(w, http.StatusInternalServerError, "failed to save file")
		return
	}

	// Update database
	var urlField, keyField string
	if certType == "digital_signature" {
		urlField = "digital_signature_url"
		keyField = "digital_signature_key"
	} else {
		urlField = "public_cert_url"
		keyField = "public_cert_key"
	}

	// Delete old certificate if exists
	var oldURL *string
	h.DB.QueryRow("SELECT "+urlField+" FROM users WHERE id = ?", userID).Scan(&oldURL)
	if oldURL != nil && *oldURL != "" {
		os.Remove(filepath.Join(h.DataDir, certStorageDir, *oldURL))
	}

	relativePath := filepath.Join(strconv.Itoa(userID), certType, storageName+ext)
	_, err = h.DB.Exec(
		"UPDATE users SET "+urlField+"=?, "+keyField+"=?, updated_at=CURRENT_TIMESTAMP WHERE id = ?",
		relativePath, header.Filename, userID,
	)
	if err != nil {
		os.Remove(dstPath)
		h.Error(w, http.StatusInternalServerError, "failed to update certificate")
		return
	}

	h.auditLog(r, userID, 0, "upload_certificate", "user", &userID, nil, map[string]interface{}{
		"type":    certType,
		"filename": header.Filename,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "uploaded", "filename": header.Filename})
}

func (h *Handler) deleteCertificate(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)

	certType := chi.URLParam(r, "type")
	if certType != "digital_signature" && certType != "public_cert" {
		h.Error(w, http.StatusBadRequest, "type must be 'digital_signature' or 'public_cert'")
		return
	}

	var urlField, keyField string
	if certType == "digital_signature" {
		urlField = "digital_signature_url"
		keyField = "digital_signature_key"
	} else {
		urlField = "public_cert_url"
		keyField = "public_cert_key"
	}

	// Get current certificate path
	var certPath, certKey *string
	err := h.DB.QueryRow(
		"SELECT "+urlField+", "+keyField+" FROM users WHERE id = ?", userID,
	).Scan(&certPath, &certKey)
	if err != nil || certPath == nil || *certPath == "" {
		h.Error(w, http.StatusNotFound, "certificate not found")
		return
	}

	// Delete file
	filePath := filepath.Join(h.DataDir, certStorageDir, *certPath)
	os.Remove(filePath)

	// Clear database
	_, err = h.DB.Exec(
		"UPDATE users SET "+urlField+"=NULL, "+keyField+"=NULL, updated_at=CURRENT_TIMESTAMP WHERE id = ?",
		userID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete certificate")
		return
	}

	h.auditLog(r, userID, 0, "delete_certificate", "user", &userID, map[string]interface{}{
		"type": certType,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
