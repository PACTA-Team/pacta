package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
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
	supplements, err := h.Queries.ListSupplementsByCompany(r.Context(), int64(companyID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list supplements")
		return
	}
	if supplements == nil {
		supplements = []db.ListSupplementsByCompanyRow{}
	}
	h.JSON(w, http.StatusOK, supplements)
}

func (h *Handler) generateSupplementInternalID(companyID int) (string, error) {
	year := time.Now().Year()
	maxNum, err := h.Queries.GetMaxSupplementInternalID(r.Context(), db.GetMaxSupplementInternalIDParams{
		Year:      fmt.Sprintf("%d", year),
		CompanyID: int64(companyID),
	})
	if err != nil {
		return "", err
	}
	next := 1
	if maxNum.Valid {
		next = int(maxNum.Int64) + 1
	}
	return fmt.Sprintf("SPL-%d-%04d", year, next), nil
}
	next := int64(1)
	if maxNum.Valid {
		next = maxNum.Int64 + 1
	}
	return fmt.Sprintf("SPL-%d-%04d", year, next), nil
}

// validateSupplementStatus validates that status is one of the allowed values
func validateSupplementStatus(status *string) error {
	if status == nil || *status == "" {
		return nil
	}
	if *status != "draft" && *status != "approved" && *status != "active" {
		return fmt.Errorf("status must be 'draft', 'approved', or 'active', got '%s'", *status)
	}
	return nil
}

// determineSupplementStatus returns the status to use for INSERT/UPDATE operations.
// For CREATE: returns newStatus if provided, otherwise defaults to "draft"
// For UPDATE: returns newStatus if provided, otherwise preserves currentStatus
func determineSupplementStatus(newStatus, currentStatus *string) string {
	if newStatus != nil && *newStatus != "" {
		return *newStatus
	}
	if currentStatus != nil && *currentStatus != "" {
		return *currentStatus
	}
	return "draft"
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
	Status            *string `json:"status"`
}

func (h *Handler) createSupplement(w http.ResponseWriter, r *http.Request) {
	var req createSupplementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	companyID := h.GetCompanyID(r)

	// Validate contract exists and belongs to this company
	contractExists, err := h.Queries.ContractExists(r.Context(), db.ContractExistsParams{
		ID:        int64(req.ContractID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create supplement")
		return
	}
	if contractExists == 0 {
		h.Error(w, http.StatusBadRequest, "contract not found")
		return
	}

	// Validate status if provided
	if err := validateSupplementStatus(req.Status); err != nil {
		log.Printf("[handlers/supplements] ERROR: %v", err)
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate signers if provided
	if req.ClientSignerID != nil {
		signerExists, err := h.Queries.SignerExists(r.Context(), db.SignerExistsParams{
			ID:        int64(*req.ClientSignerID),
			CompanyID: int64(companyID),
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create supplement")
			return
		}
		if signerExists == 0 {
			h.Error(w, http.StatusBadRequest, "client signer not found")
			return
		}
	}
	if req.SupplierSignerID != nil {
		signerExists, err := h.Queries.SignerExists(r.Context(), db.SignerExistsParams{
			ID:        int64(*req.SupplierSignerID),
			CompanyID: int64(companyID),
		})
		if err != nil {
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
	statusToUse := determineSupplementStatus(req.Status, nil)
	supplement, err := h.Queries.CreateSupplement(r.Context(), db.CreateSupplementParams{
		ContractID:       int64(req.ContractID),
		SupplementNumber:   req.SupplementNumber,
		Description:       req.Description,
		EffectiveDate:      req.EffectiveDate,
		Modifications:      req.Modifications,
		ModificationType:   req.ModificationType,
		Status:            statusToUse,
		ClientSignerID:    req.ClientSignerID,
		SupplierSignerID:   req.SupplierSignerID,
		InternalID:        internalID,
		CompanyID:         int64(companyID),
		CreatedBy:          int64(userID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create supplement")
		return
	}
	h.auditLog(r, userID, companyID, "create", "supplement", &supplement.ID, nil, map[string]interface{}{
		"id":                supplement.ID,
		"internal_id":       internalID,
		"contract_id":       req.ContractID,
		"supplement_number": req.SupplementNumber,
		"status":            statusToUse,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          supplement.ID,
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
	supplement, err := h.Queries.GetSupplementByID(r.Context(), id, int64(companyID))
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}
	h.JSON(w, http.StatusOK, supplement)
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
		contractExists, err := h.Queries.ContractExists(r.Context(), db.ContractExistsParams{
			ID:        int64(req.ContractID),
			CompanyID: int64(companyID),
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to update supplement")
			return
		}
		if contractExists == 0 {
			h.Error(w, http.StatusBadRequest, "contract not found")
			return
		}
	}

	// Validate status if provided
	if err := validateSupplementStatus(req.Status); err != nil {
		log.Printf("[handlers/supplements] ERROR: %v", err)
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Fetch previous state for audit
	prevSupplement, err := h.Queries.GetSupplementByID(r.Context(), id, int64(companyID))
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	newStatus := determineSupplementStatus(req.Status, &prevSupplement.Status)

	_, err = h.Queries.UpdateSupplement(r.Context(), db.UpdateSupplementParams{
		ID:                int64(id),
		ContractID:         int64(req.ContractID),
		SupplementNumber:   req.SupplementNumber,
		Description:       req.Description,
		EffectiveDate:      req.EffectiveDate,
		Modifications:      req.Modifications,
		ModificationType:   req.ModificationType,
		Status:            newStatus,
		ClientSignerID:    req.ClientSignerID,
		SupplierSignerID:   req.SupplierSignerID,
		CompanyID:         int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplement")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "update", "supplement", &id, map[string]interface{}{
		"id":                id,
		"contract_id":       prevSupplement.ContractID,
		"supplement_number": prevSupplement.SupplementNumber,
		"description":       prevSupplement.Description,
		"effective_date":    prevSupplement.EffectiveDate,
		"modifications":     prevSupplement.Modifications,
		"status":            prevSupplement.Status,
	}, map[string]interface{}{
		"id":                id,
		"contract_id":       req.ContractID,
		"supplement_number": req.SupplementNumber,
		"description":       req.Description,
		"effective_date":    req.EffectiveDate,
		"modifications":     req.Modifications,
		"status":            newStatus,
	})
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteSupplement(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	prevSupplement, err := h.Queries.GetSupplementByID(r.Context(), id, int64(companyID))
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	err = h.Queries.DeleteSupplement(r.Context(), id, int64(companyID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete supplement")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "delete", "supplement", &id, map[string]interface{}{
		"id":                id,
		"supplement_number": prevSupplement.SupplementNumber,
		"status":            prevSupplement.Status,
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

	currentStatus, err := h.Queries.GetSupplementStatus(r.Context(), id, int64(companyID))
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

	err = h.Queries.UpdateSupplementStatus(r.Context(), req.Status, id, int64(companyID))
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
