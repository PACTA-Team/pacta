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
		h.getContract(w, id)
	case http.MethodPut:
		h.updateContract(w, r, id)
	case http.MethodDelete:
		h.deleteContract(w, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

type contractRow struct {
	ID               int       `json:"id"`
	InternalID       string    `json:"internal_id"`
	ContractNumber   string    `json:"contract_number"`
	Title            string    `json:"title"`
	ClientID         int       `json:"client_id"`
	SupplierID       int       `json:"supplier_id"`
	StartDate        string    `json:"start_date"`
	EndDate          string    `json:"end_date"`
	Amount           float64   `json:"amount"`
	Type             string    `json:"type"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (h *Handler) listContracts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, internal_id, contract_number, title, client_id, supplier_id,
		       start_date, end_date, amount, type, status, created_at, updated_at
		FROM contracts WHERE deleted_at IS NULL ORDER BY created_at DESC
	`)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var contracts []contractRow
	for rows.Next() {
		var c contractRow
		if err := rows.Scan(&c.ID, &c.InternalID, &c.ContractNumber, &c.Title, &c.ClientID, &c.SupplierID,
			&c.StartDate, &c.EndDate, &c.Amount, &c.Type, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			h.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		contracts = append(contracts, c)
	}
	if contracts == nil {
		contracts = []contractRow{}
	}
	h.JSON(w, http.StatusOK, contracts)
}

type createContractRequest struct {
	ContractNumber   string  `json:"contract_number"`
	Title            string  `json:"title"`
	ClientID         int     `json:"client_id"`
	SupplierID       int     `json:"supplier_id"`
	ClientSignerID   *int    `json:"client_signer_id"`
	SupplierSignerID *int    `json:"supplier_signer_id"`
	StartDate        string  `json:"start_date"`
	EndDate          string  `json:"end_date"`
	Amount           float64 `json:"amount"`
	Type             string  `json:"type"`
	Status           string  `json:"status"`
	Description      *string `json:"description"`
}

func (h *Handler) generateInternalID() (string, error) {
	year := time.Now().Year()
	var maxNum sql.NullInt64
	err := h.DB.QueryRow(`
		SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))
		FROM contracts
		WHERE internal_id LIKE 'CNT-' || ? || '-%'
	`, year).Scan(&maxNum)
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

	internalID, err := h.generateInternalID()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate internal ID")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(`
		INSERT INTO contracts (internal_id, contract_number, title, client_id, supplier_id,
			client_signer_id, supplier_signer_id, start_date, end_date, amount,
			type, status, description, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, internalID, req.ContractNumber, req.Title, req.ClientID, req.SupplierID,
		req.ClientSignerID, req.SupplierSignerID, req.StartDate, req.EndDate,
		req.Amount, req.Type, req.Status, req.Description, userID)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: contracts.contract_number") {
			h.Error(w, http.StatusConflict, "contract number '"+req.ContractNumber+"' already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to create contract")
		return
	}
	id, _ := result.LastInsertId()
	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"internal_id": internalID,
		"status":      "created",
	})
}

func (h *Handler) getContract(w http.ResponseWriter, id int) {
	var c contractRow
	err := h.DB.QueryRow(`
		SELECT id, internal_id, contract_number, title, client_id, supplier_id,
		       start_date, end_date, amount, type, status, created_at, updated_at
		FROM contracts WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&c.ID, &c.InternalID, &c.ContractNumber, &c.Title, &c.ClientID, &c.SupplierID,
		&c.StartDate, &c.EndDate, &c.Amount, &c.Type, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "contract not found")
		return
	}
	h.JSON(w, http.StatusOK, c)
}

func (h *Handler) updateContract(w http.ResponseWriter, r *http.Request, id int) {
	var req createContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.DB.Exec(`
		UPDATE contracts SET title=?, client_id=?, supplier_id=?,
			client_signer_id=?, supplier_signer_id=?, start_date=?, end_date=?,
			amount=?, type=?, status=?, description=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, req.Title, req.ClientID, req.SupplierID, req.ClientSignerID, req.SupplierSignerID,
		req.StartDate, req.EndDate, req.Amount, req.Type, req.Status, req.Description, id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteContract(w http.ResponseWriter, id int) {
	_, err := h.DB.Exec("UPDATE contracts SET deleted_at=CURRENT_TIMESTAMP WHERE id=?", id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
