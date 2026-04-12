package handlers

import (
	"encoding/json"
	"net/http"
)

// auditLog records an action to the audit trail.
// prevState and newState are optional; they are JSON-marshaled if non-nil.
// Failures are silent — audit logging must never break the primary operation.
func (h *Handler) auditLog(r *http.Request, userID int, companyID int, action, entityType string, entityID *int, prevState, newState interface{}) {
	var prevJSON, newJSON *string

	if prevState != nil {
		b, err := json.Marshal(prevState)
		if err == nil {
			s := string(b)
			prevJSON = &s
		}
	}
	if newState != nil {
		b, err := json.Marshal(newState)
		if err == nil {
			s := string(b)
			newJSON = &s
		}
	}

	ip := r.RemoteAddr

	_, _ = h.DB.Exec(`
		INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, company_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, action, entityType, entityID, prevJSON, newJSON, ip, companyID)
}
