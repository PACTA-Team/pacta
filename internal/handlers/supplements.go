package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type supplementRow struct {
	ID                 int        `json:"id"`
	InternalID         string     `json:"internal_id"`
	ContractID         int        `json:"contract_id"`
	SupplementNumber   string     `json:"supplement_number"`
	Description        *string    `json:"description,omitempty"`
	EffectiveDate      string     `json:"effective_date"`
	Modifications      *string    `json:"modifications,omitempty"`
	ModificationType   *string    `json:"modification_type,omitempty"`
	Status             string     `json:"status"`
	ClientSignerID     *int       `json:"client_signer_id,omitempty"`
	SupplierSignerID   *int       `json:"supplier_signer_id,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (h *Handler) HandleSupplements(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listSupplements(w, r)
	case http.MethodPost:
		h.createSupplement(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listSupplements(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	rows, err := h.DB.Query(`
		SELECT id, internal_id, contract_id, supplement_number, description,
		       effective_date, modifications, modification_type, status, client_signer_id, supplier_signer_id,
		       created_at, updated_at
		FROM supplements WHERE deleted_at IS NULL AND company_id = ? ORDER BY created_at DESC
	`, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list supplements")
		return
	}
	defer rows.Close()

	var supplements []supplementRow
	for rows.Next() {
		var s supplementRow
		if err := rows.Scan(&s.ID, &s.InternalID, &s.ContractID, &s.SupplementNumber,
			&s.Description, &s.EffectiveDate, &s.Modifications, &s.ModificationType, &s.Status,
			&s.ClientSignerID, &s.SupplierSignerID, &s.CreatedAt, &s.UpdatedAt); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list supplements")
			return
		}
		supplements = append(supplements, s)
	}
	if supplements == nil {
		supplements = []supplementRow{}
	}
	h.JSON(w, http.StatusOK, supplements)
}

func (h *Handler) generateSupplementInternalID(companyID int) (string, error) {
	year := time.Now().Year()
	var maxNum sql.NullInt64
	err := h.DB.QueryRow(`
		SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))
		FROM supplements
		WHERE internal_id LIKE 'SPL-' || ? || '-%' AND company_id = ?
	`, year, companyID).Scan(&maxNum)
	if err != nil {
		return "", err
	}
	next := 1
	if maxNum.Valid {
		next = int(maxNum.Int64) + 1
	}
	return fmt.Sprintf("SPL-%d-%04d", year, next), nil
}

type createSupplementRequest struct {
	ContractID         int     `json:"contract_id"`
	SupplementNumber   string  `json:"supplement_number"`
	Description        *string `json:"description"`
	EffectiveDate      string  `json:"effective_date"`
	Modifications      *string `json:"modifications"`
	ClientSignerID     *int    `json:"client_signer_id"`
	SupplierSignerID   *int    `json:"supplier_signer_id"`
	ModificationType   *string `json:"modification_type"`
}

func (h *Handler) createSupplement(w http.ResponseWriter, r *http.Request) {
	var req createSupplementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	companyID := h.GetCompanyID(r)

	// Validate contract exists and belongs to this company
	var contractExists int
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL AND company_id = ?", req.ContractID, companyID).Scan(&contractExists); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create supplement")
		return
	}
	if contractExists == 0 {
		h.Error(w, http.StatusBadRequest, "contract not found")
		return
	}

	// Validate signers if provided
	if req.ClientSignerID != nil {
		var signerExists int
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM authorized_signers WHERE id = ? AND deleted_at IS NULL AND company_id = ?", *req.ClientSignerID, companyID).Scan(&signerExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create supplement")
			return
		}
		if signerExists == 0 {
			h.Error(w, http.StatusBadRequest, "client signer not found")
			return
		}
	}
	if req.SupplierSignerID != nil {
		var signerExists int
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM authorized_signers WHERE id = ? AND deleted_at IS NULL AND company_id = ?", *req.SupplierSignerID, companyID).Scan(&signerExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create supplement")
			return
		}
		if signerExists == 0 {
			h.Error(w, http.StatusBadRequest, "supplier signer not found")
			return
		}
	}

	internalID, err := h.generateSupplementInternalID(companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate internal ID")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(`
		INSERT INTO supplements (internal_id, contract_id, supplement_number, description,
			effective_date, modifications, modification_type, status, client_signer_id, supplier_signer_id, created_by, company_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, internalID, req.ContractID, req.SupplementNumber, req.Description,
		req.EffectiveDate, req.Modifications, req.ModificationType, "draft",
		req.ClientSignerID, req.SupplierSignerID, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create supplement")
		return
	}
	id64, _ := result.LastInsertId()
	id := int(id64)
	h.auditLog(r, userID, companyID, "create", "supplement", &id, nil, map[string]interface{}{
		"id":                id,
		"internal_id":       internalID,
		"contract_id":       req.ContractID,
		"supplement_number": req.SupplementNumber,
		"status":            "draft",
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"internal_id": internalID,
		"status":      "created",
	})
}

