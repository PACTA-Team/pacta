package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type PendingApproval struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	UserName    string    `json:"user_name"`
	UserEmail   string    `json:"user_email"`
	CompanyName string    `json:"company_name"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *Handler) HandlePendingApprovals(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listPendingApprovals(w, r)
	case http.MethodPost:
		h.approveOrReject(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listPendingApprovals(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT pa.id, pa.user_id, u.name, u.email, pa.company_name, pa.status, pa.created_at
		FROM pending_approvals pa
		JOIN users u ON u.id = pa.user_id
		WHERE pa.status = 'pending' AND u.deleted_at IS NULL
		ORDER BY pa.created_at DESC
	`)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list approvals")
		return
	}
	defer rows.Close()

	var approvals []PendingApproval
	for rows.Next() {
		var a PendingApproval
		rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.UserEmail, &a.CompanyName, &a.Status, &a.CreatedAt)
		approvals = append(approvals, a)
	}
	if approvals == nil {
		approvals = []PendingApproval{}
	}

	h.JSON(w, http.StatusOK, approvals)
}

type ApprovalRequest struct {
	ApprovalID int    `json:"approval_id"`
	Action     string `json:"action"`
	CompanyID  *int   `json:"company_id,omitempty"`
	Notes      string `json:"notes,omitempty"`
}

func (h *Handler) approveOrReject(w http.ResponseWriter, r *http.Request) {
	var req ApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	adminID := h.getUserID(r)

	var userID int
	var companyName string
	err := h.DB.QueryRow("SELECT user_id, company_name FROM pending_approvals WHERE id = ? AND status = 'pending'", req.ApprovalID).Scan(&userID, &companyName)
	if err != nil {
		h.Error(w, http.StatusNotFound, "approval not found")
		return
	}

	if req.Action == "approve" {
		companyID := 0
		if req.CompanyID != nil && *req.CompanyID > 0 {
			companyID = *req.CompanyID
		} else {
			result, err := h.DB.Exec("INSERT INTO companies (name, company_type) VALUES (?, ?)", companyName, "client")
			if err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to create company")
				return
			}
			id64, _ := result.LastInsertId()
			companyID = int(id64)
		}

		_, err = h.DB.Exec("UPDATE users SET status = 'active' WHERE id = ?", userID)
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to activate user")
			return
		}

		h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", userID, companyID)

		h.DB.Exec("UPDATE pending_approvals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, company_id = ?, notes = ? WHERE id = ?",
			adminID, time.Now(), companyID, req.Notes, req.ApprovalID)

		h.JSON(w, http.StatusOK, map[string]string{"status": "approved"})
		return
	}

	if req.Action == "reject" {
		h.DB.Exec("UPDATE users SET status = 'inactive' WHERE id = ?", userID)
		h.DB.Exec("UPDATE pending_approvals SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, notes = ? WHERE id = ?",
			adminID, time.Now(), req.Notes, req.ApprovalID)

		h.JSON(w, http.StatusOK, map[string]string{"status": "rejected"})
		return
	}

	h.Error(w, http.StatusBadRequest, "invalid action")
}

func (h *Handler) HandleUserCompany(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/users/"), "/")
	if len(pathParts) < 2 {
		h.Error(w, http.StatusBadRequest, "invalid path")
		return
	}
	userID, err := strconv.Atoi(pathParts[0])
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	var req struct {
		CompanyID int `json:"company_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	var existing int
	h.DB.QueryRow("SELECT COUNT(*) FROM user_companies WHERE user_id = ?", userID).Scan(&existing)

	var err2 error
	if existing > 0 {
		_, err2 = h.DB.Exec("UPDATE user_companies SET company_id = ?, is_default = 1 WHERE user_id = ?", req.CompanyID, userID)
	} else {
		_, err2 = h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", userID, req.CompanyID)
	}

	if err2 != nil {
		h.Error(w, http.StatusInternalServerError, "failed to assign company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
