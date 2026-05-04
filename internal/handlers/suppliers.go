package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/db"
)

type supplierRow struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Address   *string `json:"address,omitempty"`
	REUCode   *string `json:"reu_code,omitempty"`
	Contacts  *string `json:"contacts,omitempty"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

func (h *Handler) HandleSuppliers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listSuppliers(w, r)
	case http.MethodPost:
		h.createSupplier(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listSuppliers(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	if cid := r.URL.Query().Get("company_id"); cid != "" {
		companyID, _ = strconv.Atoi(cid)
	}
	suppliers, err := h.Queries.ListSuppliersByCompany(r.Context(), int64(companyID))
	if err != nil {
		log.Printf("[handlers/suppliers] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "failed to list suppliers")
		return
	}

	if suppliers == nil {
		suppliers = []db.ListSuppliersByCompanyRow{}
	}

	// Convert to supplierRow format
	var result []supplierRow
	for _, s := range suppliers {
		result = append(result, supplierRow{
			ID:        s.ID,
			Name:      s.Name,
			Address:   s.Address,
			REUCode:   s.ReuCode,
			Contacts:  s.Contacts,
			CreatedAt: s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	h.JSON(w, http.StatusOK, result)
}

type createSupplierRequest struct {
	Name     string `json:"name"`
	Address  string `json:"address"`
	REUCode  string `json:"reu_code"`
	Contacts string `json:"contacts"`
}

func (h *Handler) createSupplier(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	if cid := r.URL.Query().Get("company_id"); cid != "" {
		companyID, _ = strconv.Atoi(cid)
	}
	var req createSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	userID := h.getUserID(r)
	supplier, err := h.Queries.CreateSupplier(r.Context(), db.CreateSupplierParams{
		CompanyID: int64(companyID),
		Name:      req.Name,
		Address:   req.Address,
		REUCode:  req.REUCode,
		Contacts:  req.Contacts,
		CreatedBy: int64(userID),
	})
	if err != nil {
		log.Printf("[handlers/suppliers] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}
	h.auditLog(r, userID, companyID, "create", "supplier", &supplier.ID, nil, map[string]interface{}{
		"id":       supplier.ID,
		"name":     req.Name,
		"address":  req.Address,
		"reu_code": req.REUCode,
		"contacts": req.Contacts,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": supplier.ID, "status": "created"})
}

func (h *Handler) HandleSupplierByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/suppliers/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("[handlers/suppliers] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getSupplier(w, r, id)
	case http.MethodPut:
		h.updateSupplier(w, r, id)
	case http.MethodDelete:
		h.deleteSupplier(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getSupplier(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	supplier, err := h.Queries.GetSupplierByIDWithCompany(r.Context(), db.GetSupplierByIDWithCompanyParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "READ", "supplier", &id, nil, nil)
	h.JSON(w, http.StatusOK, supplier)
}

func (h *Handler) updateSupplier(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Fetch previous state
	prevSupplier, err := h.Queries.GetSupplierByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}

	_, err = h.Queries.UpdateSupplier(r.Context(), db.UpdateSupplierParams{
		Name:      req.Name,
		Address:   req.Address,
		REUCode:   req.REUCode,
		Contacts:  req.Contacts,
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplier")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "update", "supplier", &id, map[string]interface{}{
		"id":       id,
		"name":     prevSupplier.Name,
		"address":  prevSupplier.Address,
		"reu_code": prevSupplier.REUCode,
		"contacts": prevSupplier.Contacts,
	}, map[string]interface{}{
		"id":       id,
		"name":     req.Name,
		"address":  req.Address,
		"reu_code": req.REUCode,
		"contacts": req.Contacts,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteSupplier(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	prevSupplier, err := h.Queries.GetSupplierByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}

	_, err = h.Queries.DeleteSupplier(r.Context(), db.DeleteSupplierParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete supplier")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "delete", "supplier", &id, map[string]interface{}{
		"id":   id,
		"name": prevSupplier.Name,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
