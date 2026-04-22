package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"github.com/PACTA-Team/pacta/internal/auth"
)

type SetupRequest struct {
	CompanyMode  string            `json:"company_mode"` // "single" or "multi"
	Admin        SetupAdmin        `json:"admin"`
	Company      SetupCompany      `json:"company"`
	Client       SetupParty        `json:"client"`
	Supplier     SetupParty        `json:"supplier"`
	Subsidiaries []SetupSubsidiary `json:"subsidiaries,omitempty"`
}

type SetupCompany struct {
	Name    string  `json:"name"`
	Address *string `json:"address,omitempty"`
	TaxID   *string `json:"tax_id,omitempty"`
}

type SetupSubsidiary struct {
	Name     string     `json:"name"`
	Address  *string    `json:"address,omitempty"`
	TaxID    *string    `json:"tax_id,omitempty"`
	Client   SetupParty `json:"client"`
	Supplier SetupParty `json:"supplier"`
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

	// Validate company mode
	if req.CompanyMode != "single" && req.CompanyMode != "multi" {
		h.Error(w, http.StatusBadRequest, "company_mode must be 'single' or 'multi'")
		return
	}

	// Validate admin
	if err := validateSetupAdmin(req.Admin); err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	// Validate company name
	if strings.TrimSpace(req.Company.Name) == "" {
		h.Error(w, http.StatusBadRequest, "company name is required")
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

	// Determine company type
	companyType := "single"
	if req.CompanyMode == "multi" {
		companyType = "parent"
	}

	// Create parent/single company
	companyResult, err := tx.Exec(
		"INSERT INTO companies (name, address, tax_id, company_type) VALUES (?, ?, ?, ?)",
		req.Company.Name, req.Company.Address, req.Company.TaxID, companyType,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	companyID, _ := companyResult.LastInsertId()

	// Create admin user
	hash, err := auth.HashPassword(req.Admin.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminResult, err := tx.Exec(
		"INSERT INTO users (name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)",
		req.Admin.Name, req.Admin.Email, hash, companyID,
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

	// Link admin to company
	_, err = tx.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", adminID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	// Create default client
	clientResult, err := tx.Exec(
		"INSERT INTO clients (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		req.Client.Name, req.Client.Address, req.Client.REUCode, req.Client.Contacts, adminID, companyID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	_ = clientResult

	// Create default supplier
	supplierResult, err := tx.Exec(
		"INSERT INTO suppliers (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		req.Supplier.Name, req.Supplier.Address, req.Supplier.REUCode, req.Supplier.Contacts, adminID, companyID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	_ = supplierResult

	// Create subsidiaries if provided
	for _, sub := range req.Subsidiaries {
		if strings.TrimSpace(sub.Name) == "" {
			continue
		}

		subResult, err := tx.Exec(
			"INSERT INTO companies (name, address, tax_id, company_type, parent_id) VALUES (?, ?, ?, 'subsidiary', ?)",
			sub.Name, sub.Address, sub.TaxID, companyID,
		)
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
			return
		}
		subID, _ := subResult.LastInsertId()

		// Create subsidiary's default client
		if strings.TrimSpace(sub.Client.Name) != "" {
			tx.Exec(
				"INSERT INTO clients (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
				sub.Client.Name, sub.Client.Address, sub.Client.REUCode, sub.Client.Contacts, adminID, subID,
			)
		}

		// Create subsidiary's default supplier
		if strings.TrimSpace(sub.Supplier.Name) != "" {
			tx.Exec(
				"INSERT INTO suppliers (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
				sub.Supplier.Name, sub.Supplier.Address, sub.Supplier.REUCode, sub.Supplier.Contacts, adminID, subID,
			)
		}
	}

	if err := tx.Commit(); err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"status":     "setup_complete",
		"company_id": companyID,
		"admin_id":   adminID,
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

// UserSetupRequest represents the request body for user setup configuration
type UserSetupRequest struct {
	CompanyID         *int                  `json:"company_id,omitempty"`
	CompanyName       string                `json:"company_name"`
	CompanyAddress    string                `json:"company_address"`
	CompanyTaxID      string                `json:"company_tax_id"`
	CompanyPhone      string                `json:"company_phone"`
	CompanyEmail      string                `json:"company_email"`
	RoleAtCompany     string                `json:"role_at_company"`
	FirstSupplierID   *int                  `json:"first_supplier_id,omitempty"`
	FirstClientID    *int                  `json:"first_client_id,omitempty"`
	AuthorizedSigners []AuthorizedSigner    `json:"authorized_signers"`
}

// AuthorizedSigner represents an authorized signer for a company
type AuthorizedSigner struct {
	Name     string `json:"name"`
	Position string `json:"position"`
	Email    string `json:"email"`
}

// HandleUserSetup handles PATCH /api/setup for user company configuration
func (h *Handler) HandleUserSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	if userID == 0 {
		h.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Check if user already completed setup
	var existingCompanyID *int
	err := h.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", userID).Scan(&existingCompanyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check user status")
		return
	}
	if existingCompanyID != nil && *existingCompanyID > 0 {
		h.Error(w, http.StatusConflict, "setup already completed")
		return
	}

	var req UserSetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate role
	validRoles := map[string]bool{"manager": true, "editor": true, "viewer": true}
	if req.RoleAtCompany == "" {
		req.RoleAtCompany = "viewer"
	}
	if !validRoles[req.RoleAtCompany] {
		h.Error(w, http.StatusBadRequest, "invalid role. Must be manager, editor, or viewer")
		return
	}

	// Create or get company
	companyID := req.CompanyID

	// Handle both creating new company and using existing
	if companyID == nil || *companyID == 0 {
		// Creating new company
		if strings.TrimSpace(req.CompanyName) == "" {
			h.Error(w, http.StatusBadRequest, "company name is required when creating new company")
			return
		}

		result, err := h.DB.Exec(
			"INSERT INTO companies (name, address, tax_id, phone, email, company_type) VALUES (?, ?, ?, ?, ?, 'single')",
			req.CompanyName, req.CompanyAddress, req.CompanyTaxID, req.CompanyPhone, req.CompanyEmail,
		)
		if err != nil {
			log.Printf("[user-setup] ERROR creating company: %v", err)
			h.Error(w, http.StatusInternalServerError, "failed to create company")
			return
		}

		id, _ := result.LastInsertId()
		companyID = &id
	} else {
		// Verify company exists
		var count int
		err := h.DB.QueryRow("SELECT COUNT(*) FROM companies WHERE id = ? AND deleted_at IS NULL", *companyID).Scan(&count)
		if err != nil || count == 0 {
			h.Error(w, http.StatusNotFound, "company not found")
			return
		}
	}

	// Update user with company, role
	_, err = h.DB.Exec(
		"UPDATE users SET company_id = ?, role = ?, setup_completed = 1, status = 'pending_activation', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		companyID, req.RoleAtCompany, userID,
	)
	if err != nil {
		log.Printf("[user-setup] ERROR updating user: %v", err)
		h.Error(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	// Link user to company
	h.DB.Exec(
		"INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)",
		userID, *companyID,
	)

	// Insert authorized signers
	for _, signer := range req.AuthorizedSigners {
		if strings.TrimSpace(signer.Name) != "" {
			h.DB.Exec(
				"INSERT INTO authorized_signers (company_id, name, position, email) VALUES (?, ?, ?, ?)",
				companyID, signer.Name, signer.Position, signer.Email,
			)
		}
	}

	// Always record in pending_activations when user completes setup (unconditional)
	h.DB.Exec(`
		INSERT INTO pending_activations (user_id, company_id, company_name, role_at_company, status) 
		VALUES (?, ?, ?, ?, 'pending_activation')`,
		userID, companyID, req.CompanyName, req.RoleAtCompany,
	)

	// Send setup completion notification to admins
	go sendSetupCompletedNotification(userID, req.CompanyName)

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"success":    true,
		"message":  "Setup completed. Your account is pending activation.",
		"company": map[string]interface{}{
			"id": *companyID,
		},
	})
}

// sendSetupCompletedNotification sends notification to admins about new user setup
func sendSetupCompletedNotification(userID int, companyName string) {
	// This would send email to admins - implementation depends on email service
	log.Printf("[setup] User %d completed setup for company %s", userID, companyName)
}
