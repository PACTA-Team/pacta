package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
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
	ID                 int        `json:"id"`
	InternalID         string     `json:"internal_id"`
	ContractNumber     string     `json:"contract_number"`
	Title              *string   `json:"title,omitempty"`
	ClientID           int        `json:"client_id"`
	SupplierID         int        `json:"supplier_id"`
	ClientName         string     `json:"client_name"`
	SupplierName       string     `json:"supplier_name"`
	StartDate          string     `json:"start_date"`
	EndDate            string     `json:"end_date"`
	Amount             float64    `json:"amount"`
	Type               string     `json:"type"`
	Status             string     `json:"status"`
	Object             *string   `json:"object,omitempty"`
	FulfillmentPlace  *string   `json:"fulfillment_place,omitempty"`
	DisputeResolution  *string   `json:"dispute_resolution,omitempty"`
	HasConfidentiality *bool      `json:"has_confidentiality,omitempty"`
	Guarantees        *string   `json:"guarantees,omitempty"`
	RenewalType       *string   `json:"renewal_type,omitempty"`
	DocumentURL       *string   `json:"document_url,omitempty"`
	DocumentKey       *string   `json:"document_key,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (h *Handler) listContracts(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	contracts, err := h.Queries.ListContractsByCompanyWithNames(r.Context(), int64(companyID))
	if err != nil {
		log.Printf("[handlers/contracts] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	if contracts == nil {
		contracts = []db.ListContractsByCompanyWithNamesRow{}
	}

	// Convert to contractRow format
	var result []contractRow
	for _, c := range contracts {
		result = append(result, contractRow{
			ID:                c.ID,
			InternalID:        c.InternalID,
			ContractNumber:    c.ContractNumber,
			Title:             c.Title,
			ClientID:          c.ClientID,
			SupplierID:        c.SupplierID,
			ClientName:        c.ClientName,
			SupplierName:      c.SupplierName,
			StartDate:         c.StartDate,
			EndDate:           c.EndDate,
			Amount:            c.Amount,
			Type:              c.Type,
			Status:             c.Status,
			CreatedAt:         c.CreatedAt,
			UpdatedAt:         c.UpdatedAt,
		})
	}

	h.JSON(w, http.StatusOK, result)
}

type createContractRequest struct {
	ContractNumber     string  `json:"contract_number"`
	Title             *string `json:"title"`
	ClientID          int     `json:"client_id"`
	CompanyID         *int    `json:"company_id,omitempty"`
	SupplierID        int     `json:"supplier_id"`
	ClientSignerID    *int    `json:"client_signer_id,omitempty"`
	SupplierSignerID *int    `json:"supplier_signer_id,omitempty"`
	StartDate         string  `json:"start_date"`
	EndDate           string  `json:"end_date"`
	Amount            float64 `json:"amount"`
	Type              string  `json:"type"`
	Status            string  `json:"status"`
	Description       *string `json:"description"`
	Object            *string `json:"object"`
	FulfillmentPlace *string `json:"fulfillment_place"`
	DisputeResolution *string `json:"dispute_resolution"`
	HasConfidentiality *bool   `json:"has_confidentiality,omitempty"`
	Guarantees        *string `json:"guarantees"`
	RenewalType       *string `json:"renewal_type"`
	DocumentURL       *string `json:"document_url"`
	DocumentKey       *string `json:"document_key"`
}

func (h *Handler) generateInternalID(companyID int) (string, error) {
	year := time.Now().Year()
	maxNum, err := h.Queries.GetMaxContractInternalID(r.Context(), db.GetMaxContractInternalIDParams{
		Year:      year,
		CompanyID: int64(companyID),
	})
	if err != nil {
		return "", err
	}
	next := int64(1)
	if maxNum.Valid {
		next = maxNum.Int64 + 1
	}
	return fmt.Sprintf("CNT-%d-%04d", year, next), nil
}

func (h *Handler) createContract(w http.ResponseWriter, r *http.Request) {
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
	actualCompanyID := h.GetCompanyID(r)
	if req.CompanyID != nil && *req.CompanyID > 0 {
		actualCompanyID = *req.CompanyID
	}

	// Validate that client belongs to the company
	if req.ClientID > 0 {
		clientCompanyID, err := h.Queries.GetClientCompanyID(r.Context(), req.ClientID)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "client not found")
			return
		}
		if clientCompanyID != int64(actualCompanyID) {
			h.Error(w, http.StatusBadRequest, "client does not belong to selected company")
			return
		}
	}

	// Validate that supplier belongs to the company
	if req.SupplierID > 0 {
		supplierCompanyID, err := h.Queries.GetSupplierCompanyID(r.Context(), req.SupplierID)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "supplier not found")
			return
		}
		if supplierCompanyID != int64(actualCompanyID) {
			h.Error(w, http.StatusBadRequest, "supplier does not belong to selected company")
			return
		}
	}

	// Validate foreign key references before INSERT
	clientExists, err := h.Queries.ClientExists(r.Context(), db.ClientExistsParams{
		ID:        int64(req.ClientID),
		CompanyID: int64(actualCompanyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create contract")
		return
	}
	if clientExists == 0 {
		h.Error(w, http.StatusBadRequest, "client not found")
		return
	}

	supplierExists, err := h.Queries.SupplierExists(r.Context(), db.SupplierExistsParams{
		ID:        int64(req.SupplierID),
		CompanyID: int64(actualCompanyID),
	})
	if err != nil {
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
	contract, err := h.Queries.CreateContract(r.Context(), db.CreateContractParams{
		InternalID:       internalID,
		ContractNumber:   req.ContractNumber,
		Title:            req.Title,
		ClientID:         int64(req.ClientID),
		SupplierID:       int64(req.SupplierID),
		ClientSignerID:   req.ClientSignerID,
		SupplierSignerID: req.SupplierSignerID,
		StartDate:         req.StartDate,
		EndDate:           req.EndDate,
		Amount:            req.Amount,
		Type:              req.Type,
		Status:            req.Status,
		Description:       req.Description,
		Object:            req.Object,
		FulfillmentPlace: req.FulfillmentPlace,
		DisputeResolution: req.DisputeResolution,
		HasConfidentiality: req.HasConfidentiality,
		Guarantees:        req.Guarantees,
		RenewalType:       req.RenewalType,
		CreatedBy:         int64(userID),
		CompanyID:         int64(actualCompanyID),
		DocumentURL:       req.DocumentURL,
		DocumentKey:       req.DocumentKey,
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint") || strings.Contains(err.Error(), "duplicate") {
			h.Error(w, http.StatusConflict, "contract number '"+req.ContractNumber+"' already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to create contract")
		return
	}

	h.auditLog(r, userID, actualCompanyID, "create", "contract", &contract.ID, nil, map[string]interface{}{
		"id":              contract.ID,
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
		"id":          contract.ID,
		"internal_id": internalID,
		"status":      "created",
	})
}

func (h *Handler) getContract(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	contract, err := h.Queries.GetContractWithNames(r.Context(), db.GetContractWithNamesParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "contract not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "READ", "contract", &id, nil, nil)
	h.JSON(w, http.StatusOK, contract)
}

func (h *Handler) updateContract(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate client belongs to user's company
	clientCompanyID, err := h.Queries.GetClientCompanyID(r.Context(), req.ClientID)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "client not found")
		return
	}
	if clientCompanyID != int64(companyID) {
		h.Error(w, http.StatusBadRequest, "client does not belong to your company")
		return
	}

	// Validate supplier belongs to user's company
	supplierCompanyID, err := h.Queries.GetSupplierCompanyID(r.Context(), req.SupplierID)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "supplier not found")
		return
	}
	if supplierCompanyID != int64(companyID) {
		h.Error(w, http.StatusBadRequest, "supplier does not belong to your company")
		return
	}

	// Fetch previous state for audit
	prevContract, err := h.Queries.GetContractForUpdate(r.Context(), db.GetContractForUpdateParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "contract not found")
		return
	}

	// Build update params
	params := db.UpdateContractFieldsParams{
		Title:            req.Title,
		ClientSignerID:   req.ClientSignerID,
		SupplierSignerID: req.SupplierSignerID,
		StartDate:         req.StartDate,
		EndDate:           req.EndDate,
		Amount:            req.Amount,
		Description:       req.Description,
		Object:            req.Object,
		FulfillmentPlace: req.FulfillmentPlace,
		DisputeResolution: req.DisputeResolution,
		HasConfidentiality: req.HasConfidentiality,
		Guarantees:        req.Guarantees,
		RenewalType:       req.RenewalType,
		ID:               int64(id),
		CompanyID:        int64(companyID),
	}

	// Only update document fields if provided
	if req.DocumentURL != nil && *req.DocumentURL != "" {
		if !strings.HasPrefix(*req.DocumentURL, "https://") {
			h.Error(w, http.StatusBadRequest, "document_url must be HTTPS")
			return
		}
		params.DocumentURL = req.DocumentURL
		params.DocumentKey = req.DocumentKey
	}

	_, err = h.Queries.UpdateContractFields(r.Context(), params)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update contract")
		return
	}

	// Build previous state for audit
	prevState := map[string]interface{}{
		"id":                id,
		"contract_number":    prevContract.ContractNumber,
		"title":             prevContract.Title,
		"description":       prevContract.Description,
		"start_date":        prevContract.StartDate,
		"end_date":          prevContract.EndDate,
		"amount":            prevContract.Amount,
		"type":              prevContract.Type,
		"status":            prevContract.Status,
		"client_id":         prevContract.ClientID,
		"supplier_id":       prevContract.SupplierID,
		"client_signer_id":  prevContract.ClientSignerID,
		"supplier_signer_id": prevContract.SupplierSignerID,
	}

	// Build new state for audit
	newState := map[string]interface{}{
		"id":                id,
		"contract_number":    req.ContractNumber,
		"title":             req.Title,
		"description":       req.Description,
		"start_date":        req.StartDate,
		"end_date":          req.EndDate,
		"amount":            req.Amount,
		"type":              req.Type,
		"status":            req.Status,
		"client_id":         req.ClientID,
		"supplier_id":       req.SupplierID,
		"client_signer_id":  req.ClientSignerID,
		"supplier_signer_id": req.SupplierSignerID,
	}

	h.auditLog(r, h.getUserID(r), companyID, "update", "contract", &id, prevState, newState)
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteContract(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	prevContract, err := h.Queries.GetContractByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "contract not found")
		return
	}

	_, err = h.Queries.DeleteContract(r.Context(), db.DeleteContractParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete contract")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "delete", "contract", &id, map[string]interface{}{
		"id":     id,
		"title":  prevContract.Title,
		"status": prevContract.Status,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
