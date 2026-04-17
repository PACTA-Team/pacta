package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/PACTA-Team/pacta/internal/config"
	"github.com/PACTA-Team/pacta/internal/models"
)

type ContractExpirySettingsHandler struct {
	cfg *config.Service
}

func NewContractExpirySettingsHandler(cfg *config.Service) *ContractExpirySettingsHandler {
	return &ContractExpirySettingsHandler{cfg: cfg}
}

// GET /api/admin/settings/notifications
func (h *ContractExpirySettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	// Admin-only check (middleware already ensures we have ctxUserRole)
	if r.Context().Value(ctxUserRole) != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var s models.ContractExpirySettings
	err := h.cfg.DB.QueryRow(`
		SELECT id, enabled, frequency_hours, thresholds_days, updated_by, updated_at
		FROM contract_expiry_notification_settings WHERE id = 1
	`).Scan(&s.ID, &s.Enabled, &s.FrequencyHours, &s.ThresholdsDays, &s.UpdatedBy, &s.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return defaults
			s = models.ContractExpirySettings{
				ID:             1,
				Enabled:        true,
				FrequencyHours: 6,
				ThresholdsDays: []int{30, 14, 7, 1},
			}
		} else {
			http.Error(w, "failed to load settings: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// PUT /api/admin/settings/notifications
func (h *ContractExpirySettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Context().Value(ctxUserRole) != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Enabled          bool    `json:"enabled"`
		FrequencyHours   int     `json:"frequency_hours"`
		ThresholdsDays   []int   `json:"thresholds_days"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// Validation
	if req.FrequencyHours < 1 || req.FrequencyHours > 168 {
		http.Error(w, "frequency_hours must be between 1 and 168", http.StatusBadRequest)
		return
	}
	if len(req.ThresholdsDays) == 0 {
		http.Error(w, "at least one threshold required", http.StatusBadRequest)
		return
	}
	// Validate each threshold
	seen := make(map[int]bool)
	for _, d := range req.ThresholdsDays {
		if d < 1 || d > 365 {
			http.Error(w, "threshold days must be between 1 and 365", http.StatusBadRequest)
			return
		}
		if seen[d] {
			http.Error(w, "duplicate threshold values not allowed", http.StatusBadRequest)
			return
		}
		seen[d] = true
	}

	// Get user ID from context
	userIDVal := r.Context().Value(ctxUserID)
	var userID *int64
	if userIDVal != nil {
		uid := userIDVal.(int)
		id := int64(uid)
		userID = &id
	}

	// Upsert singleton row (id=1)
	_, err := h.cfg.DB.Exec(`
		INSERT INTO contract_expiry_notification_settings (id, enabled, frequency_hours, thresholds_days, updated_by, updated_at)
		VALUES (1, ?, ?, ?, ?, NOW())
		ON CONFLICT (id) DO UPDATE SET
			enabled = excluded.enabled,
			frequency_hours = excluded.frequency_hours,
			thresholds_days = excluded.thresholds_days,
			updated_by = excluded.updated_by,
			updated_at = excluded.updated_at
	`, req.Enabled, req.FrequencyHours, req.ThresholdsDays, userID)

	if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
