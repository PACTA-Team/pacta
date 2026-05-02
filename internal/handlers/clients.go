package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/PACTA-Team/pacta/internal/db"
)

type clientRow struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
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
	if cid := r.URL.Query().Get("company_id"); cid != "" {
		companyID, _ = strconv.Atoi(cid)
	}
	clients, err := h.Queries.ListClientsByCompany(r.Context(), int64(companyID))
	if err != nil {
		log.Printf("[handlers/clients] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	if clients == nil {
		clients = []db.ListClientsByCompanyRow{}
	}

	// Convert to clientRow format
	var result []clientRow
	for _, c := range clients {
		result = append(result, clientRow{
			ID:        c.ID,
			Name:      c.Name,
			Address:   c.Address,
			REUCode:   c.ReuCode,
			Contacts:  c.Contacts,
			CreatedAt: c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	h.JSON(w, http.StatusOK, result)
}

type createClientRequest struct {
	Name    string `json:"name"`
	Address  string `json:"address"`
	REUCode  string `json:"reu_code"`
	Contacts string `json:"contacts"`
}

func (h *Handler) createClient(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	if cid := r.URL.Query().Get("company_id"); cid != "" {
		companyID, _ = strconv.Atoi(cid)
	}
	var req createClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	userID := h.getUserID(r)
	client, err := h.Queries.CreateClient(r.Context(), db.CreateClientParams{
		CompanyID: int64(companyID),
		Name:      req.Name,
		Address:   req.Address,
		REUCode:  req.REUCode,
		Contacts:  req.Contacts,
		CreatedBy: int64(userID),
	})
	if err != nil {
		log.Printf("[handlers/clients] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}
	h.auditLog(r, userID, companyID, "create", "client", &client.ID, nil, map[string]interface{}{
		"id":       client.ID,
		"name":     req.Name,
		"address":  req.Address,
		"reu_code": req.REUCode,
		"contacts": req.Contacts,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": client.ID, "status": "created"})
}

func (h *Handler) HandleClientByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/clients/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Printf("[handlers/clients] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
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
	client, err := h.Queries.GetClientByIDWithCompany(r.Context(), db.GetClientByIDWithCompanyParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}
	h.JSON(w, http.StatusOK, client)
}

func (h *Handler) updateClient(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var req createClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Fetch previous state
	prevClient, err := h.Queries.GetClientByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}

	_, err = h.Queries.UpdateClient(r.Context(), db.UpdateClientParams{
		Name:      req.Name,
		Address:   req.Address,
		REUCode:   req.REUCode,
		Contacts:  req.Contacts,
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		log.Printf("[handlers/clients] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "update", "client", &id, map[string]interface{}{
		"id":       id,
		"name":     prevClient.Name,
		"address":  prevClient.Address,
		"reu_code": prevClient.REUCode,
		"contacts": prevClient.Contacts,
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
	prevClient, err := h.Queries.GetClientByID(r.Context(), int64(id))
	if err != nil {
		h.Error(w, http.StatusNotFound, "client not found")
		return
	}

	_, err = h.Queries.DeleteClient(r.Context(), db.DeleteClientParams{
		ID:        int64(id),
		CompanyID: int64(companyID),
	})
	if err != nil {
		log.Printf("[handlers/clients] ERROR: %v", err)
		h.Error(w, http.StatusInternalServerError, "internal server error")
		return
	}

	h.auditLog(r, h.getUserID(r), companyID, "delete", "client", &id, map[string]interface{}{
		"id":   id,
		"name": prevClient.Name,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
