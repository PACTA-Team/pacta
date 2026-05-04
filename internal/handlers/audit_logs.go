package handlers

import (
	"context"
	"database/sql"
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

	// Build params for filtered query
	entityType := query.Get("entity_type")
	entityIDStr := query.Get("entity_id")
	userIDStr := query.Get("user_id")
	action := query.Get("action")

	entityID := 0
	if entityIDStr != "" {
		if id, err := strconv.Atoi(entityIDStr); err == nil {
			entityID = id
		}
	}
	userID := 0
	if userIDStr != "" {
		if id, err := strconv.Atoi(userIDStr); err == nil {
			userID = id
		}
	}

	var err error
	var logs []db.ListAuditLogsByFiltersRow

	if entityType == "" && entityID == 0 && userID == 0 && action == "" {
		// Simple case: no filters
		logs, err = h.Queries.ListAuditLogsByCompany(r.Context(), int64(companyID))
	} else {
		// Use filtered query
		logs, err = h.Queries.ListAuditLogsByFilters(r.Context(), db.ListAuditLogsByFiltersParams{
			CompanyID:  int64(companyID),
			EntityType: entityType,
			EntityID:   int64(entityID),
			UserID:     int64(userID),
			Action:     action,
		})
	}
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to query audit logs")
		return
	}

	if logs == nil {
		logs = []db.ListAuditLogsByFiltersRow{}
	}

	// Convert to auditLogRow format
	var result []auditLogRow
	for _, l := range logs {
		row := auditLogRow{
			ID:        int(l.ID),
			UserID:    &[]int{int(l.UserID)}[0],
			Action:    l.Action,
			EntityType: l.EntityType,
			EntityID:  &[]int{int(l.EntityID.Int64)}[0],
			IPAddress: &l.IPAddress.String,
			CreatedAt: l.CreatedAt,
		}
		if l.EntityID.Valid {
			id := int(l.EntityID.Int64)
			row.EntityID = &id
		}
		if l.PreviousState.Valid {
			s := l.PreviousState.String
			row.PreviousState = &s
		}
		if l.NewState.Valid {
			s := l.NewState.String
			row.NewState = &s
		}
		if l.UserID != 0 {
			row.UserID = &[]int{int(l.UserID)}[0]
		}
		result = append(result, row)
	}

	h.JSON(w, http.StatusOK, result)
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
	_, err := h.Queries.CreateAuditLog(r.Context(), db.CreateAuditLogParams{
		UserID:      int64(userID),
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		PreviousState: prevState,
		NewState:    newState,
		IPAddress:   ip,
		CompanyID:   int64(companyID),
	})
	if err != nil {
		log.Printf("[audit] ERROR inserting log: %v", err)
	}
}
