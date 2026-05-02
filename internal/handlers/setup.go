package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/db"
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
	count, err := h.Queries.CountAllUsers(r.Context())
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check setup status")
		return
	}
	h.JSON(w, http.StatusOK, map[string]bool{"needs_setup": count == 0})
}

func (h *Handler) HandleSetup(w http.ResponseWriter, r *http.Request) {
	count, err := h.Queries.CountAllUsers(r.Context())
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
		log.Printf("[handlers/setup] ERROR: %v", err)
		h.Error(w, http.StatusBadRequest, "invalid request")
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

	// Determine company type
	companyType := "single"
	if req.CompanyMode == "multi" {
		companyType = "parent"
	}

	// Create parent/single company
	company, err := h.Queries.CreateCompany(r.Context(), db.CreateCompanyParams{
		Name:      req.Company.Name,
		Address:   req.Company.Address,
		TaxID:    req.Company.TaxID,
		CompanyType: companyType,
		CreatedBy: 0, // No user yet
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	companyID := int(company.ID)

	// Create admin user
	hash, err := auth.HashPassword(req.Admin.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	admin, err := h.Queries.CreateUser(r.Context(), db.CreateUserParams{
		Name:        req.Admin.Name,
		Email:       req.Admin.Email,
		PasswordHash: hash,
		Role:        "admin",
		Status:      "active",
		CompanyID:   int64(companyID),
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			h.Error(w, http.StatusConflict, "a user with this email already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminID := int(admin.ID)

	// Link admin to company
	_ = h.Queries.CreateUserCompany(r.Context(), db.CreateUserCompanyParams{
		UserID:    int64(adminID),
		CompanyID: int64(companyID),
		IsDefault:  true,
	})

	// Create default client
	_, err = h.Queries.CreateClient(r.Context(), db.CreateClientParams{
		Name:      req.Client.Name,
		Address:   req.Client.Address,
		REUCode:  req.Client.REUCode,
		Contacts:  req.Client.Contacts,
		CreatedBy: int64(adminID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	// Create default supplier
	_, err = h.Queries.CreateSupplier(r.Context(), db.CreateSupplierParams{
		Name:      req.Supplier.Name,
		Address:   req.Supplier.Address,
		REUCode:  req.Supplier.REUCode,
		Contacts:  req.Supplier.Contacts,
		CreatedBy: int64(adminID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	// Create subsidiaries if provided
	for _, sub := range req.Subsidiaries {
		if strings.TrimSpace(sub.Name) == "" {
			continue
		}

		subCompany, err := h.Queries.CreateCompany(r.Context(), db.CreateCompanyParams{
			Name:       sub.Name,
			Address:    sub.Address,
			TaxID:     sub.TaxID,
			CompanyType: "subsidiary",
			ParentID:   sql.NullInt64{Int64: int64(companyID), Valid: true},
			CreatedBy:  int64(adminID),
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
			return
		}
		subID := int(subCompany.ID)

		// Create subsidiary's default client
		if strings.TrimSpace(sub.Client.Name) != "" {
			h.Queries.CreateClient(r.Context(), db.CreateClientParams{
				Name:      sub.Client.Name,
				Address:   sub.Client.Address,
				REUCode:  sub.Client.REUCode,
				Contacts:  sub.Client.Contacts,
				CreatedBy: int64(adminID),
				CompanyID: int64(subID),
			})
		}

		// Create subsidiary's default supplier
		if strings.TrimSpace(sub.Supplier.Name) != "" {
			h.Queries.CreateSupplier(r.Context(), db.CreateSupplierParams{
				Name:      sub.Supplier.Name,
				Address:   sub.Supplier.Address,
				REUCode:  sub.Supplier.REUCode,
				Contacts:  sub.Supplier.Contacts,
				CreatedBy: int64(adminID),
				CompanyID: int64(subID),
			})
		}
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
	user, err := h.Queries.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check user status")
		return
	}
	if user.CompanyID.Valid && user.CompanyID.Int64 > 0 {
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

		company, err := h.Queries.CreateCompany(r.Context(), db.CreateCompanyParams{
			Name:       req.CompanyName,
			Address:    req.CompanyAddress,
			TaxID:     req.CompanyTaxID,
			CompanyType: "single",
			CreatedBy:  int64(userID),
		})
		if err != nil {
			log.Printf("[user-setup] ERROR creating company: %v", err)
			h.Error(w, http.StatusInternalServerError, "failed to create company")
			return
		}
		idInt := int(company.ID)
		companyID = &idInt
	} else {
		// Verify company exists
		count, err := h.Queries.CompanyExists(r.Context(), *companyID)
		if err != nil || count == 0 {
			h.Error(w, http.StatusNotFound, "company not found")
			return
		}
	}

	// Update user with company, role
	err = h.Queries.UpdateUser(r.Context(), db.UpdateUserParams{
		Name:      user.Name,
		Email:     user.Email,
		Role:      req.RoleAtCompany,
		Status:    "pending_activation",
		CompanyID: sql.NullInt64{Int64: int64(*companyID), Valid: true},
		ID:        int64(userID),
	})
	if err != nil {
		log.Printf("[user-setup] ERROR updating user: %v", err)
		h.Error(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	// Link user to company
	h.Queries.CreateUserCompany(r.Context(), db.CreateUserCompanyParams{
		UserID:    int64(userID),
		CompanyID: int64(*companyID),
		IsDefault:  true,
	})

	// Insert authorized signers
	for _, signer := range req.AuthorizedSigners {
		if strings.TrimSpace(signer.Name) != "" {
			h.Queries.CreateSigner(r.Context(), db.CreateSignerParams{
				CompanyID:   int64(*companyID),
				CompanyType: "client",
				FirstName:   signer.Name,
				LastName:    "",
				Position:    signer.Position,
				Email:       signer.Email,
				CreatedBy:   int64(userID),
			})
		}
	}

	// Always record in pending_activations when user completes setup (unconditional)
	h.Queries.CreatePendingActivation(r.Context(), db.CreatePendingActivationParams{
		UserID:       int64(userID),
		CompanyID:    int64(*companyID),
		CompanyName:  req.CompanyName,
		RoleAtCompany: req.RoleAtCompany,
	})

	// Send setup completion notification to admins
	go sendSetupCompletedNotification(userID, req.CompanyName)

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Setup completed. Your account is pending activation.",
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
