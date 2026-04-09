package handlers

import (
	"encoding/json"
	"net/http"
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
	rows, err := h.DB.Query(`
		SELECT id, name, address, reu_code, contacts, created_at, updated_at
		FROM suppliers WHERE deleted_at IS NULL ORDER BY name
	`)
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
	var req createSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	userID := h.getUserID(r)
	result, err := h.DB.Exec(
		"INSERT INTO suppliers (name, address, reu_code, contacts, created_by) VALUES (?, ?, ?, ?, ?)",
		req.Name, req.Address, req.REUCode, req.Contacts, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	id, _ := result.LastInsertId()
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}
