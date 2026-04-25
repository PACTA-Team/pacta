package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type supplierRow struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
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
	rows, err := h.DB.Query(`
		SELECT id, name, address, reu_code, contacts, created_at, updated_at
		FROM suppliers WHERE deleted_at IS NULL AND company_id = ? ORDER BY name
	`, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var suppliers []supplierRow
	for rows.Next() {
		var s supplierRow
		rows.Scan(&s.ID, &s.Name, &s.Address, &s.REUCode, &s.Contacts, &s.CreatedAt, &s.UpdatedAt)
		suppliers = append(suppliers, s)
	}
	if suppliers == nil {
		suppliers = []supplierRow{}
	}
	h.JSON(w, http.StatusOK, suppliers)
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
	result, err := h.DB.Exec(
		"INSERT INTO suppliers (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		req.Name, req.Address, req.REUCode, req.Contacts, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	id64, _ := result.LastInsertId()
	id := int(id64)
	h.auditLog(r, userID, companyID, "create", "supplier", &id, nil, map[string]interface{}{
		"id":       id,
		"name":     req.Name,
		"address":  req.Address,
		"reu_code": req.REUCode,
		"contacts": req.Contacts,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}

func (h *Handler) HandleSupplierByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/suppliers/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
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
	var s supplierRow
	err := h.DB.QueryRow(`
		SELECT id, name, address, reu_code, contacts, created_at, updated_at
		FROM suppliers WHERE id = ? AND deleted_at IS NULL AND company_id = ?
	`, id, companyID).Scan(&s.ID, &s.Name, &s.Address, &s.REUCode, &s.Contacts, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "READ", "supplier", &id, nil, nil, map[string]interface{}{
		"supplier_id": id,
	})
	h.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSupplier(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	// Fetch previous state
	var prevName, prevAddress, prevREUCode, prevContacts string
	err := h.DB.QueryRow("SELECT name, address, reu_code, contacts FROM suppliers WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&prevName, &prevAddress, &prevREUCode, &prevContacts)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}

	result, err := h.DB.Exec(`
		UPDATE suppliers SET name=?, address=?, reu_code=?, contacts=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL AND company_id = ?
	`, req.Name, req.Address, req.REUCode, req.Contacts, id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplier")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "update", "supplier", &id, map[string]interface{}{
		"id":       id,
		"name":     prevName,
		"address":  prevAddress,
		"reu_code": prevREUCode,
		"contacts": prevContacts,
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
	var prevName string
	err := h.DB.QueryRow("SELECT name FROM suppliers WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&prevName)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}
	result, err := h.DB.Exec(
		"UPDATE suppliers SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND company_id = ?",
		id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete supplier")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "supplier not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "delete", "supplier", &id, map[string]interface{}{
		"id":   id,
		"name": prevName,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
