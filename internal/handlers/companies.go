package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/db"

	"github.com/go-chi/chi/v5"
)

// companyRow represents a company with optional parent name
type companyRow struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Address    *string `json:"address,omitempty"`
	TaxID      *string `json:"tax_id,omitempty"`
	CompanyType string  `json:"company_type"`
	ParentID   *int64 `json:"parent_id,omitempty"`
	ParentName  *string `json:"parent_name,omitempty"`
	CreatedBy  *int64 `json:"created_by,omitempty"`
	CreatedAt  string  `json:"created_at"`
	UpdatedAt  string  `json:"updated_at"`
}

func (h *Handler) HandleCompanies(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.handleListCompanies(w, r)
	case http.MethodPost:
		h.handleCreateCompany(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// HandlePublicCompanies returns a list of all companies without authentication (for registration form).
func (h *Handler) HandlePublicCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := h.Queries.ListAllCompanies(r.Context())
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list companies")
		return
	}

	if companies == nil {
		companies = []db.Company{}
	}

	// Return simplified public view
	type PublicCompany struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	var publicCompanies []PublicCompany
	for _, c := range companies {
		publicCompanies = append(publicCompanies, PublicCompany{ID: int(c.ID), Name: c.Name})
	}

	h.JSON(w, http.StatusOK, publicCompanies)
}

func (h *Handler) HandleCompanyByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list companies")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.handleGetCompany(w, r, id)
	case http.MethodPut:
		h.handleUpdateCompany(w, r, id)
	case http.MethodDelete:
		h.handleDeleteCompany(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) handleListCompanies(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	companyType, err := h.Queries.GetCompanyTypeByID(r.Context(), int64(companyID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to get company")
		return
	}

	var companies []db.ListCompaniesForUserRow
	if companyType == "parent" {
		companies, err = h.Queries.ListAllCompaniesOrdered(r.Context())
	} else {
		companies, err = h.Queries.ListCompaniesForUser(r.Context(), int64(userID))
	}
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list companies")
		return
	}

	if companies == nil {
		companies = []db.ListCompaniesForUserRow{}
	}
	h.JSON(w, http.StatusOK, companies)
}

func (h *Handler) handleCreateCompany(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Address     *string `json:"address,omitempty"`
		TaxID       *string `json:"tax_id,omitempty"`
		CompanyType string  `json:"company_type"`
		ParentID    *int    `json:"parent_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		h.Error(w, http.StatusBadRequest, "company name is required")
		return
	}
	if req.CompanyType != "parent" && req.CompanyType != "subsidiary" && req.CompanyType != "single" {
		h.Error(w, http.StatusBadRequest, "invalid company type")
		return
	}

	userID := h.getUserID(r)

	if req.CompanyType == "subsidiary" && req.ParentID != nil {
		parentType, err := h.Queries.GetCompanyTypeByID(r.Context(), int64(*req.ParentID))
		if err != nil {
			h.Error(w, http.StatusBadRequest, "parent company not found")
			return
		}
		if parentType != "parent" {
			h.Error(w, http.StatusBadRequest, "parent company must be a parent type")
			return
		}
	}

	company, err := h.Queries.CreateCompany(r.Context(), db.CreateCompanyParams{
		Name:        req.Name,
		Address:     req.Address,
		TaxID:       req.TaxID,
		CompanyType: req.CompanyType,
		ParentID:    req.ParentID,
		CreatedBy:  int64(userID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create company")
		return
	}

	_, err = h.Queries.CreateUserCompany(r.Context(), db.CreateUserCompanyParams{
		UserID:    int64(userID),
		CompanyID: company.ID,
		IsDefault: 0,
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to link user to company")
		return
	}

	h.auditLog(r, userID, int(company.ID), "create", "company", &company.ID, nil, map[string]interface{}{
		"id":   company.ID,
		"name": req.Name,
	})

	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": company.ID, "name": req.Name})
}

func (h *Handler) handleGetCompany(w http.ResponseWriter, r *http.Request, id int) {
	company, err := h.Queries.GetCompanyWithParent(r.Context(), int64(id))
	if err != nil {
		if err == sql.ErrNoRows {
			h.Error(w, http.StatusNotFound, "company not found")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to get company")
		return
	}
	h.JSON(w, http.StatusOK, company)
}

func (h *Handler) handleUpdateCompany(w http.ResponseWriter, r *http.Request, id int) {
	var req struct {
		Name    *string `json:"name"`
		Address *string `json:"address"`
		TaxID   *string `json:"tax_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	_, err := h.Queries.UpdateCompanyFields(r.Context(), db.UpdateCompanyFieldsParams{
		ID:       int64(id),
		Name:     req.Name,
		Address:  req.Address,
		TaxID:    req.TaxID,
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) handleDeleteCompany(w http.ResponseWriter, r *http.Request, id int) {
	count, err := h.Queries.CountContractsByCompany(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete company")
		return
	}
	if count > 0 {
		h.Error(w, http.StatusConflict, "cannot delete company with active contracts")
		return
	}

	_, err = h.Queries.DeleteCompany(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
