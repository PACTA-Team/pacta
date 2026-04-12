package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type clientRow struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Address   *string `json:"address,omitempty"`
	REUCode   *string `json:"reu_code,omitempty"`
	Contacts  *string `json:"contacts,omitempty"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

func (h *Handler) HandleClients(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listClients(w, r)
	case http.MethodPost:
		h.createClient(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listClients(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	rows, err := h.DB.Query(`
		SELECT id, name, address, reu_code, contacts, created_at, updated_at
		FROM clients WHERE deleted_at IS NULL AND company_id = ? ORDER BY name
	`, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var clients []clientRow
	for rows.Next() {
		var c clientRow
		rows.Scan(&c.ID, &c.Name, &c.Address, &c.REUCode, &c.Contacts, &c.CreatedAt, &c.UpdatedAt)
		clients = append(clients, c)
	}
	if clients == nil {
		clients = []clientRow{}
	}
	h.JSON(w, http.StatusOK, clients)
}

type createClientRequest struct {
	Name     string `json:"name"`
	Address  string `json:"address"`
	REUCode  string `json:"reu_code"`
	Contacts string `json:"contacts"`
}

func (h *Handler) createClient(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	var req createClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	userID := h.getUserID(r)
	result, err := h.DB.Exec(
		"INSERT INTO clients (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		req.Name, req.Address, req.REUCode, req.Contacts, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	id64, _ := result.LastInsertId()
	id := int(id64)
	h.auditLog(r, userID, companyID, "create", "client", &id, nil, map[string]interface{}{
		"id":       id,
		"name":     req.Name,
		"address":  req.Address,
		"reu_code": req.REUCode,
		"contacts": req.Contacts,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}

func (h *Handler) HandleClientByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/clients/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getClient(w, r, id)
	case http.MethodPut:
		h.updateClient(w, r, id)
	case http.MethodDelete:
		h.deleteClient(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getClient(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var c clientRow
	err := h.DB.QueryRow(`
		SELECT id, name, address, reu_code, contacts, created_at, updated_at
		FROM clients WHERE id = ? AND deleted_at IS NULL AND company_id = ?
	`, id, companyID).Scan(&c.ID, &c.Name, &c.Address, &c.REUCode, &c.Contacts, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}
	h.JSON(w, http.StatusOK, c)
}

func (h *Handler) updateClient(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	// Fetch previous state
	var prevName, prevAddress, prevREUCode, prevContacts string
	err := h.DB.QueryRow("SELECT name, address, reu_code, contacts FROM clients WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&prevName, &prevAddress, &prevREUCode, &prevContacts)
	if err != nil {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}

	result, err := h.DB.Exec(`
		UPDATE clients SET name=?, address=?, reu_code=?, contacts=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL AND company_id = ?
	`, req.Name, req.Address, req.REUCode, req.Contacts, id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update client")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "update", "client", &id, map[string]interface{}{
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

func (h *Handler) deleteClient(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var prevName string
	err := h.DB.QueryRow("SELECT name FROM clients WHERE id = ? AND deleted_at IS NULL AND company_id = ?", id, companyID).Scan(&prevName)
	if err != nil {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}
	result, err := h.DB.Exec(
		"UPDATE clients SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND company_id = ?",
		id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete client")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}
	h.auditLog(r, h.getUserID(r), companyID, "delete", "client", &id, map[string]interface{}{
		"id":   id,
		"name": prevName,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