func (h *Handler) HandleSupplementByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/supplements/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getSupplement(w, r, id)
	case http.MethodPut:
		h.updateSupplement(w, r, id)
	case http.MethodDelete:
		h.deleteSupplement(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getSupplement(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var s supplementRow
	err := h.DB.QueryRow(`
		SELECT id, internal_id, contract_id, supplement_number, description,
		       effective_date, modifications, modification_type, status, client_signer_id, supplier_signer_id,
		       created_at, updated_at
		FROM supplements WHERE id = ? AND deleted_at IS NULL AND company_id = ?
	`, id, companyID).Scan(&s.ID, &s.InternalID, &s.ContractID, &s.SupplementNumber,
		&s.Description, &s.EffectiveDate, &s.Modifications, &s.ModificationType, &s.Status,
		&s.ClientSignerID, &s.SupplierSignerID, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}
	h.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSupplement(w http.ResponseWriter, r *http.Request, id int) {
	var req createSupplementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	companyID := h.GetCompanyID(r)

	// Validate contract exists if contract_id is provided
	if req.ContractID > 0 {
		var contractExists int
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL AND company_id = ?", req.ContractID, companyID).Scan(&contractExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to update supplement")
			return
		}
		if contractExists == 0 {
			h.Error(w, http.StatusBadRequest, "contract not found")
			return
		}
	}

	// Fetch previous state for audit
	var prevContractID int
	var prevSupplementNumber string
	var prevDescription, prevEffectiveDate, prevModifications, prevModificationType, prevStatus *string
	var prevClientSignerID, prevSupplierSignerID *int
	err := h.DB.QueryRow(`
		SELECT contract_id, supplement_number, description, effective_date,
		       modifications, modification_type, status, client_signer_id, supplier_signer_id
		FROM supplements WHERE id = ? AND deleted_at IS NULL AND company_id = ?
	`, id, companyID).Scan(&prevContractID, &prevSupplementNumber, &prevDescription,
		&prevEffectiveDate, &prevModifications, &prevModificationType, &prevStatus,
		&prevClientSignerID, &prevSupplierSignerID)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	_, err = h.DB.Exec(`
		UPDATE supplements SET contract_id=?, supplement_number=?, description=?,
			effective_date=?, modifications=?, modification_type=?, status=?, client_signer_id=?, supplier_signer_id=?,
			updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL AND company_id = ?
	`, req.ContractID, req.SupplementNumber, req.Description,
		req.EffectiveDate, req.Modifications, req.ModificationType, "draft",
		req.ClientSignerID, req.SupplierSignerID, id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplement")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "update", "supplement", &id, map[string]interface{}{
		"id":                id,
		"contract_id":       prevContractID,
		"supplement_number": prevSupplementNumber,
		"description":       prevDescription,
		"effective_date":    prevEffectiveDate,
		"modifications":     prevModifications,
		"status":            prevStatus,
	}, map[string]interface{}{
		"id":                id,
		"contract_id":       req.ContractID,
		"supplement_number": req.SupplementNumber,
		"description":       req.Description,
		"effective_date":    req.EffectiveDate,
		"modifications":     req.Modifications,
		"status":            "draft",
	})
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteSupplement(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var prevSupplementNumber, prevStatus string
	err := h.DB.QueryRow("SELECT supplement_number, status FROM supplements WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&prevSupplementNumber, &prevStatus)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	_, err = h.DB.Exec("UPDATE supplements SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND company_id = ?", id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete supplement")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "delete", "supplement", &id, map[string]interface{}{
		"id":                id,
		"supplement_number": prevSupplementNumber,
		"status":            prevStatus,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) HandleSupplementStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/supplements/")
	idStr = strings.TrimSuffix(idStr, "/status")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	companyID := h.GetCompanyID(r)

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Status != "draft" && req.Status != "approved" && req.Status != "active" {
		h.Error(w, http.StatusBadRequest, "status must be 'draft', 'approved', or 'active'")
		return
	}

	var currentStatus string
	err = h.DB.QueryRow("SELECT status FROM supplements WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&currentStatus)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	validTransitions := map[string][]string{
		"draft":    {"approved"},
		"approved": {"draft", "active"},
		"active":   {},
	}
	allowed := validTransitions[currentStatus]
	transitionAllowed := false
	for _, a := range allowed {
		if a == req.Status {
			transitionAllowed = true
			break
		}
	}
	if !transitionAllowed {
		h.Error(w, http.StatusBadRequest, fmt.Sprintf("cannot transition from '%s' to '%s'", currentStatus, req.Status))
		return
	}

	_, err = h.DB.Exec("UPDATE supplements SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND company_id = ?", req.Status, id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplement status")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "status_change", "supplement", &id, map[string]interface{}{
		"id":     id,
		"status": currentStatus,
	}, map[string]interface{}{
		"id":     id,
		"status": req.Status,
	})
	h.JSON(w, http.StatusOK, map[string]interface{}{
		"status":          req.Status,
		"previous_status": currentStatus,
	})
}
