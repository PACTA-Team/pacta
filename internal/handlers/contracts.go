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

func (h *Handler) HandleContracts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listContracts(w, r)
	case http.MethodPost:
		h.createContract(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) HandleContractByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/contracts/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getContract(w, r, id)
	case http.MethodPut:
		h.updateContract(w, r, id)
	case http.MethodDelete:
		h.deleteContract(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

type contractRow struct {
	ID                  int        `json:"id"`
	InternalID          string     `json:"internal_id"`
	ContractNumber      string     `json:"contract_number"`
	Title               *string   `json:"title,omitempty"`
	ClientID            int        `json:"client_id"`
	SupplierID          int        `json:"supplier_id"`
	ClientName          string     `json:"client_name"`
	SupplierName        string     `json:"supplier_name"`
	StartDate           string     `json:"start_date"`
	EndDate             string     `json:"end_date"`
	Amount              float64    `json:"amount"`
	Type                string     `json:"type"`
	Status              string     `json:"status"`
	Object              *string   `json:"object,omitempty"`
	FulfillmentPlace   *string   `json:"fulfillment_place,omitempty"`
	DisputeResolution   *string   `json:"dispute_resolution,omitempty"`
	HasConfidentiality  *bool      `json:"has_confidentiality,omitempty"`
	Guarantees         *string   `json:"guarantees,omitempty"`
	RenewalType        *string   `json:"renewal_type,omitempty"`
	DocumentURL        *string   `json:"document_url,omitempty"`
	DocumentKey        *string   `json:"document_key,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (h *Handler) listContracts(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	rows, err := h.DB.Query(`
		SELECT c.id, c.internal_id, c.contract_number, c.title,
		       c.client_id, c.supplier_id,
		       c.start_date, c.end_date, c.amount, c.type, c.status,
		       c.object, c.fulfillment_place, c.dispute_resolution,
		       c.has_confidentiality, c.guarantees, c.renewal_type,
		       c.document_url, c.document_key,
		       c.created_at, c.updated_at,
		       COALESCE(cl.name, '') AS client_name,
		       COALESCE(s.name, '') AS supplier_name
		FROM contracts c
		LEFT JOIN clients cl ON cl.id = c.client_id AND cl.deleted_at IS NULL
		LEFT JOIN suppliers s ON s.id = c.supplier_id AND s.deleted_at IS NULL
		WHERE c.deleted_at IS NULL AND c.company_id = ?
		ORDER BY c.created_at DESC
	`, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var contracts []contractRow
	for rows.Next() {
		var c contractRow
		if err := rows.Scan(&c.ID, &c.InternalID, &c.ContractNumber, &c.Title, &c.ClientID, &c.SupplierID,
			&c.StartDate, &c.EndDate, &c.Amount, &c.Type, &c.Status, &c.Object, &c.FulfillmentPlace,
			&c.DisputeResolution, &c.HasConfidentiality, &c.Guarantees, &c.RenewalType,
			&c.DocumentURL, &c.DocumentKey,
			&c.CreatedAt, &c.UpdatedAt, &c.ClientName, &c.SupplierName); err != nil {
			h.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		contracts = append(contracts, c)
	}
	if err := rows.Err(); err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if contracts == nil {
		contracts = []contractRow{}
	}
	h.JSON(w, http.StatusOK, contracts)
}

type createContractRequest struct {
	ContractNumber      string  `json:"contract_number"`
	Title             *string `json:"title"`
	ClientID          int     `json:"client_id"`
	CompanyID         *int    `json:"company_id,omitempty"`
	SupplierID        int     `json:"supplier_id"`
	ClientSignerID    *int    `json:"client_signer_id"`
	SupplierSignerID *int    `json:"supplier_signer_id"`
	StartDate         string  `json:"start_date"`
	EndDate           string  `json:"end_date"`
	Amount            float64 `json:"amount"`
	Type              string  `json:"type"`
	Status            string  `json:"status"`
	Description       *string `json:"description"`
	Object            *string `json:"object"`
	FulfillmentPlace *string `json:"fulfillment_place"`
	DisputeResolution *string `json:"dispute_resolution"`
	HasConfidentiality *bool  `json:"has_confidentiality,omitempty"`
	Guarantees        *string `json:"guarantees"`
	RenewalType       *string `json:"renewal_type"`
	DocumentURL       *string `json:"document_url"`        // Required: uploaded temporary document URL
	DocumentKey       *string `json:"document_key"`        // For tracking/cleanup
}

func (h *Handler) generateInternalID(companyID int) (string, error) {
	year := time.Now().Year()
	var maxNum sql.NullInt64
	err := h.DB.QueryRow(`
		SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))
		FROM contracts
		WHERE internal_id LIKE 'CNT-' || ? || '-%' AND company_id = ?
	`, year, companyID).Scan(&maxNum)
	if err != nil {
		return "", err
	}
	next := 1
	if maxNum.Valid {
		next = int(maxNum.Int64) + 1
	}
	return fmt.Sprintf("CNT-%d-%04d", year, next), nil
}

func (h *Handler) createContract(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	var req createContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	if req.Type == "" {
		req.Type = "service"
	}

	// Use frontend-provided company_id if available, otherwise fall back to session
	actualCompanyID := companyID
	if req.CompanyID != nil && *req.CompanyID > 0 {
		actualCompanyID = *req.CompanyID
	}

	// Validate that client belongs to the company
	if req.ClientID > 0 {
		var clientCompanyID int
		err := h.DB.QueryRow("SELECT company_id FROM clients WHERE id = ?", req.ClientID).Scan(&clientCompanyID)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "client not found")
			return
		}
		if clientCompanyID != actualCompanyID {
			h.Error(w, http.StatusBadRequest, "client does not belong to selected company")
			return
		}
	}

	// Validate that supplier belongs to the company
	if req.SupplierID > 0 {
		var supplierCompanyID int
		err := h.DB.QueryRow("SELECT company_id FROM suppliers WHERE id = ?", req.SupplierID).Scan(&supplierCompanyID)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "supplier not found")
			return
		}
		if supplierCompanyID != actualCompanyID {
			h.Error(w, http.StatusBadRequest, "supplier does not belong to selected company")
			return
		}
	}

	// Validate foreign key references before INSERT
	var clientExists int
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM clients WHERE id = ? AND deleted_at IS NULL", req.ClientID).Scan(&clientExists); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create contract")
		return
	}
	if clientExists == 0 {
		h.Error(w, http.StatusBadRequest, "client not found")
		return
	}

	var supplierExists int
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM suppliers WHERE id = ? AND deleted_at IS NULL", req.SupplierID).Scan(&supplierExists); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create contract")
		return
	}
	if supplierExists == 0 {
		h.Error(w, http.StatusBadRequest, "supplier not found")
		return
	}

	// Validate document upload (required)
	if req.DocumentURL == nil || *req.DocumentURL == "" {
		h.Error(w, http.StatusBadRequest, "document_url is required")
		return
	}
	if req.DocumentKey == nil || *req.DocumentKey == "" {
		h.Error(w, http.StatusBadRequest, "document_key is required")
		return
	}

	// Validate HTTPS for document_url
	if !strings.HasPrefix(*req.DocumentURL, "https://") {
		h.Error(w, http.StatusBadRequest, "document_url must be HTTPS")
		return
	}

	internalID, err := h.generateInternalID(actualCompanyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate internal ID")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(`
		INSERT INTO contracts (internal_id, contract_number, title, client_id, supplier_id,
			client_signer_id, supplier_signer_id, start_date, end_date, amount,
			type, status, description, object, fulfillment_place, dispute_resolution,
			has_confidentiality, guarantees, renewal_type, created_by, company_id,
			document_url, document_key)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, internalID, req.ContractNumber, req.Title, req.ClientID, req.SupplierID,
		req.ClientSignerID, req.SupplierSignerID, req.StartDate, req.EndDate,
		req.Amount, req.Type, req.Status, req.Description, req.Object, req.FulfillmentPlace,
		req.DisputeResolution, req.HasConfidentiality, req.Guarantees, req.RenewalType, userID, actualCompanyID,
		req.DocumentURL, req.DocumentKey)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint") || strings.Contains(err.Error(), "duplicate") {
			h.Error(w, http.StatusConflict, "contract number '"+req.ContractNumber+"' already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to create contract")
		return
	}
	id64, _ := result.LastInsertId()
	id := int(id64)
	h.auditLog(r, userID, companyID, "create", "contract", &id, nil, map[string]interface{}{
		"id":              id,
		"internal_id":     internalID,
		"contract_number": req.ContractNumber,
		"title":           req.Title,
		"client_id":       req.ClientID,
		"supplier_id":     req.SupplierID,
		"start_date":      req.StartDate,
		"end_date":        req.EndDate,
		"amount":          req.Amount,
		"type":            req.Type,
		"status":          req.Status,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"internal_id": internalID,
		"status":      "created",
	})
}

