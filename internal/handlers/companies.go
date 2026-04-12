package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/models"

	"github.com/go-chi/chi/v5"
)

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

func (h *Handler) HandleCompanyByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid company ID")
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

	// Check if user is admin of a parent company (can see all subsidiaries)
	var companyType string
	h.DB.QueryRow("SELECT company_type FROM companies WHERE id = ?", companyID).Scan(&companyType)

	var rows *sql.Rows
	var err error

	if companyType == "parent" {
		rows, err = h.DB.Query(`
			SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
			       p.name as parent_name, c.created_by, c.created_at, c.updated_at
			FROM companies c
			LEFT JOIN companies p ON c.parent_id = p.id
			WHERE c.deleted_at IS NULL
			ORDER BY c.company_type DESC, c.name
		`)
	} else {
		rows, err = h.DB.Query(`
			SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
			       p.name as parent_name, c.created_by, c.created_at, c.updated_at
			FROM companies c
			JOIN user_companies uc ON uc.company_id = c.id
			LEFT JOIN companies p ON c.parent_id = p.id
			WHERE uc.user_id = ? AND c.deleted_at IS NULL
			ORDER BY c.company_type DESC, c.name
		`, userID)
	}

	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list companies")
		return
	}
	defer rows.Close()

	var companies []models.Company
	for rows.Next() {
		var c models.Company
		if err := rows.Scan(&c.ID, &c.Name, &c.Address, &c.TaxID, &c.CompanyType,
			&c.ParentID, &c.ParentName, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		companies = append(companies, c)
	}

	if companies == nil {
		companies = []models.Company{}
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
		var parentType string
		err := h.DB.QueryRow("SELECT company_type FROM companies WHERE id = ? AND deleted_at IS NULL", *req.ParentID).Scan(&parentType)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "parent company not found")
			return
		}
	}

	result, err := h.DB.Exec(
		"INSERT INTO companies (name, address, tax_id, company_type, parent_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
		req.Name, req.Address, req.TaxID, req.CompanyType, req.ParentID, userID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create company")
		return
	}

	id, _ := result.LastInsertId()
	h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 0)", userID, id)

	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "name": req.Name})
}

func (h *Handler) handleGetCompany(w http.ResponseWriter, r *http.Request, id int) {
	var c models.Company
	err := h.DB.QueryRow(`
		SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
		       p.name as parent_name, c.created_by, c.created_at, c.updated_at
		FROM companies c
		LEFT JOIN companies p ON c.parent_id = p.id
		WHERE c.id = ? AND c.deleted_at IS NULL
	`, id).Scan(&c.ID, &c.Name, &c.Address, &c.TaxID, &c.CompanyType,
		&c.ParentID, &c.ParentName, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		h.Error(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to get company")
		return
	}
	h.JSON(w, http.StatusOK, c)
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

	_, err := h.DB.Exec(
		"UPDATE companies SET name = COALESCE(?, name), address = COALESCE(?, address), tax_id = COALESCE(?, tax_id), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
		req.Name, req.Address, req.TaxID, id,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) handleDeleteCompany(w http.ResponseWriter, r *http.Request, id int) {
	var count int
	h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE company_id = ? AND deleted_at IS NULL", id).Scan(&count)
	if count > 0 {
		h.Error(w, http.StatusConflict, "cannot delete company with active contracts")
		return
	}

	_, err := h.DB.Exec("UPDATE companies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
