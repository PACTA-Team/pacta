package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"pacta/internal/ai"
)

// isAIConfigured checks if AI is configured in system settings
func (h *Handler) isAIConfigured() bool {
	var provider, apiKey string

	// Check provider
	err := h.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'ai_provider' AND deleted_at IS NULL").Scan(&provider)
	if err != nil || provider == "" {
		return false
	}

	// Check API key (encrypted)
	err = h.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'ai_api_key' AND deleted_at IS NULL").Scan(&apiKey)
	if err != nil || apiKey == "" {
		return false
	}

	return true
}

// getAIConfig retrieves AI configuration from system settings
func (h *Handler) getAIConfig() (provider, apiKey, model, endpoint string, err error) {
	rows, err := h.DB.Query(`
		SELECT key, value FROM system_settings
		WHERE key IN ('ai_provider', 'ai_api_key', 'ai_model', 'ai_endpoint')
		  AND deleted_at IS NULL
	`)
	if err != nil {
		return "", "", "", "", err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		settings[key] = value
	}

	provider = settings["ai_provider"]

	// Decrypt API key
	encryptedKey := settings["ai_api_key"]
	if encryptedKey != "" {
		apiKey, err = ai.DecryptAPIKey(encryptedKey)
		if err != nil {
			return "", "", "", "", fmt.Errorf("failed to decrypt API key: %w", err)
		}
	}

	model = settings["ai_model"]
	endpoint = settings["ai_endpoint"]

	return provider, apiKey, model, endpoint, nil
}

// HandleAI is the main router for AI endpoints
func (h *Handler) HandleAI(w http.ResponseWriter, r *http.Request) {
	if !h.isAIConfigured() {
		h.Error(w, http.StatusServiceUnavailable, "AI not configured. Please configure in Settings.")
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/ai")

	switch {
	case path == "/generate-contract" && r.Method == http.MethodPost:
		h.HandleAIGenerateContract(w, r)
	case path == "/review-contract" && r.Method == http.MethodPost:
		h.HandleAIReviewContract(w, r)
	case path == "/test" && r.Method == http.MethodPost:
		h.HandleAITestConnection(w, r)
	default:
		h.Error(w, http.StatusNotFound, "AI endpoint not found")
	}
}

// HandleAIGenerateContract handles contract generation requests
func (h *Handler) HandleAIGenerateContract(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var req ai.GenerateContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.ContractType == "" || req.Amount == 0 || req.StartDate == "" || req.EndDate == "" {
		h.Error(w, http.StatusBadRequest, "Missing required fields")
		return
	}

	// Get AI config
	provider, apiKey, model, endpoint, err := h.getAIConfig()
	if err != nil {
		log.Printf("[AI] Failed to get config: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get AI configuration")
		return
	}

	// Get RAG context
	retriever := ai.NewContractRetriever(h.DB)
	similar, _ := retriever.GetSimilarContracts(req.ContractType, req.ClientID, req.SupplierID, 3)
	context := ai.BuildRAGContext(similar)

	// Build prompt
	prompt := ai.BuildContractPrompt(req, context)

	// Call LLM
	client := ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
	response, err := client.Generate(ctx, prompt, context)
	if err != nil {
		log.Printf("[AI] Generation failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "AI generation failed. Please check your API key and try again.")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ai.GenerateResponse{Text: response})
}

// HandleAIReviewContract handles contract review requests
func (h *Handler) HandleAIReviewContract(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var req ai.ReviewContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get AI config
	provider, apiKey, model, endpoint, err := h.getAIConfig()
	if err != nil {
		log.Printf("[AI] Failed to get config: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get AI configuration")
		return
	}

	// TODO: Extract text from document if document_url is provided

	// Build prompt
	prompt := ai.BuildReviewPrompt(req.Text)

	// Call LLM
	client := ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
	response, err := client.Generate(ctx, prompt, "")
	if err != nil {
		log.Printf("[AI] Review failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "AI review failed. Please check your API key and try again.")
		return
	}

	// Parse the response into structured format
	reviewResp, err := ai.ParseReviewResponse(response)
	if err != nil {
		// Log but still return raw text with warning
		log.Printf("[AI] Parse error: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to parse AI structured response. Raw output shown.",
			"raw":   response,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviewResp)
}

// HandleAITestConnection tests the AI connection
func (h *Handler) HandleAITestConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider string `json:"provider"`
		APIKey   string `json:"api_key"`
		Model    string `json:"model"`
		Endpoint string `json:"endpoint"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Create temporary client and test
	client := ai.NewLLMClient(ai.LLMProvider(req.Provider), req.APIKey, req.Model, req.Endpoint)

	// Simple test prompt
	_, err := client.Generate(r.Context(), "Say 'test successful' in Spanish.", "")
	if err != nil {
		h.Error(w, http.StatusBadGateway, "Connection failed: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Connection successful"})
}
