package handlers

import (
	"context"
	"encoding/json"
	"log"

	"github.com/PACTA-Team/pacta/internal/server/middleware"
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

	ip := middleware.GetClientIP(r)

	_, _ = h.Queries.CreateAuditLog(r.Context(), db.CreateAuditLogParams{
		UserID:      int64(userID),
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		PreviousState: prevJSON,
		NewState:    newJSON,
		IPAddress:   ip,
		CompanyID:   int64(companyID),
	})
}
