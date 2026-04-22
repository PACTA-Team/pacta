package handlers

import (
	"log"
	"net/http"
	"strconv"
	"time"
)

type auditLogRow struct {
	ID            int       `json:"id"`
	UserID        *int      `json:"user_id,omitempty"`
	Action        string    `json:"action"`
	EntityType    string    `json:"entity_type"`
	EntityID      *int      `json:"entity_id,omitempty"`
	PreviousState *string   `json:"previous_state,omitempty"`
	NewState      *string   `json:"new_state,omitempty"`
	IPAddress     *string   `json:"ip_address,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

func (h *Handler) HandleAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	companyID := h.GetCompanyID(r)
	query := r.URL.Query()

	// Build dynamic query with filters
	sql := `
		SELECT id, user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at
		FROM audit_logs WHERE company_id = ?
	`
	args := []interface{}{companyID}

	if entityType := query.Get("entity_type"); entityType != "" {
		sql += " AND entity_type = ?"
		args = append(args, entityType)
	}
	if entityID := query.Get("entity_id"); entityID != "" {
		if id, err := strconv.Atoi(entityID); err == nil {
			sql += " AND entity_id = ?"
			args = append(args, id)
		}
	}
	if userID := query.Get("user_id"); userID != "" {
		if id, err := strconv.Atoi(userID); err == nil {
			sql += " AND user_id = ?"
			args = append(args, id)
		}
	}
	if action := query.Get("action"); action != "" {
		sql += " AND action = ?"
		args = append(args, action)
	}

	sql += " ORDER BY created_at DESC LIMIT 100"

	rows, err := h.DB.Query(sql, args...)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to query audit logs")
		return
	}
	defer rows.Close()

	var logs []auditLogRow
	for rows.Next() {
		var l auditLogRow
		rows.Scan(&l.ID, &l.UserID, &l.Action, &l.EntityType, &l.EntityID, &l.PreviousState, &l.NewState, &l.IPAddress, &l.CreatedAt)
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []auditLogRow{}
	}
	h.JSON(w, http.StatusOK, logs)
}

func (h *Handler) InsertAuditLog(userID int, action, entityType string, entityID *int, prevState, newState *string, r *http.Request) {
	ip := ""
	if r != nil {
		ip = r.RemoteAddr
	}
	companyID := 0
	if r != nil {
		companyID = h.GetCompanyID(r)
	}
	_, err := h.DB.Exec(`
		INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at, company_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
	`, userID, action, entityType, entityID, prevState, newState, ip, companyID)
	if err != nil {
		log.Printf("[audit] ERROR inserting log: %v", err)
	}
}
