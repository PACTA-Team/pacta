package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/PACTA-Team/pacta/internal/models"
)

func (h *Handler) GetSystemSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.db.Query("SELECT id, key, value, category, updated_by, updated_at FROM system_settings ORDER BY category, key")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var settings []models.SystemSetting
	for rows.Next() {
		var s models.SystemSetting
		if err := rows.Scan(&s.ID, &s.Key, &s.Value, &s.Category, &s.UpdatedBy, &s.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		settings = append(settings, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

type UpdateSettingRequest struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func (h *Handler) UpdateSystemSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req []UpdateSettingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := h.getUserID(r)
	for _, s := range req {
		_, err := h.db.Exec(
			"UPDATE system_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
			s.Value, userID, s.Key,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	h.GetSystemSettings(w, r)
}