package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"github.com/PACTA-Team/pacta/internal/auth"
)

type SetupRequest struct {
	Admin    SetupAdmin    `json:"admin"`
	Client   SetupParty    `json:"client"`
	Supplier SetupParty    `json:"supplier"`
}

type SetupAdmin struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SetupParty struct {
	Name     string  `json:"name"`
	Address  *string `json:"address,omitempty"`
	REUCode  *string `json:"reu_code,omitempty"`
	Contacts *string `json:"contacts,omitempty"`
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (h *Handler) HandleSetupStatus(w http.ResponseWriter, r *http.Request) {
	var count int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&count)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check setup status")
		return
	}
	h.JSON(w, http.StatusOK, map[string]bool{"needs_setup": count == 0})
}

func (h *Handler) HandleSetup(w http.ResponseWriter, r *http.Request) {
	// Check if setup is already done
	var count int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&count)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check setup status")
		return
	}
	if count > 0 {
		h.Error(w, http.StatusForbidden, "setup has already been completed")
		return
	}

	var req SetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate admin
	if err := validateSetupAdmin(req.Admin); err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	// Validate client/supplier names
	if strings.TrimSpace(req.Client.Name) == "" {
		h.Error(w, http.StatusBadRequest, "client name is required")
		return
	}
	if strings.TrimSpace(req.Supplier.Name) == "" {
		h.Error(w, http.StatusBadRequest, "supplier name is required")
		return
	}

	// Begin transaction
	tx, err := h.DB.Begin()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	defer tx.Rollback()

	// Create admin user
	hash, err := auth.HashPassword(req.Admin.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminResult, err := tx.Exec(
		"INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
		req.Admin.Name, req.Admin.Email, hash,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			h.Error(w, http.StatusConflict, "a user with this email already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminID, _ := adminResult.LastInsertId()

	// Create client
	clientResult, err := tx.Exec(
		"INSERT INTO clients (name, address, reu_code, contacts, created_by) VALUES (?, ?, ?, ?, ?)",
		req.Client.Name, req.Client.Address, req.Client.REUCode, req.Client.Contacts, adminID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	clientID, _ := clientResult.LastInsertId()

	// Create supplier
	supplierResult, err := tx.Exec(
		"INSERT INTO suppliers (name, address, reu_code, contacts, created_by) VALUES (?, ?, ?, ?, ?)",
		req.Supplier.Name, req.Supplier.Address, req.Supplier.REUCode, req.Supplier.Contacts, adminID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	supplierID, _ := supplierResult.LastInsertId()

	// Commit
	if err := tx.Commit(); err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"status":      "setup_complete",
		"admin_id":    adminID,
		"client_id":   clientID,
		"supplier_id": supplierID,
	})
}

func validateSetupAdmin(a SetupAdmin) error {
	if strings.TrimSpace(a.Name) == "" {
		return &setupValidationError{"admin name is required"}
	}
	if !emailRegex.MatchString(a.Email) {
		return &setupValidationError{"please enter a valid email address"}
	}
	if len(a.Password) < 8 {
		return &setupValidationError{"password must be at least 8 characters"}
	}
	var hasUpper, hasNumber, hasSpecial bool
	for _, c := range a.Password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsNumber(c):
			hasNumber = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	if !hasUpper || !hasNumber || !hasSpecial {
		return &setupValidationError{"password must contain at least one uppercase letter, one number, and one special character"}
	}
	return nil
}

type setupValidationError struct {
	msg string
}

func (e *setupValidationError) Error() string {
	return e.msg
}