func (h *Handler) getContract(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var c contractRow
	err := h.DB.QueryRow(`
		SELECT c.id, c.internal_id, c.contract_number, c.title,
		       c.client_id, c.supplier_id,
		       c.start_date, c.end_date, c.amount, c.type, c.status,
		       c.object, c.fulfillment_place, c.dispute_resolution,
		       c.has_confidentiality, c.guarantees, c.renewal_type,
		       c.document_url, c.document_key,
		       c.created_at, c.updated_at,
		       COALESCE(cl.name, '') AS client_name,
		       COALESCE(s.name, '') AS supplier_name
		FROM contracts c
		LEFT JOIN clients cl ON cl.id = c.client_id AND cl.deleted_at IS NULL
		LEFT JOIN suppliers s ON s.id = c.supplier_id AND s.deleted_at IS NULL
		WHERE c.id = ? AND c.deleted_at IS NULL AND c.company_id = ?
	`, id, companyID).Scan(&c.ID, &c.InternalID, &c.ContractNumber, &c.Title, &c.ClientID, &c.SupplierID,
		&c.StartDate, &c.EndDate, &c.Amount, &c.Type, &c.Status, &c.Object, &c.FulfillmentPlace,
		&c.DisputeResolution, &c.HasConfidentiality, &c.Guarantees, &c.RenewalType,
		&c.DocumentURL, &c.DocumentKey,
		&c.CreatedAt, &c.UpdatedAt, &c.ClientName, &c.SupplierName)
	if err != nil {
		h.Error(w, http.StatusNotFound, "contract not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "READ", "contract", &id, nil, nil)
	h.JSON(w, http.StatusOK, c)
}

func (h *Handler) updateContract(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate client belongs to user's company
	var clientCompanyID int
	if err := h.DB.QueryRow("SELECT company_id FROM clients WHERE id = ? AND deleted_at IS NULL", req.ClientID).Scan(&clientCompanyID); err != nil {
		h.Error(w, http.StatusBadRequest, "client not found")
		return
	}
	if clientCompanyID != companyID {
		h.Error(w, http.StatusBadRequest, "client does not belong to your company")
		return
	}

	// Validate supplier belongs to user's company
	var supplierCompanyID int
	if err := h.DB.QueryRow("SELECT company_id FROM suppliers WHERE id = ? AND deleted_at IS NULL", req.SupplierID).Scan(&supplierCompanyID); err != nil {
		h.Error(w, http.StatusBadRequest, "supplier not found")
		return
	}
	if supplierCompanyID != companyID {
		h.Error(w, http.StatusBadRequest, "supplier does not belong to your company")
		return
	}

  // Fetch previous state for audit
  var prevTitle, prevStartDate, prevEndDate, prevType, prevStatus string
  var prevClientID, prevSupplierID int
  var prevAmount float64
  var prevDescription, prevClientSignerID, prevSupplierSignerID, prevObject, prevFulfillmentPlace, prevDisputeResolution, prevGuarantees, prevRenewalType, prevDocumentURL, prevDocumentKey *string
  err := h.DB.QueryRow(`
  		SELECT title, client_id, supplier_id, client_signer_id, supplier_signer_id,
  		       start_date, end_date, amount, type, status, description,
  		       object, fulfillment_place, dispute_resolution, guarantees, renewal_type,
  		       document_url, document_key
  		FROM contracts WHERE id = ? AND deleted_at IS NULL AND company_id = ?
  `, id, companyID).Scan(&prevTitle, &prevClientID, &prevSupplierID, &prevClientSignerID, &prevSupplierSignerID,
  		&prevStartDate, &prevEndDate, &prevAmount, &prevType, &prevStatus, &prevDescription,
  		&prevObject, &prevFulfillmentPlace, &prevDisputeResolution, &prevGuarantees, &prevRenewalType,
  		&prevDocumentURL, &prevDocumentKey)
  if err != nil {
  	h.Error(w, http.StatusNotFound, "contract not found")
  	return
  }

  // Build UPDATE SET dynamically based on provided fields
  var sets []string
  var args []interface{}

  // Always update these fields
  sets = append(sets, "title=?", "client_id=?", "supplier_id=?", "client_signer_id=?", "supplier_signer_id=?", "start_date=?", "end_date=?", "amount=?", "type=?", "status=?", "description=?", "object=?", "fulfillment_place=?", "dispute_resolution=?", "has_confidentiality=?", "guarantees=?", "renewal_type=?", "updated_at=CURRENT_TIMESTAMP")
  args = append(args, req.Title, req.ClientID, req.SupplierID, req.ClientSignerID, req.SupplierSignerID, req.StartDate, req.EndDate, req.Amount, req.Type, req.Status, req.Description, req.Object, req.FulfillmentPlace, req.DisputeResolution, req.HasConfidentiality, req.Guarantees, req.RenewalType)

  // Conditionally update document_url and document_key if provided
  if req.DocumentURL != nil && *req.DocumentURL != "" {
  	// Validate HTTPS
  	if !strings.HasPrefix(*req.DocumentURL, "https://") {
  		h.Error(w, http.StatusBadRequest, "document_url must be HTTPS")
  		return
  	}
  	sets = append(sets, "document_url=?", "document_key=?")
  	args = append(args, *req.DocumentURL, *req.DocumentKey)
  }

  args = append(args, id, companyID)

  query := fmt.Sprintf(`UPDATE contracts SET %s WHERE id=? AND deleted_at IS NULL AND company_id = ?`, strings.Join(sets, ", "))
  _, err = h.DB.Exec(query, args...)
  if err != nil {
  	h.Error(w, http.StatusInternalServerError, "failed to update contract")
  	return
  }

  var prevState map[string]interface{}
  if prevTitle != "" {
  	prevState = map[string]interface{}{
  		"id":                    id,
  		"title":                 prevTitle,
  		"client_id":             prevClientID,
  		"supplier_id":           prevSupplierID,
  		"client_signer_id":      prevClientSignerID,
  		"supplier_signer_id":    prevSupplierSignerID,
  		"start_date":            prevStartDate,
  		"end_date":              prevEndDate,
  		"amount":              prevAmount,
  		"type":                prevType,
  		"status":              prevStatus,
  		"description":         prevDescription,
  		"object":              prevObject,
  		"fulfillment_place":    prevFulfillmentPlace,
  		"dispute_resolution":  prevDisputeResolution,
  		"guarantees":        prevGuarantees,
  		"renewal_type":       prevRenewalType,
  		"document_url":        prevDocumentURL,
  		"document_key":        prevDocumentKey,
  	}
  }

  newState := map[string]interface{}{
  	"title":               req.Title,
  	"client_id":           req.ClientID,
  	"supplier_id":         req.SupplierID,
  	"client_signer_id":    req.ClientSignerID,
  	"supplier_signer_id": req.SupplierSignerID,
  	"start_date":          req.StartDate,
  	"end_date":            req.EndDate,
  	"amount":             req.Amount,
  	"type":               req.Type,
  	"status":             req.Status,
  	"description":        req.Description,
  	"object":             req.Object,
  	"fulfillment_place": req.FulfillmentPlace,
  	"dispute_resolution": req.DisputeResolution,
  	"guarantees":        req.Guarantees,
  	"renewal_type":       req.RenewalType,
  }

  // Include document fields if provided
  if req.DocumentURL != nil && *req.DocumentURL != "" {
  	newState["document_url"] = *req.DocumentURL
  	newState["document_key"] = *req.DocumentKey
  }

  h.auditLog(r, h.getUserID(r), companyID, "update", "contract", &id, prevState, newState)
  h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteContract(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var prevTitle, prevStatus string
	err := h.DB.QueryRow("SELECT title, status FROM contracts WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&prevTitle, &prevStatus)
	if err != nil {
		h.Error(w, http.StatusNotFound, "contract not found")
		return
	}

	_, err = h.DB.Exec("UPDATE contracts SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND company_id = ?", id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete contract")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "delete", "contract", &id, map[string]interface{}{
		"id":     id,
		"title":  prevTitle,
		"status": prevStatus,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
