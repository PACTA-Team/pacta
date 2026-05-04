package handlers

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/db"

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
	users, err := h.Queries.ListAllUsers(r.Context())
	if err != nil {
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	if users == nil {
		users = []db.User{}
	}
	h.JSON(w, http.StatusOK, users)
}

func (h *Handler) getUser(w http.ResponseWriter, id int) {
	user, err := h.Queries.GetUserByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, user)
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
	user, err := h.Queries.CreateUser(r.Context(), db.CreateUserParams{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         req.Role,
		Status:       "active",
		CompanyID:    0,
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
			h.Error(w, http.StatusConflict, "email '"+req.Email+"' already exists")
			return
		}
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	h.auditLog(r, userID, 0, "create", "user", &user.ID, nil, map[string]interface{}{
		"id":    user.ID,
		"name":  req.Name,
		"email": req.Email,
		"role":  req.Role,
	})

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":     user.ID,
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
	prevUser, err := h.Queries.GetUserByID(r.Context(), int64(id))
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

	_, err = h.Queries.UpdateUser(r.Context(), db.UpdateUserParams{
		Name:  req.Name,
		Email: req.Email,
		Role:  req.Role,
		ID:    int64(id),
	})
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
		"id":    id,
		"name":  prevUser.Name,
		"email": prevUser.Email,
		"role":  prevUser.Role,
	}, map[string]interface{}{
		"id":    id,
		"name":  req.Name,
		"email": req.Email,
		"role":  req.Role,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteUser(w http.ResponseWriter, r *http.Request, id int) {
	// Fetch previous state for audit
	prevUser, err := h.Queries.GetUserByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	currentUserID := h.getUserID(r)
	if currentUserID == id {
		h.Error(w, http.StatusBadRequest, "cannot delete your own account")
		return
	}

	_, err = h.Queries.DeleteUser(r.Context(), int64(id))
	if err != nil {
		log.Printf("[handlers/users] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	h.auditLog(r, currentUserID, 0, "delete", "user", &id, map[string]interface{}{
		"id":    id,
		"name":  prevUser.Name,
		"email": prevUser.Email,
		"role":  prevUser.Role,
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

	_, err = h.Queries.UpdateUserPassword(r.Context(), db.UpdateUserPasswordParams{
		PasswordHash: hashedPassword,
		ID:           int64(id),
	})
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

	_, err := h.Queries.UpdateUserStatus(r.Context(), db.UpdateUserStatusParams{
		Status: req.Status,
		ID:     int64(id),
	})
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
	rows, err := h.Queries.ListUserCompanies(r.Context(), int64(userID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list user companies")
		return
	}

	if rows == nil {
		rows = []db.ListUserCompaniesRow{}
	}

	h.JSON(w, http.StatusOK, rows)
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

	// Check user has access to this company
	exists, err := h.Queries.CheckUserCompanyAccess(r.Context(), db.CheckUserCompanyAccessParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
	if err != nil || exists == 0 {
		h.Error(w, http.StatusForbidden, "access denied to this company")
		return
	}

	cookie, err := r.Cookie("session")
	if err == nil {
		h.Queries.UpdateSessionCompany(r.Context(), db.UpdateSessionCompanyParams{
			CompanyID: int64(companyID),
			Token:      cookie.Value,
		})
	}

	h.Queries.ResetUserDefaultCompanies(r.Context(), int64(userID))
	h.Queries.SetDefaultCompany(r.Context(), db.SetDefaultCompanyParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})

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
	user, err := h.Queries.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, user)
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
	prevUser, err := h.Queries.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	// Check email uniqueness (excluding current user)
	existing, err := h.Queries.GetUserByEmail(r.Context(), req.Email)
	if err == nil && existing.ID != int64(userID) {
		h.Error(w, http.StatusConflict, "email already exists")
		return
	}

	_, err = h.Queries.UpdateUserProfile(r.Context(), db.UpdateUserProfileParams{
		Name:  req.Name,
		Email: req.Email,
		ID:    int64(userID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	h.auditLog(r, userID, 0, "update_profile", "user", &userID, map[string]interface{}{
		"name":  prevUser.Name,
		"email": prevUser.Email,
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
	user, err := h.Queries.GetUserForSignIn(r.Context(), userID)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	// Verify current password
	if !auth.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		h.Error(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	// Hash new password
	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	_, err = h.Queries.UpdateUserPassword(r.Context(), db.UpdateUserPasswordParams{
		PasswordHash: hashedPassword,
		ID:           user.ID,
	})
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

	// Delete old certificate if exists
	fields, err := h.Queries.GetUserAvatarAndCertFields(r.Context(), int64(userID))
	if err == nil {
		if fields.DigitalSignatureUrl != nil && *fields.DigitalSignatureUrl != "" {
			os.Remove(filepath.Join(h.DataDir, certStorageDir, *fields.DigitalSignatureUrl))
		}
		if fields.PublicCertUrl != nil && *fields.PublicCertUrl != "" {
			os.Remove(filepath.Join(h.DataDir, certStorageDir, *fields.PublicCertUrl))
		}
	}

	// Update database with new certificate path
	relativePath := filepath.Join(strconv.Itoa(userID), certType, storageName+ext)
	var digitalSigUrl, digitalSigKey, publicCertUrl, publicCertKey *string
	if certType == "digital_signature" {
		digitalSigUrl = &relativePath
		digitalSigKey = &header.Filename
	} else {
		publicCertUrl = &relativePath
		publicCertKey = &header.Filename
	}
	_, err = h.Queries.UpdateUserCertFields(r.Context(), db.UpdateUserCertFieldsParams{
		ID:                 int64(userID),
		DigitalSignatureUrl: digitalSigUrl,
		DigitalSignatureKey: digitalSigKey,
		PublicCertUrl:       publicCertUrl,
		PublicCertKey:       publicCertKey,
	})
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

	// Get current certificate path
	fields, err := h.Queries.GetUserAvatarAndCertFields(r.Context(), int64(userID))
	if err != nil || (certType == "digital_signature" && (fields.DigitalSignatureUrl == nil || *fields.DigitalSignatureUrl == "")) ||
		(certType == "public_cert" && (fields.PublicCertUrl == nil || *fields.PublicCertUrl == "")) {
		h.Error(w, http.StatusNotFound, "certificate not found")
		return
	}

	// Delete file
	var filePath string
	if certType == "digital_signature" && fields.DigitalSignatureUrl != nil {
		filePath = filepath.Join(h.DataDir, certStorageDir, *fields.DigitalSignatureUrl)
	} else if fields.PublicCertUrl != nil {
		filePath = filepath.Join(h.DataDir, certStorageDir, *fields.PublicCertUrl)
	}
	os.Remove(filePath)

	// Clear database fields
	var digitalSigUrl, digitalSigKey, publicCertUrl, publicCertKey *string
	if certType == "digital_signature" {
		digitalSigUrl = nil
		digitalSigKey = nil
		publicCertUrl = fields.PublicCertUrl
		publicCertKey = fields.PublicCertKey
	} else {
		digitalSigUrl = fields.DigitalSignatureUrl
		digitalSigKey = fields.DigitalSignatureKey
		publicCertUrl = nil
		publicCertKey = nil
	}
	_, err = h.Queries.UpdateUserCertFields(r.Context(), db.UpdateUserCertFieldsParams{
		ID:                 int64(userID),
		DigitalSignatureUrl: digitalSigUrl,
		DigitalSignatureKey: digitalSigKey,
		PublicCertUrl:       publicCertUrl,
		PublicCertKey:       publicCertKey,
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete certificate")
		return
	}

	h.auditLog(r, userID, 0, "delete_certificate", "user", &userID, map[string]interface{}{
		"type": certType,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
