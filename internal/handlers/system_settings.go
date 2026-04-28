package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/models"
)

// GetSetting retrieves a single setting by key, returns defaultValue if not found
func (h *Handler) GetSetting(key string, defaultValue string) string {
	var value string
	err := h.DB.QueryRow("SELECT value FROM system_settings WHERE key = ?", key).Scan(&value)
	if err != nil || value == "" {
		// Fallback to environment variable
		if envValue := os.Getenv(strings.ToUpper(key)); envValue != "" {
			return envValue
		}
		return defaultValue
	}
	return value
}

// GetSettingBool retrieves a boolean setting
func (h *Handler) GetSettingBool(key string, defaultValue bool) bool {
	value := h.GetSetting(key, "")
	if value == "" {
		return defaultValue
	}
	return value == "true"
}

func (h *Handler) GetSystemSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.DB.Query("SELECT id, key, value, category, updated_by, updated_at FROM system_settings ORDER BY category, key")
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
		value := s.Value
		// Encrypt AI API key if present
		if s.Key == "ai_api_key" && value != "" {
			encrypted, err := ai.EncryptAPIKey(value)
			if err != nil {
				h.Error(w, http.StatusBadRequest, "failed to encrypt API key: "+err.Error())
				return
			}
			value = encrypted
		}
		_, err := h.DB.Exec(
			"UPDATE system_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
			value, userID, s.Key,
		)
		if err != nil {
			h.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	h.GetSystemSettings(w, r)
}