package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type signerRow struct {
	ID          int     `json:"id"`
	CompanyID   int     `json:"company_id"`
	CompanyType string  `json:"company_type"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	Position    *string `json:"position,omitempty"`
	Phone       *string `json:"phone,omitempty"`
	Email       *string `json:"email,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

func (h *Handler) HandleSigners(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listSigners(w, r)
	case http.MethodPost:
		h.createSigner(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listSigners(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	rows, err := h.DB.Query(`
		SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
		FROM authorized_signers WHERE deleted_at IS NULL AND company_id = ? ORDER BY last_name, first_name
	`, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list signers")
		return
	}
	defer rows.Close()

	var signers []signerRow
	for rows.Next() {
		var s signerRow
		rows.Scan(&s.ID, &s.CompanyID, &s.CompanyType, &s.FirstName, &s.LastName, &s.Position, &s.Phone, &s.Email, &s.CreatedAt, &s.UpdatedAt)
		signers = append(signers, s)
	}
	if signers == nil {
		signers = []signerRow{}
	}
	h.JSON(w, http.StatusOK, signers)
}

type createSignerRequest struct {
	CompanyID   int    `json:"company_id"`
	CompanyType string `json:"company_type"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Position    string `json:"position"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
}

func (h *Handler) createSigner(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	var req createSignerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate company_type
	if req.CompanyType != "client" && req.CompanyType != "supplier" {
		h.Error(w, http.StatusBadRequest, "company_type must be 'client' or 'supplier'")
		return
	}

	// Validate foreign key: check company exists and belongs to user's company
	var companyExists int
	if req.CompanyType == "client" {
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM clients WHERE id = ? AND deleted_at IS NULL AND company_id = ?", req.CompanyID, companyID).Scan(&companyExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create signer")
			return
		}
	} else {
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM suppliers WHERE id = ? AND deleted_at IS NULL AND company_id = ?", req.CompanyID, companyID).Scan(&companyExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create signer")
			return
		}
	}
	if companyExists == 0 {
		h.Error(w, http.StatusBadRequest, req.CompanyType+" not found")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(
		"INSERT INTO authorized_signers (company_id, company_type, first_name, last_name, position, phone, email, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		req.CompanyID, req.CompanyType, req.FirstName, req.LastName, req.Position, req.Phone, req.Email, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create signer")
		return
	}
	id64, _ := result.LastInsertId()
	id := int(id64)
	h.auditLog(r, userID, companyID, "create", "signer", &id, nil, map[string]interface{}{
		"id":           id,
		"company_id":   req.CompanyID,
		"company_type": req.CompanyType,
		"first_name":   req.FirstName,
		"last_name":    req.LastName,
		"position":     req.Position,
		"email":        req.Email,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}

func (h *Handler) HandleSignerByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/signers/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getSigner(w, r, id)
	case http.MethodPut:
		h.updateSigner(w, r, id)
	case http.MethodDelete:
		h.deleteSigner(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getSigner(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var s signerRow
	err := h.DB.QueryRow(`
		SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
		FROM authorized_signers WHERE id = ? AND deleted_at IS NULL AND company_id IN (
			SELECT id FROM clients WHERE company_id = ? AND deleted_at IS NULL
			UNION ALL
			SELECT id FROM suppliers WHERE company_id = ? AND deleted_at IS NULL
		)
	`, id, companyID, companyID).Scan(&s.ID, &s.CompanyID, &s.CompanyType, &s.FirstName, &s.LastName, &s.Position, &s.Phone, &s.Email, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSigner(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createSignerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate company_type if provided
	if req.CompanyType != "" && req.CompanyType != "client" && req.CompanyType != "supplier" {
		h.Error(w, http.StatusBadRequest, "company_type must be 'client' or 'supplier'")
		return
	}

	// Validate foreign key if company_id is provided
	if req.CompanyID > 0 {
		companyType := req.CompanyType
		if companyType == "" {
			// Fetch existing company_type to validate against
			var existingType string
			if err := h.DB.QueryRow("SELECT company_type FROM authorized_signers WHERE id = ? AND deleted_at IS NULL", id).Scan(&existingType); err != nil {
				h.Error(w, http.StatusNotFound, "signer not found")
				return
			}
			companyType = existingType
		}

		var companyExists int
		if companyType == "client" {
			if err := h.DB.QueryRow("SELECT COUNT(*) FROM clients WHERE id = ? AND deleted_at IS NULL AND company_id = ?", req.CompanyID, companyID).Scan(&companyExists); err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to update signer")
				return
			}
		} else {
			if err := h.DB.QueryRow("SELECT COUNT(*) FROM suppliers WHERE id = ? AND deleted_at IS NULL AND company_id = ?", req.CompanyID, companyID).Scan(&companyExists); err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to update signer")
				return
			}
		}
		if companyExists == 0 {
			h.Error(w, http.StatusBadRequest, companyType+" not found")
			return
		}
	}

	// Fetch previous state
	var prevFirstName, prevLastName, prevPosition, prevPhone, prevEmail string
	var prevCompanyID int
	var prevCompanyType string
	err := h.DB.QueryRow("SELECT company_id, company_type, first_name, last_name, position, phone, email FROM authorized_signers WHERE id = ? AND deleted_at IS NULL AND company_id IN (SELECT id FROM clients WHERE company_id = ? AND deleted_at IS NULL UNION ALL SELECT id FROM suppliers WHERE company_id = ? AND deleted_at IS NULL)", id, companyID, companyID).Scan(&prevCompanyID, &prevCompanyType, &prevFirstName, &prevLastName, &prevPosition, &prevPhone, &prevEmail)
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}

	result, err := h.DB.Exec(`
		UPDATE authorized_signers SET company_id=?, company_type=?, first_name=?, last_name=?, position=?, phone=?, email=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, req.CompanyID, req.CompanyType, req.FirstName, req.LastName, req.Position, req.Phone, req.Email, id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update signer")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "update", "signer", &id, map[string]interface{}{
		"id":           id,
		"company_id":   prevCompanyID,
		"company_type": prevCompanyType,
		"first_name":   prevFirstName,
		"last_name":    prevLastName,
		"position":     prevPosition,
		"phone":        prevPhone,
		"email":        prevEmail,
	}, map[string]interface{}{
		"id":           id,
		"company_id":   req.CompanyID,
		"company_type": req.CompanyType,
		"first_name":   req.FirstName,
		"last_name":    req.LastName,
		"position":     req.Position,
		"phone":        req.Phone,
		"email":        req.Email,
	})
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteSigner(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var prevFirstName, prevLastName string
	err := h.DB.QueryRow("SELECT first_name, last_name FROM authorized_signers WHERE id = ? AND deleted_at IS NULL", id).Scan(&prevFirstName, &prevLastName)
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	result, err := h.DB.Exec(
		"UPDATE authorized_signers SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",
		id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete signer")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "delete", "signer", &id, map[string]interface{}{
		"id":         id,
		"first_name": prevFirstName,
		"last_name":  prevLastName,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
