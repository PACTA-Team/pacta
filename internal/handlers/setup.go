package handlers

import (
	"encoding/json"
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
