package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/db"
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
	if cid := r.URL.Query().Get("company_id"); cid != "" {
		companyID, _ = strconv.Atoi(cid)
	}
	companyType := r.URL.Query().Get("company_type") // Optional: "client" or "supplier"

	// Optimized path: both company_id AND company_type provided → single filtered query
	if companyType == "client" || companyType == "supplier" {
		signers, err := h.Queries.ListSignersByCompanyAndType(r.Context(), db.ListSignersByCompanyAndTypeParams{
			CompanyID:   int64(companyID),
			CompanyType: companyType,
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list signers")
			return
		}
		if signers == nil {
			signers = []db.ListSignersByCompanyAndTypeRow{}
		}
		h.JSON(w, http.StatusOK, signers)
		return
	}

	// Legacy path: no company_type filter → return all signers for company_id
	signers, err := h.Queries.ListSignersByCompany(r.Context(), int64(companyID))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list signers")
		return
	}
	if signers == nil {
		signers = []db.ListSignersByCompanyRow{}
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
	var companyExists int64
	if req.CompanyType == "client" {
		companyExists, err = h.Queries.ClientExists(r.Context(), db.ClientExistsParams{
			ID:        int64(req.CompanyID),
			CompanyID: int64(companyID),
		})
	} else {
		companyExists, err = h.Queries.SupplierExists(r.Context(), db.SupplierExistsParams{
			ID:        int64(req.CompanyID),
			CompanyID: int64(companyID),
		})
	}
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create signer")
		return
	}
	if companyExists == 0 {
		h.Error(w, http.StatusBadRequest, req.CompanyType+" not found")
		return
	}

	userID := h.getUserID(r)
	signer, err := h.Queries.CreateSigner(r.Context(), db.CreateSignerParams{
		CompanyID:   int64(req.CompanyID),
		CompanyType: req.CompanyType,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		Position:    req.Position,
		Phone:       req.Phone,
		Email:       req.Email,
		CreatedBy:   int64(userID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create signer")
		return
	}
	h.auditLog(r, userID, companyID, "create", "signer", &signer.ID, nil, map[string]interface{}{
		"id":           signer.ID,
		"company_id":   req.CompanyID,
		"company_type": req.CompanyType,
		"first_name":   req.FirstName,
		"last_name":    req.LastName,
		"position":     req.Position,
		"email":        req.Email,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": signer.ID, "status": "created"})
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
	signer, err := h.Queries.GetSignerWithValidation(r.Context(), db.GetSignerWithValidationParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.JSON(w, http.StatusOK, signer)
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
			existingSigner, err := h.Queries.GetSignerByID(r.Context(), int64(id))
			if err != nil {
				h.Error(w, http.StatusNotFound, "signer not found")
				return
			}
			companyType = existingSigner.CompanyType
		}

		var companyExists int64
		if companyType == "client" {
			companyExists, err = h.Queries.ClientExists(r.Context(), db.ClientExistsParams{
				ID:        int64(req.CompanyID),
				CompanyID: int64(companyID),
			})
		} else {
			companyExists, err = h.Queries.SupplierExists(r.Context(), db.SupplierExistsParams{
				ID:        int64(req.CompanyID),
				CompanyID: int64(companyID),
			})
		}
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to update signer")
			return
		}
		if companyExists == 0 {
			h.Error(w, http.StatusBadRequest, companyType+" not found")
			return
		}
	}

	// Fetch previous state
	prevSigner, err := h.Queries.GetSignerWithValidation(r.Context(), db.GetSignerWithValidationParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}

	// Update signer
	updatedSigner, err := h.Queries.UpdateSigner(r.Context(), db.UpdateSignerParams{
		ID:          int64(id),
		CompanyID:   int64(req.CompanyID),
		CompanyType: req.CompanyType,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		Position:    sql.NullString{String: req.Position, Valid: req.Position != ""},
		Phone:       sql.NullString{String: req.Phone, Valid: req.Phone != ""},
		Email:       sql.NullString{String: req.Email, Valid: req.Email != ""},
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update signer")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "update", "signer", &id, map[string]interface{}{
		"id":           prevSigner.ID,
		"company_id":   prevSigner.CompanyID,
		"company_type": prevSigner.CompanyType,
		"first_name":   prevSigner.FirstName,
		"last_name":    prevSigner.LastName,
		"position":     prevSigner.Position,
		"phone":        prevSigner.Phone,
		"email":        prevSigner.Email,
	}, map[string]interface{}{
		"id":           updatedSigner.ID,
		"company_id":   updatedSigner.CompanyID,
		"company_type": updatedSigner.CompanyType,
		"first_name":   updatedSigner.FirstName,
		"last_name":    updatedSigner.LastName,
		"position":     updatedSigner.Position,
		"phone":        updatedSigner.Phone,
		"email":        updatedSigner.Email,
	})
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteSigner(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)

	// Fetch previous state for audit log
	prevSigner, err := h.Queries.GetSignerByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}

	err = h.Queries.DeleteSigner(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete signer")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "delete", "signer", &id, map[string]interface{}{
		"id":         id,
		"first_name": prevSigner.FirstName,
		"last_name":  prevSigner.LastName,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

	err = h.Queries.DeleteSigner(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete signer")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "delete", "signer", &id, map[string]interface{}{
		"id":         id,
		"first_name": prevSigner.FirstName,
		"last_name":  prevSigner.LastName,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
