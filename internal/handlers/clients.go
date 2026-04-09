package handlers

import (
	"encoding/json"
	"net/http"
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
	rows, err := h.DB.Query(`
		SELECT id, name, address, reu_code, contacts, created_at, updated_at
		FROM clients WHERE deleted_at IS NULL ORDER BY name
	`)
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
	var req createClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	userID := h.getUserID(r)
	result, err := h.DB.Exec(
		"INSERT INTO clients (name, address, reu_code, contacts, created_by) VALUES (?, ?, ?, ?, ?)",
		req.Name, req.Address, req.REUCode, req.Contacts, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	id, _ := result.LastInsertId()
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}
