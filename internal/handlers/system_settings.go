package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/db"
)

// GetSetting retrieves a single setting by key, returns defaultValue if not found
func (h *Handler) GetSetting(key string, defaultValue string) string {
	value, err := h.Queries.GetSettingValue(context.Background(), key)
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

	settings, err := h.Queries.GetAllSettings(context.Background())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if settings == nil {
		settings = []db.SystemSetting{}
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
		err := h.Queries.UpdateSettingValue(context.Background(), db.UpdateSettingValueParams{
			Key:       s.Key,
			Value:     value,
			UpdatedBy: int64(userID),
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	h.GetSystemSettings(w, r)
}