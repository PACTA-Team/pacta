package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
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

	// Validate client and supplier IDs
	if req.ClientID <= 0 || req.SupplierID <= 0 {
		h.Error(w, http.StatusBadRequest, "client_id and supplier_id must be positive integers")
		return
	}

	// Validate amount
	if req.Amount <= 0 {
		h.Error(w, http.StatusBadRequest, "amount must be greater than zero")
		return
	}

	// Validate date order (YYYY-MM-DD format allows string comparison)
	if req.StartDate >= req.EndDate {
		h.Error(w, http.StatusBadRequest, "start_date must be before end_date")
		return
	}

	// Validate description length to prevent abuse
	if len(req.Description) > 10000 {
		h.Error(w, http.StatusBadRequest, "description too long (max 10000 characters)")
		return
	}

	// Get company ID for rate limiting and RAG
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		h.Error(w, http.StatusForbidden, "no company assigned")
		return
	}

	// Check rate limit
	remaining, ok := h.RateLimiter.Allow(companyID)
	if !ok {
		w.Header().Set("X-RateLimit-Remaining", "0")
		h.Error(w, http.StatusTooManyRequests, "daily AI request limit reached (100/day)")
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
	similar, err := retriever.GetSimilarContracts(companyID, req.ContractType, req.ClientID, req.SupplierID, 3)
	if err != nil {
		log.Printf("[AI] RAG warning: %v", err)
		// Continue without RAG context
	}
	context := ai.BuildRAGContext(similar)

	// Build prompt
	prompt := ai.BuildContractPrompt(req, context)

	// Call LLM
	client := h.LLMClient
	if client == nil {
		client = ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
	}
	response, err := client.Generate(ctx, prompt, context)
	if err != nil {
		log.Printf("[AI] Generation failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "AI generation failed. Please check your API key and try again.")
		return
	}

	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.success(w, http.StatusOK, ai.GenerateResponse{Text: response})
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

	// Get company ID for rate limiting
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		h.Error(w, http.StatusForbidden, "no company assigned")
		return
	}

	// Check rate limit
	remaining, ok := h.RateLimiter.Allow(companyID)
	if !ok {
		w.Header().Set("X-RateLimit-Remaining", "0")
		h.Error(w, http.StatusTooManyRequests, "daily AI request limit reached (100/day)")
		return
	}

	// Get AI config
	provider, apiKey, model, endpoint, err := h.getAIConfig()
	if err != nil {
		log.Printf("[AI] Failed to get config: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get AI configuration")
		return
	}

	// Validate input: either text or document_url must be provided
	if req.Text == "" && req.DocumentURL == "" {
		h.Error(w, http.StatusBadRequest, "either text or document_url must be provided")
		return
	}

	contractText := req.Text

	// If document_url provided, fetch and extract text
	if req.DocumentURL != "" {
		// Create HTTP client with 10s timeout
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(req.DocumentURL)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "failed to fetch document: "+err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			h.Error(w, http.StatusBadRequest, "document fetch failed: HTTP "+strconv.Itoa(resp.StatusCode))
			return
		}

		// Check Content-Type – only PDF supported for now
		ct := resp.Header.Get("Content-Type")
		if ct != "application/pdf" {
			h.Error(w, http.StatusBadRequest, "only PDF documents are supported")
			return
		}

		// Limit size to 10MB (use io.LimitReader – the extractor also limits, but double-safe)
		limitedReader := io.LimitReader(resp.Body, 10<<20)
		extractedText, err := ai.ExtractTextFromPDF(limitedReader)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "failed to extract text from PDF: "+err.Error())
			return
		}
		contractText = extractedText
	}

	// Build prompt with contractText (not req.Text)
	prompt := ai.BuildReviewPrompt(contractText)

	// Call LLM
	client := h.LLMClient
	if client == nil {
		client = ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
	}
	response, err := client.Generate(ctx, prompt, "")
	if err != nil {
		log.Printf("[AI] Review failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "AI review failed. Please check your API key and try again.")
		return
	}

	// Parse the response into structured format
	reviewResp, err := ai.ParseReviewResponse(response)
	if err != nil {
		// Log and return a generic error — do not expose raw LLM output
		log.Printf("[AI] Parse error: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to parse AI response")
		return
	}

	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.success(w, http.StatusOK, reviewResp)
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
	client := h.LLMClient
	if client == nil {
		client = ai.NewLLMClient(ai.LLMProvider(req.Provider), req.APIKey, req.Model, req.Endpoint)
	}

	// Simple test prompt
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	_, err := client.Generate(ctx, "Say 'test successful' in Spanish.", "")
	if err != nil {
		h.Error(w, http.StatusBadGateway, "Connection failed: "+err.Error())
		return
	}

	h.success(w, http.StatusOK, map[string]string{"status": "success", "message": "Connection successful"})
}
