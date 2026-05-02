package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type NotificationSettings struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	CompanyID  int       `json:"company_id"`
	Enabled    bool      `json:"enabled"`
	Thresholds string    `json:"thresholds"`
	Recipients string    `json:"recipients"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (h *Handler) HandleNotificationSettings(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	switch r.Method {
	case http.MethodGet:
		h.getNotificationSettings(w, r, userID, companyID)
	case http.MethodPut:
		h.updateNotificationSettings(w, r, userID, companyID)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getNotificationSettings(w http.ResponseWriter, r *http.Request, userID, companyID int) {
	settings, err := h.Queries.GetNotificationSettings(r.Context(), db.GetNotificationSettingsParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			// Return defaults if no settings exist
			h.JSON(w, http.StatusOK, map[string]interface{}{
				"enabled":    true,
				"thresholds": []int{7, 14, 30},
				"recipients": []string{},
			})
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to get settings")
		return
	}

	s := NotificationSettings{
		ID:        int(settings.ID),
		UserID:    int(settings.UserID),
		CompanyID: int(settings.CompanyID),
		Enabled:   settings.Enabled,
		Thresholds: settings.Thresholds,
		Recipients: settings.Recipients,
		CreatedAt: settings.CreatedAt,
		UpdatedAt: settings.UpdatedAt,
	}
	h.JSON(w, http.StatusOK, s)
}

type updateSettingsRequest struct {
	Enabled    *bool     `json:"enabled"`
	Thresholds *[]int    `json:"thresholds"`
	Recipients *[]string `json:"recipients"`
}

func (h *Handler) updateNotificationSettings(w http.ResponseWriter, r *http.Request, userID, companyID int) {
	var req updateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	thresholds := "[7,14,30]"
	if req.Thresholds != nil {
		b, _ := json.Marshal(req.Thresholds)
		thresholds = string(b)
	}

	recipients := "[]"
	if req.Recipients != nil {
		b, _ := json.Marshal(req.Recipients)
		recipients = string(b)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	err := h.Queries.UpsertNotificationSettings(r.Context(), db.UpsertNotificationSettingsParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
		Enabled:   enabled,
		Thresholds: thresholds,
		Recipients: recipients,
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update settings")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
