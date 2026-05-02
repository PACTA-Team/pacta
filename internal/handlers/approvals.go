package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type PendingApproval struct {
	ID             int       `json:"id"`
	UserID         int       `json:"user_id"`
	UserName       string    `json:"user_name"`
	UserEmail      string    `json:"user_email"`
	CompanyName   string    `json:"company_name"`
	CompanyID     *int      `json:"company_id,omitempty"`
	RequestedRole string    `json:"requested_role"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// PendingActivation represents a pending user activation from setup wizard
type PendingActivation struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	UserName      string    `json:"user_name"`
	UserEmail     string    `json:"user_email"`
	CompanyName   string    `json:"company_name"`
	CompanyID     *int      `json:"company_id,omitempty"`
	RoleAtCompany string    `json:"role_at_company"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
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

// listPendingActivations handles GET for pending activations
func (h *Handler) listPendingActivations(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Queries.ListPendingActivations(r.Context())
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list pending activations")
		return
	}
	defer rows.Close()

	var activations []PendingActivation
	for rows.Next() {
		var a PendingActivation
		rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.UserEmail, &a.CompanyName, &a.CompanyID, &a.RoleAtCompany, &a.Status, &a.CreatedAt)
		activations = append(activations, a)
	}
	if activations == nil {
		activations = []PendingActivation{}
	}

	h.JSON(w, http.StatusOK, activations)
}

func (h *Handler) listPendingApprovals(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Queries.ListPendingApprovals(r.Context())
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list approvals")
		return
	}
	defer rows.Close()

	var approvals []PendingApproval
	for rows.Next() {
		var a PendingApproval
		rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.UserEmail, &a.CompanyName, &a.CompanyID, &a.RequestedRole, &a.Status, &a.CreatedAt)
		approvals = append(approvals, a)
	}
	if approvals == nil {
		approvals = []PendingApproval{}
	}

	h.JSON(w, http.StatusOK, approvals)
}

// HandlePendingActivations handles GET /api/activations/pending
func (h *Handler) HandlePendingActivations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	h.listPendingActivations(w, r)
}

type ApprovalRequest struct {
	ApprovalID int    `json:"approval_id"`
	Action     string `json:"action"`
	CompanyID  *int   `json:"company_id,omitempty"`
	Role       string `json:"role,omitempty"`
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
	row, err := h.Queries.GetPendingApprovalUser(r.Context(), req.ApprovalID)
	if err != nil {
		h.Error(w, http.StatusNotFound, "approval not found")
		return
	}
	userID = int(row.UserID)
	companyName = row.CompanyName

	if req.Action == "approve" {
		companyID := 0
		if req.CompanyID != nil && *req.CompanyID > 0 {
			companyID = *req.CompanyID
		} else {
			company, err := h.Queries.CreateCompanySimple(r.Context(), db.CreateCompanySimpleParams{
				Name:        companyName,
				CompanyType: "client",
			})
			if err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to create company")
				return
			}
			companyID = int(company.ID)
		}

		// Default role is viewer if not specified
		role := "viewer"
		if req.Role != "" {
			role = req.Role
		}

		// Activate user and set their role
		_, err = h.Queries.UpdateUserStatusAndRole(r.Context(), db.UpdateUserStatusAndRoleParams{
			Status: role,
			ID:     int64(userID),
			Role:   role,
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to activate user")
			return
		}

		h.Queries.CreateUserCompany(r.Context(), db.CreateUserCompanyParams{
			UserID:    int64(userID),
			CompanyID: int64(companyID),
			IsDefault: 1,
		})

		h.Queries.ApprovePendingApproval(r.Context(), db.ApprovePendingApprovalParams{
			ID:         int64(req.ApprovalID),
			ReviewedBy: int64(adminID),
			ReviewedAt: time.Now(),
			CompanyID:  int64(companyID),
			Notes:      sql.NullString{String: req.Notes, Valid: req.Notes != ""},
		})

		h.JSON(w, http.StatusOK, map[string]string{"status": "approved"})
		return
	}

	if req.Action == "reject" {
		h.Queries.UpdateUserStatus(r.Context(), db.UpdateUserStatusParams{
			Status: "inactive",
			ID:     int64(userID),
		})
		h.Queries.RejectPendingApproval(r.Context(), db.RejectPendingApprovalParams{
			ID:         int64(req.ApprovalID),
			ReviewedBy: int64(adminID),
			ReviewedAt: time.Now(),
			Notes:      sql.NullString{String: req.Notes, Valid: req.Notes != ""},
		})

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
	h.Queries.GetUserCompanyAccess(r.Context(), db.GetUserCompanyAccessParams{
		UserID:    int64(userID),
		CompanyID: int64(req.CompanyID),
	})

	var err2 error
	if existing > 0 {
		_, err2 = h.Queries.UpdateUserCompany(r.Context(), db.UpdateUserCompanyParams{
			UserID:    int64(userID),
			CompanyID: int64(req.CompanyID),
		})
	} else {
		_, err2 = h.Queries.CreateUserCompany(r.Context(), db.CreateUserCompanyParams{
			UserID:    int64(userID),
			CompanyID: int64(req.CompanyID),
			IsDefault: 1,
		})
	}

	if err2 != nil {
		h.Error(w, http.StatusInternalServerError, "failed to assign company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
