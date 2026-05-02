package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/ai/hybrid"
	"github.com/PACTA-Team/pacta/internal/ai/legal"
	"github.com/PACTA-Team/pacta/internal/ai/minirag"
	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/models"
)

// isAIConfigured checks if AI is configured in system settings
func (h *Handler) isAIConfigured() bool {
	ctx := context.Background()

	// Check provider
	provider, err := h.Queries.GetBoolSetting(ctx, "ai_provider")
	if err != nil || provider == "" {
		return false
	}

	// Check API key (encrypted)
	apiKey, err := h.Queries.GetBoolSetting(ctx, "ai_api_key")
	if err != nil || apiKey == "" {
		return false
	}

	return true
}

// getAIConfig retrieves AI configuration from system settings
func (h *Handler) getAIConfig() (provider, apiKey, model, endpoint string, err error) {
	ctx := context.Background()

	keys := []string{"ai_provider", "ai_api_key", "ai_model", "ai_endpoint"}
	settingsMap := make(map[string]string)
	for _, key := range keys {
		val, err := h.Queries.GetSettingValue(ctx, key)
		if err != nil {
			return "", "", "", "", err
		}
		settingsMap[key] = val
	}

	provider = settingsMap["ai_provider"]

	// Decrypt API key
	encryptedKey := settingsMap["ai_api_key"]
	if encryptedKey != "" {
		apiKey, err = ai.DecryptAPIKey(encryptedKey)
		if err != nil {
			return "", "", "", "", fmt.Errorf("failed to decrypt API key: %w", err)
		}
	}

	model = settingsMap["ai_model"]
	endpoint = settingsMap["ai_endpoint"]

	return provider, apiKey, model, endpoint, nil
}

// isRAGLocalConfigured checks if local RAG is configured and ready
func (h *Handler) isRAGLocalConfigured() bool {
	ctx := context.Background()
	
	ragMode, err := h.Queries.GetBoolSetting(ctx, "rag_mode")
	if err != nil || (ragMode != "local" && ragMode != "hybrid") {
		return false
	}
	
	localModel, err := h.Queries.GetBoolSetting(ctx, "local_model")
	if err != nil {
		return false
	}
	if localModel == "" {
		return false
	}
	
	embeddingModel, err := h.Queries.GetBoolSetting(ctx, "embedding_model")
	if err != nil {
		return false
	}
	if embeddingModel == "" {
		return false
	}
	
	return true
}

// getRAGConfig retrieves RAG configuration from system settings
func (h *Handler) getRAGConfig() (mode, localMode, localModel, embeddingModel, hybridStrategy string, hybridRerank bool, err error) {
	ctx := context.Background()

	keys := []string{"rag_mode", "local_model", "embedding_model", "hybrid_strategy", "hybrid_rerank", "local_mode"}
	settingsMap := make(map[string]string)
	for _, key := range keys {
		val, err := h.Queries.GetSettingValue(ctx, key)
		if err != nil {
			return "", "", "", "", "", false, err
		}
		settingsMap[key] = val
	}

	mode = settingsMap["rag_mode"]
	if mode == "" {
		mode = "external"
	}

	localModel = settingsMap["local_model"]
	if localModel == "" {
		localModel = "qwen2.5-0.5b-instruct-q4_0.gguf"
	}

	// localMode: "cgo" (Qwen2.5-0.5B-Instruct EMBEDDED in binary) | "ollama" | "external"
	localMode = settingsMap["local_mode"]
	if localMode == "" {
		localMode = "cgo" // Default: embedded Qwen2.5-0.5B-Instruct
	}

	embeddingModel = settingsMap["embedding_model"]
	if embeddingModel == "" {
		embeddingModel = "all-minilm-l6-v2"
	}

	hybridStrategy = settingsMap["hybrid_strategy"]
	if hybridStrategy == "" {
		hybridStrategy = "local-first"
	}

	hybridRerank = settingsMap["hybrid_rerank"] == "true"

	return mode, localMode, localModel, embeddingModel, hybridStrategy, hybridRerank, nil
}

// getOrCreateVectorDB gets or creates the vector database for the company
func (h *Handler) getOrCreateVectorDB(companyID int) (*minirag.VectorDB, error) {
	dataDir := h.DataDir
	vectorPath := filepath.Join(dataDir, "rag_vectors", fmt.Sprintf("company_%d", companyID))
	
	return minirag.NewVectorDB(384, vectorPath)
}

// HandleAI is the main router for AI endpoints
func (h *Handler) HandleAI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/ai")

	switch {
	// Contract generation & review
	case path == "/generate-contract" && r.Method == http.MethodPost:
		if !h.isAIConfigured() {
			h.Error(w, http.StatusServiceUnavailable, "AI not configured. Please configure in Settings.")
			return
		}
		h.HandleAIGenerateContract(w, r)
	case path == "/review-contract" && r.Method == http.MethodPost:
		if !h.isAIConfigured() {
			h.Error(w, http.StatusServiceUnavailable, "AI not configured. Please configure in Settings.")
			return
		}
		h.HandleAIReviewContract(w, r)

	// RAG endpoints
	case path == "/test" && r.Method == http.MethodPost:
		h.HandleAITestConnection(w, r)
	case path == "/rag/local" && r.Method == http.MethodPost:
		h.HandleRAGLocal(w, r)
	case path == "/rag/hybrid" && r.Method == http.MethodPost:
		h.HandleRAGHybrid(w, r)
	case path == "/rag/index" && r.Method == http.MethodPost:
		h.HandleRAGIndex(w, r)
	case path == "/rag/status" && r.Method == http.MethodGet:
		h.HandleRAGStatus(w, r)

	// Legal AI endpoints (Cuban legal expert)
	case path == "/legal/status" && r.Method == http.MethodGet:
		h.HandleLegalStatus(w, r)
	case path == "/legal/documents" && r.Method == http.MethodGet:
		h.HandleListLegalDocuments(w, r)
	case path == "/legal/documents/upload" && r.Method == http.MethodPost:
		h.HandleUploadLegalDocument(w, r)
	case path == "/legal/chat" && r.Method == http.MethodPost:
		h.HandleLegalChat(w, r)
    case path == "/legal/validate" && r.Method == http.MethodPost:
        h.HandleValidateContract(w, r)
	case strings.HasPrefix(path, "/legal/documents/") && strings.HasSuffix(path, "/reindex") && r.Method == http.MethodPost:
        // Extract document ID from path
        idStr := strings.TrimPrefix(path, "/legal/documents/")
        idStr = strings.TrimSuffix(idStr, "/reindex")
        idStr = strings.Trim(idStr, "/")
        if idStr == "" {
            h.Error(w, http.StatusBadRequest, "Document ID required")
            return
        }
        id, err := strconv.Atoi(idStr)
        if err != nil {
            h.Error(w, http.StatusBadRequest, "Invalid document ID")
            return
        }
        h.HandleReindexLegalDocument(w, r, id)
    case strings.HasPrefix(path, "/legal/documents/") && r.Method == http.MethodDelete:
        // DELETE /api/ai/legal/documents/{id}
        idStr := strings.TrimPrefix(path, "/legal/documents/")
        idStr = strings.Trim(idStr, "/")
        if idStr == "" {
            h.Error(w, http.StatusBadRequest, "Document ID required")
            return
        }
        id, err := strconv.Atoi(idStr)
        if err != nil || id <= 0 {
            h.Error(w, http.StatusBadRequest, "Invalid document ID")
            return
        }
        h.HandleDeleteLegalDocument(w, r, id)
    case strings.HasPrefix(path, "/legal/documents/") && strings.HasSuffix(path, "/preview") && r.Method == http.MethodGet:
        // GET /api/ai/legal/documents/{id}/preview
        idStr := strings.TrimPrefix(path, "/legal/documents/")
        idStr = strings.TrimSuffix(idStr, "/preview")
        idStr = strings.Trim(idStr, "/")
        if idStr == "" {
            h.Error(w, http.StatusBadRequest, "Document ID required")
            return
        }
        id, err := strconv.Atoi(idStr)
        if err != nil || id <= 0 {
            h.Error(w, http.StatusBadRequest, "Invalid document ID")
            return
        }
        h.HandlePreviewLegalDocument(w, r, id)
    case path == "/legal/suggest-clauses" && r.Method == http.MethodGet:
        h.HandleSuggestClauses(w, r)
    case path == "/legal/chat/history" && r.Method == http.MethodGet:
        h.HandleLegalChatHistory(w, r)

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
	retriever := ai.NewContractRetriever(h.Queries)
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

// HandleRAGLocal handles local RAG queries
func (h *Handler) HandleRAGLocal(w http.ResponseWriter, r *http.Request) {
	_, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	
	var req struct {
		Query    string `json:"query"`
		K        int    `json:"k"`
		UseRerank bool   `json:"use_rerank"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	
	if req.Query == "" {
		h.Error(w, http.StatusBadRequest, "Query is required")
		return
	}
	
	if req.K <= 0 {
		req.K = 5
	}
	if req.K > 20 {
		req.K = 20
	}
	
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
	
	// Get vector DB
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		log.Printf("[RAG Local] Failed to create vector DB: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to initialize vector database")
		return
	}
	
	// Create embedding client and indexer
	embedder := minirag.NewEmbeddingClient("", "")
	indexer := minirag.NewIndexer(h.Queries, vectorDB, embedder)

	// Search for similar documents
	results, err := indexer.Search(req.Query, req.K)
	if err != nil {
		log.Printf("[RAG Local] Search failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to search documents")
		return
	}
	
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.success(w, http.StatusOK, map[string]interface{}{
		"query":    req.Query,
		"results":  results,
		"count":    len(results),
		"from":     "local",
	})
}

// HandleRAGHybrid handles hybrid RAG queries
func (h *Handler) HandleRAGHybrid(w http.ResponseWriter, r *http.Request) {
	_, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	
	var req struct {
		Query    string `json:"query"`
		K        int    `json:"k"`
		Strategy string `json:"strategy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	
	if req.Query == "" {
		h.Error(w, http.StatusBadRequest, "Query is required")
		return
	}
	
	if req.K <= 0 {
		req.K = 5
	}
	if req.K > 20 {
		req.K = 20
	}
	
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
	
	// Get RAG configuration
	mode, localMode, localModel, embeddingModel, hybridStrategy, hybridRerank, err := h.getRAGConfig()
	if err != nil {
		log.Printf("[RAG Hybrid] Failed to get config: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get RAG configuration")
		return
	}
	
	if req.Strategy != "" {
		hybridStrategy = req.Strategy
	}
	
	// Get vector DB
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		log.Printf("[RAG Hybrid] Failed to create vector DB: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to initialize vector database")
		return
	}
	
	// Create orchestrator
	orchestrator := hybrid.NewOrchestrator(mode, localMode, hybridStrategy, localModel, embeddingModel)
	orchestrator.VectorDB = vectorDB
	orchestrator.HybridRerank = hybridRerank
	
	// Set external LLM config if needed
	if mode == "external" || mode == "hybrid" {
		provider, apiKey, model, endpoint, err := h.getAIConfig()
		if err != nil {
			log.Printf("[RAG Hybrid] Failed to get AI config: %v", err)
			h.Error(w, http.StatusInternalServerError, "Failed to get AI configuration")
			return
		}
		orchestrator.ExternalLLM = ai.LLMProvider(provider)
		orchestrator.ExternalKey = apiKey
		orchestrator.ExternalModel = model
		orchestrator.ExternalEndpoint = endpoint
	}
	
	// Search similar documents
	results, err := orchestrator.SearchSimilar(req.Query, req.K)
	if err != nil {
		log.Printf("[RAG Hybrid] Search failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to search documents")
		return
	}
	
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.success(w, http.StatusOK, map[string]interface{}{
		"query":     req.Query,
		"results":   results,
		"count":     len(results),
		"mode":      mode,
		"strategy":  hybridStrategy,
		"health":    orchestrator.CheckHealth(),
	})
}

// HandleRAGIndex handles indexing requests
func (h *Handler) HandleRAGIndex(w http.ResponseWriter, r *http.Request) {
	_, cancel := context.WithTimeout(r.Context(), 300*time.Second)
	defer cancel()
	
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		h.Error(w, http.StatusForbidden, "no company assigned")
		return
	}
	
	// Get vector DB
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		log.Printf("[RAG Index] Failed to create vector DB: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to initialize vector database")
		return
	}
	
	// Create embedding client
	embedder := minirag.NewEmbeddingClient("", "")

	// Create indexer
	indexer := minirag.NewIndexer(h.Queries, vectorDB, embedder)
	
	// Index all contracts
	go func() {
		count, err := indexer.IndexAllContracts()
		if err != nil {
			log.Printf("[RAG Index] Indexing failed: %v", err)
		} else {
			log.Printf("[RAG Index] Successfully indexed %d contracts", count)
		}
	}()
	
	h.success(w, http.StatusOK, map[string]string{
		"status":  "started",
		"message": "Indexing started in background",
	})
}

// HandleRAGStatus returns the RAG system status
func (h *Handler) HandleRAGStatus(w http.ResponseWriter, r *http.Request) {
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		h.Error(w, http.StatusForbidden, "no company assigned")
		return
	}
	
	// Get RAG config
	mode, localMode, localModel, embeddingModel, hybridStrategy, hybridRerank, err := h.getRAGConfig()
	if err != nil {
		log.Printf("[RAG Status] Failed to get config: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get RAG configuration")
		return
	}
	
	// Get vector DB
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		log.Printf("[RAG Status] Failed to create vector DB: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to initialize vector database")
		return
	}
	
	// Create orchestrator for health check
	orchestrator := hybrid.NewOrchestrator(mode, localMode, hybridStrategy, localModel, embeddingModel)
	orchestrator.VectorDB = vectorDB
	
	// Get AI config for external status
	provider, apiKey, _, _, _ := h.getAIConfig()
	orchestrator.ExternalLLM = ai.LLMProvider(provider)
	orchestrator.ExternalKey = apiKey
	
	health := orchestrator.CheckHealth()
	
	h.success(w, http.StatusOK, map[string]interface{}{
		"mode":              mode,
		"local_model":       localModel,
		"embedding_model":   embeddingModel,
		"hybrid_strategy":   hybridStrategy,
		"hybrid_rerank":     hybridRerank,
		"health":            health,
		"indexed_documents": vectorDB.Count(),
		"ai_configured":     h.isAIConfigured(),
	})
}

// ========== LEGAL AI HANDLERS ==========

// handleLegalEnabled checks if AI legal features are enabled
func (h *Handler) handleLegalEnabled(w http.ResponseWriter, r *http.Request) bool {
	ctx := r.Context()

	enabled, err := db.GetAILegalEnabled(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal] Failed to get ai_legal_enabled: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to check AI legal status")
		return false
	}
	if !enabled {
		h.Error(w, http.StatusForbidden, "AI legal features are disabled")
		return false
	}
	return true
}

// HandleLegalStatus returns the status of the legal AI system
func (h *Handler) HandleLegalStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if legal AI is enabled
	enabled, err := db.GetAILegalEnabled(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Status] Failed to get enabled: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get status")
		return
	}

	// Get integration flag
	integrationEnabled, err := db.AILegalIntegrationEnabled(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Status] Failed to get integration: %v", err)
		integrationEnabled = false // default
	}

	// Count documents
	docCount, err := db.CountLegalDocuments(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Status] Count query failed: %v", err)
		docCount = 0
	}

	// Get embedding model
	embeddingModel, err := h.Queries.GetSettingValue(ctx, "ai_legal_embedding_model")
	if err != nil || embeddingModel == "" {
		embeddingModel = "all-minilm-l6-v2" // default
	}

	// Get last update (most recent indexed_at)
	lastUpdate, err := db.GetLastLegalDocumentIndexTime(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Status] Failed to get last_update: %v", err)
	}

	// Format last_update for JSON response
	lastUpdateValue := ""
	if lastUpdate.Valid {
		lastUpdateValue = lastUpdate.Time.Format(time.RFC3339)
	}

	response := map[string]interface{}{
		"enabled":           enabled,
		"integration":       integrationEnabled,
		"document_count":    docCount,
		"embedding_model":   embeddingModel,
		"status":            "operational",
		"last_update":       lastUpdateValue,
	}

	h.success(w, http.StatusOK, response)
}

// HandleListLegalDocuments returns a list of legal documents
func (h *Handler) HandleListLegalDocuments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Query all documents (no filter for now)
	docs, err := db.ListLegalDocuments(ctx, h.Queries, "")
	if err != nil {
		log.Printf("[Legal List] Failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to retrieve documents")
		return
	}

	// Convert to response structs (omit some fields)
	type docResponse struct {
		ID             int       `json:"id"`
		Title          string    `json:"title"`
		DocumentType   string    `json:"document_type"`
		Jurisdiction   string    `json:"jurisdiction"`
		ChunkCount     int       `json:"chunk_count"`
		IndexedAt      *time.Time `json:"indexed_at,omitempty"`
		CreatedAt      time.Time `json:"created_at"`
	}

	response := make([]docResponse, 0, len(docs))
	for _, d := range docs {
		response = append(response, docResponse{
			ID:           d.ID,
			Title:        d.Title,
			DocumentType: d.DocumentType,
			Jurisdiction: d.Jurisdiction,
			ChunkCount:   d.ChunkCount,
			IndexedAt:    d.IndexedAt,
			CreatedAt:    d.CreatedAt,
		})
	}

	h.success(w, http.StatusOK, map[string]interface{}{
		"documents": response,
		"count":     len(response),
	})
}

// HandleUploadLegalDocument uploads a new legal document for indexing
func (h *Handler) HandleUploadLegalDocument(w http.ResponseWriter, r *http.Request) {
	// Admin check
	if roleLevel(h.getUserRole(r)) < 4 {
		h.Error(w, http.StatusForbidden, "Admin role required")
		return
	}

	ctx := r.Context()

	// Check if legal AI is enabled
	enabled, err := db.GetAILegalEnabled(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Upload] Failed to get enabled status: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to check AI legal status")
		return
	}
	if !enabled {
		h.Error(w, http.StatusForbidden, "AI legal features are disabled")
		return
	}

	// Determine request type: multipart or JSON
	contentType := r.Header.Get("Content-Type")
	var (
		title        string
		docType      string
		jurisdiction string
		content      string
		contentHash  string
		language     string
	)

	if strings.HasPrefix(contentType, "application/json") {
		// JSON payload
		var req struct {
			Title        string `json:"title"`
			DocumentType string `json:"document_type"`
			Content      string `json:"content"`
			Language     string `json:"language,omitempty"`
			Jurisdiction string `json:"jurisdiction,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			h.Error(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
			return
		}
		title = req.Title
		docType = req.DocumentType
		content = req.Content
		language = req.Language
		if req.Jurisdiction == "" {
			jurisdiction = "Cuba"
		} else {
			jurisdiction = req.Jurisdiction
		}
		// Generate a simple hash for deduplication
		contentHash = fmt.Sprintf("%x", []byte(content)[:16])
	} else {
		// Multipart form upload
		if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB max
			h.Error(w, http.StatusBadRequest, "Failed to parse form: "+err.Error())
			return
		}

		// Get file
		file, header, err := r.FormFile("file")
		if err != nil {
			h.Error(w, http.StatusBadRequest, "Missing file: "+err.Error())
			return
		}
		defer file.Close()

		// Validate file size
		if header.Size > 50<<20 { // 50MB max
			h.Error(w, http.StatusBadRequest, "File too large (max 50MB)")
			return
		}

		// Read file content
		contentBytes, err := io.ReadAll(file)
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "Failed to read file")
			return
		}

		// Validate magic bytes to prevent disguised uploads
		if len(contentBytes) < 8 {
			h.Error(w, http.StatusBadRequest, "File too short")
			return
		}
		magic := string(contentBytes[:8])
		if !strings.HasPrefix(magic, "%PDF-") {
			h.Error(w, http.StatusBadRequest, "Only PDF files are supported (invalid magic bytes)")
			return
		}

		// Extract text from PDF if needed
		content = string(contentBytes)
		filename := header.Filename
		if strings.HasSuffix(strings.ToLower(filename), ".pdf") {
			parser := minirag.NewParsePDF()
			extracted, err := parser.Parse(contentBytes)
			if err != nil {
				log.Printf("[Legal Upload] PDF parse warning: %v", err)
			} else {
				content = extracted
			}
		}
		// Note: DOCX extraction can be added later

		// Get form fields
		title = r.FormValue("title")
		docType = r.FormValue("document_type")
		jurisdiction = r.FormValue("jurisdiction")
		if jurisdiction == "" {
			jurisdiction = "Cuba"
		}
		if title == "" || docType == "" {
			h.Error(w, http.StatusBadRequest, "title and document_type are required")
			return
		}
	// Generate hash
		contentHash = fmt.Sprintf("%x", []byte(content)[:16])
	}

	// Create legal document in database
	companyID := h.GetCompanyID(r)
	userID := h.getUserID(r)
	now := time.Now()

	doc, err := db.CreateLegalDocument(ctx, h.Queries, db.CreateLegalDocumentParams{
		Title:         title,
		DocumentType:   docType,
		Content:        content,
		ContentHash:    contentHash,
		Language:       language,
		Jurisdiction:   jurisdiction,
		CreatedAt:      now,
		UpdatedAt:      now,
		CompanyID:      companyID,
		UploadedBy:     userID,
		IsIndexed:      false,
		Tags:           []string{},
		ChunkCount:      0,
	})
	if err != nil {
		log.Printf("[Legal Upload] Create failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to save document")
		return
	}

	// Index the document asynchronously
	go func(doc db.LegalDocumentRow) {
		// Get vector DB
		vectorDB, err := h.getOrCreateVectorDB(companyID)
		if err != nil {
			log.Printf("[Legal Index] Failed to get vector DB: %v", err)
			return
		}

		// Create embedder and indexer
		embedder := minirag.NewEmbeddingClient("", "")
		indexer := minirag.NewIndexer(h.Queries, vectorDB, embedder)

		// Build models.LegalDocument using stored doc and extracted content
		legalDoc := &models.LegalDocument{
			ID:            doc.ID,
			Title:         doc.Title,
			DocumentType:  doc.DocumentType,
			Source:        doc.Source,
			Content:       content,
			ContentHash:   doc.ContentHash,
			Language:      doc.Language,
			Jurisdiction:  doc.Jurisdiction,
			EffectiveDate: doc.EffectiveDate,
			PublicationDate: doc.PublicationDate,
			GacetaNumber:  doc.GacetaNumber,
			Tags:          doc.Tags,
			CreatedAt:     doc.CreatedAt,
			UpdatedAt:     doc.UpdatedAt,
		}

		// Index the document (chunking, embedding, storing)
		if err := indexer.IndexLegalDocument(legalDoc); err != nil {
			log.Printf("[Legal Index] Failed to index document %d: %v", doc.ID, err)
		} else {
			log.Printf("[Legal Index] Successfully indexed document %d with RAG", doc.ID)
		}
	}(doc)

	h.success(w, http.StatusCreated, map[string]interface{}{
		"id":             doc.ID,
		"title":          doc.Title,
		"document_type":  doc.DocumentType,
		"status":         "indexing",
		"message":        "Document uploaded and indexing started",
	})
}

// HandleLegalChat handles chat messages with the legal AI expert
func (h *Handler) HandleLegalChat(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if legal AI is enabled
	enabled, err := db.GetAILegalEnabled(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Chat] Failed to get enabled status: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to check AI legal status")
		return
	}
	if !enabled {
		h.Error(w, http.StatusForbidden, "AI legal features are disabled")
		return
	}

	// Decode request
	var req struct {
		Message    string `json:"message"`
		SessionID  string `json:"session_id"`
		ContractID *int   `json:"contract_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request: "+err.Error())
		return
	}

	if req.Message == "" {
		h.Error(w, http.StatusBadRequest, "message is required")
		return
	}

	if req.SessionID == "" {
		req.SessionID = fmt.Sprintf("legal-%d", time.Now().UnixNano())
	}

	// Get user ID from auth (fallback to 0 for unauthenticated)
	userID := 0
	if user, ok := r.Context().Value("user").(*models.User); ok {
		userID = user.ID
	}

	// Get company ID for vector DB
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		companyID = 1 // default
	}

	// Get or create vector DB
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		log.Printf("[Legal Chat] Failed to get vector DB: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to initialize vector database")
		return
	}

	// Create embedder for RAG
	embedder := minirag.NewEmbeddingClient("", "")

	// Determine LLM client based on RAG configuration
	llmClient := h.LLMClient
	if llmClient == nil {
		// Check RAG mode to decide local vs external
		mode, localMode, localModel, _, _, _, err := h.getRAGConfig()
		if err != nil {
			log.Printf("[Legal Chat] Failed to get RAG config: %v", err)
			// Fallback: return a simple response for testing/disabled AI
			h.success(w, http.StatusOK, map[string]interface{}{
				"session_id": req.SessionID,
				"answer":      "Respuesta de experto legal no disponible (sin configuración de IA).",
			})
			return
		}
		if mode == "local" || mode == "hybrid" {
			// Use local LLM (CGo or Ollama depending on localMode)
			localClient := minirag.NewLocalClient(localMode, localModel, "")
			llmClient = &ai.LLMClient{
				Provider:    ai.ProviderCustom,
				Model:       localModel,
				LocalClient: localClient,
			}
		} else {
			// External provider (OpenAI, Groq, etc.)
			provider, apiKey, model, endpoint, err := h.getAIConfig()
			if err != nil {
				log.Printf("[Legal Chat] Failed to get AI config: %v", err)
			// Fallback: return a simple response
			h.success(w, http.StatusOK, map[string]interface{}{
				"session_id": req.SessionID,
				"answer":      "Respuesta de experto legal no disponible (sin configuración de IA).",
			})
			return
			}
			llmClient = ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
		}
	}

	// Create chat service with dependencies
	chatSvc := legal.NewChatService(h.Queries, vectorDB, embedder, llmClient)

	// Process message
	resp, err := chatSvc.ProcessMessage(ctx, legal.ChatMessage{
		SessionID: req.SessionID,
		UserID:    userID,
		Content:   req.Message,
	})
	if err != nil {
		log.Printf("[Legal Chat] Failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to get response: "+err.Error())
		return
	}

	h.success(w, http.StatusOK, map[string]interface{}{
		"session_id": req.SessionID,
		"answer":      resp.Answer,
		"sources":     resp.Sources,
	})
}

// HandleValidateContract validates a contract against Cuban law
func (h *Handler) HandleValidateContract(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if legal AI is enabled
	enabled, err := db.GetAILegalEnabled(ctx, h.Queries)
	if err != nil {
		log.Printf("[Legal Validate] Failed to get enabled status: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to check AI legal status")
		return
	}
	if !enabled {
		h.Error(w, http.StatusForbidden, "AI legal features are disabled")
		return
	}

	var req struct {
		ContractText string `json:"contract_text"`
		ContractType string `json:"contract_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "Invalid request: "+err.Error())
		return
	}

	if req.ContractText == "" {
		h.Error(w, http.StatusBadRequest, "contract_text is required")
		return
	}

	// Get company ID (may be used for future RAG integration)
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		companyID = 1
	}
	_ = companyID // currently unused, kept for future use

	// Build prompt for validation
	validationPrompt := ai.BuildValidationPrompt(req.ContractText, []string{})

	// Determine LLM client (same logic as HandleLegalChat)
	llmClient := h.LLMClient
	if llmClient == nil {
		// Check RAG configuration to decide local vs external
		mode, localMode, localModel, _, _, _, err := h.getRAGConfig()
		if err != nil {
			log.Printf("[Legal Validate] Failed to get RAG config: %v", err)
			// Fallback: return a canned validation response for testing/disabled AI
			h.success(w, http.StatusOK, map[string]interface{}{
				"contract_type": req.ContractType,
				"analysis":      "Análisis no disponible: falta configuración de IA.",
				"status":        "completed",
			})
			return
		}
		if mode == "local" || mode == "hybrid" {
			// Use local LLM (CGo or Ollama depending on localMode)
			localClient := minirag.NewLocalClient(localMode, localModel, "")
			llmClient = &ai.LLMClient{
				Provider:    ai.ProviderCustom,
				Model:       localModel,
				LocalClient: localClient,
			}
		} else {
			// External provider (OpenAI, Groq, etc.)
			provider, apiKey, model, endpoint, err := h.getAIConfig()
			if err != nil {
				log.Printf("[Legal Validate] Failed to get AI config: %v", err)
				// Fallback: return a canned validation response
				h.success(w, http.StatusOK, map[string]interface{}{
					"contract_type": req.ContractType,
					"analysis":      "Análisis no disponible: falta configuración de IA.",
					"status":        "completed",
				})
				return
			}
			llmClient = ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
		}
	}

	// Generate validation answer
	answer, err := llmClient.Generate(ctx, validationPrompt, "")
	if err != nil {
		log.Printf("[Legal Validate] LLM failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Validation failed")
		return
	}

	// Parse structured JSON response from LLM
	type validationResponse struct {
		Risks []struct {
			Clause     string `json:"clause"`
			Risk       string `json:"risk"`
			Suggestion string `json:"suggestion"`
		} `json:"risks"`
		MissingClauses []string `json:"missing_clauses"`
		OverallRisk    string  `json:"overall_risk"`
	}

	var parsed validationResponse
	if err := json.Unmarshal([]byte(answer), &parsed); err != nil {
		// Fallback: return analysis as plain text for backwards compatibility
		log.Printf("[Legal Validate] JSON parse failed, using fallback: %v", err)
		h.success(w, http.StatusOK, map[string]interface{}{
			"contract_type": req.ContractType,
			"analysis":      answer,
			"status":        "completed",
		})
		return
	}

	h.success(w, http.StatusOK, map[string]interface{}{
		"contract_type":   req.ContractType,
		"risks":           parsed.Risks,
		"missing_clauses": parsed.MissingClauses,
		"overall_risk":    parsed.OverallRisk,
		"status":         "completed",
	})
}

// HandleReindexLegalDocument re-indexes a legal document into the vector database
func (h *Handler) HandleReindexLegalDocument(w http.ResponseWriter, r *http.Request, id int) {
	// Admin check
	if roleLevel(h.getUserRole(r)) < 4 {
		h.Error(w, http.StatusForbidden, "Admin role required")
		return
	}

	ctx := r.Context()

	// Retrieve the legal document from the database
	docRow, err := db.GetLegalDocument(ctx, h.Queries, int64(id))
	if err != nil {
		if err == sql.ErrNoRows {
			h.Error(w, http.StatusNotFound, "Document not found")
		} else {
			h.Error(w, http.StatusInternalServerError, "Database error: "+err.Error())
		}
		return
	}

	// Get company ID for vector DB (documents are indexed per company)
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		companyID = 1 // default company
	}

	// Get or create vector DB for this company
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "Failed to initialize vector database")
		return
	}

	// Delete existing chunks for this document from the vector DB
	for i := 0; i < docRow.ChunkCount; i++ {
		chunkID := fmt.Sprintf("legal_%d_chunk_%d", id, i)
		if err := vectorDB.DeleteDocument(chunkID); err != nil {
			log.Printf("[Reindex] warning: failed to delete chunk %s: %v", chunkID, err)
		}
	}

	// Convert to models.LegalDocument for indexing
	legalDoc := &models.LegalDocument{
		ID:            docRow.ID,
		Title:         docRow.Title,
		DocumentType:  docRow.DocumentType,
		Source:        docRow.Source,
		Content:       docRow.Content,
		ContentHash:   docRow.ContentHash,
		Language:      docRow.Language,
		Jurisdiction:  docRow.Jurisdiction,
		EffectiveDate: docRow.EffectiveDate,
		PublicationDate: docRow.PublicationDate,
		GacetaNumber:  docRow.GacetaNumber,
		Tags:          docRow.Tags,
		CreatedAt:     docRow.CreatedAt,
		UpdatedAt:     docRow.UpdatedAt,
	}

	// Create embedder and indexer
	embedder := minirag.NewEmbeddingClient("", "")
	indexer := minirag.NewIndexer(h.Queries, vectorDB, embedder)

	// Re-index the document
	if err := indexer.IndexLegalDocument(legalDoc); err != nil {
		log.Printf("[Reindex] Failed to index document %d: %v", id, err)
		h.Error(w, http.StatusInternalServerError, "Indexing failed: "+err.Error())
		return
	}

	h.success(w, http.StatusOK, map[string]interface{}{
		"status":      "reindexed",
		"document_id": id,
	})
}

// HandleDeleteLegalDocument soft-deletes a legal document (admin only)
func (h *Handler) HandleDeleteLegalDocument(w http.ResponseWriter, r *http.Request, id int) {
	// Admin check
	if roleLevel(h.getUserRole(r)) < 4 {
		h.Error(w, http.StatusForbidden, "Admin role required")
		return
	}
	ctx := r.Context()

	// Get document to know chunk count and company
	docRow, err := db.GetLegalDocument(ctx, h.Queries, int64(id))
	if err != nil {
		if err == sql.ErrNoRows {
			h.Error(w, http.StatusNotFound, "Document not found")
		} else {
			h.Error(w, http.StatusInternalServerError, "Database error")
		}
		return
	}

	// Soft delete
	if err := db.DeleteLegalDocument(ctx, h.Queries, int64(id)); err != nil {
		h.Error(w, http.StatusInternalServerError, "Failed to delete: "+err.Error())
		return
	}

	// Get company ID for vector DB
	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		companyID = 1
	}
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		// Log but don't fail — document is already soft-deleted
		log.Printf("[DeleteLegalDoc] warning: failed to get vector DB for company %d: %v", companyID, err)
	} else {
		// Delete all chunks for this document from the vector DB
		for i := 0; i < docRow.ChunkCount; i++ {
			chunkID := fmt.Sprintf("legal_%d_chunk_%d", id, i)
			if err := vectorDB.DeleteDocument(chunkID); err != nil {
				log.Printf("[DeleteLegalDoc] warning: failed to delete chunk %s: %v", chunkID, err)
			}
		}
	}

	h.success(w, http.StatusNoContent, nil)
}

// HandleSuggestClauses returns suggested clauses based on contract type
func (h *Handler) HandleSuggestClauses(w http.ResponseWriter, r *http.Request) {
	contractType := r.URL.Query().Get("type")
	if contractType == "" {
		h.Error(w, http.StatusBadRequest, "Query parameter 'type' is required")
		return
	}

	companyID := h.GetCompanyID(r)
	if companyID == 0 {
		companyID = 1 // default
	}
	vectorDB, err := h.getOrCreateVectorDB(companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "Failed to get vector DB")
		return
	}

	embedder := minirag.NewEmbeddingClient("", "")
	embedding, err := embedder.GenerateEmbedding(contractType)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "Failed to generate embedding for query")
		return
	}

	// Filter for clause model documents
	filter := map[string]interface{}{
		"type":         "modelo_contrato",
		"jurisdiction": "Cuba",
	}
	results, err := vectorDB.SearchLegalDocuments(embedding, filter, 5)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "Search failed")
		return
	}

	type Suggestion struct {
		ID    int     `json:"id"`
		Title string  `json:"title"`
		Score float32 `json:"score,omitempty"`
	}
	suggestions := make([]Suggestion, 0, len(results))
	for _, res := range results {
		var docID int
		fmt.Sscanf(res.Meta.ExtraFields["document_id"], "%d", &docID)
		suggestions = append(suggestions, Suggestion{
			ID:    docID,
			Title: res.Meta.Title,
			Score: res.Score,
		})
	}

	h.success(w, http.StatusOK, map[string]interface{}{
		"suggestions": suggestions,
		"type":        contractType,
	})
}

// HandleLegalChatHistory returns the chat history for a given session
func (h *Handler) HandleLegalChatHistory(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		h.Error(w, http.StatusBadRequest, "session_id query parameter is required")
		return
	}

	messages, err := db.ListLegalChatMessages(r.Context(), h.Queries, sessionID)
	if err != nil {
		log.Printf("[Legal Chat History] Failed: %v", err)
		h.Error(w, http.StatusInternalServerError, "Failed to retrieve chat history")
		return
	}

	type outMsg struct {
		ID          int64     `json:"id"`
		UserID      int64     `json:"user_id"`
		MessageType string    `json:"message_type"`
		Content     string    `json:"content"`
		CreatedAt   time.Time `json:"created_at"`
	}
	out := make([]outMsg, len(messages))
	for i, m := range messages {
		out[i] = outMsg{
			ID:          int64(m.ID),
			UserID:      int64(m.UserID),
			MessageType: m.MessageType,
			Content:     m.Content,
			CreatedAt:   m.CreatedAt,
		}
	}

	h.success(w, http.StatusOK, map[string]interface{}{
		"session_id": sessionID,
		"messages":   out,
	})
}

// HandlePreviewLegalDocument returns a preview of a legal document (admin only)
func (h *Handler) HandlePreviewLegalDocument(w http.ResponseWriter, r *http.Request, id int) {
	// Admin check
	if roleLevel(h.getUserRole(r)) < 4 {
		h.Error(w, http.StatusForbidden, "Admin role required")
		return
	}
	ctx := r.Context()
	doc, err := db.GetLegalDocument(ctx, h.Queries, int64(id))
	if err != nil {
		if err == sql.ErrNoRows {
			h.Error(w, http.StatusNotFound, "Document not found")
		} else {
			h.Error(w, http.StatusInternalServerError, "Database error")
		}
		return
	}
	// Truncate content for preview
	preview := doc.Content
	const maxPreviewLen = 5000
	if len(preview) > maxPreviewLen {
		preview = preview[:maxPreviewLen] + "..."
	}
	h.success(w, http.StatusOK, map[string]interface{}{
		"id":             doc.ID,
		"title":          doc.Title,
		"preview":        preview,
		"document_type":  doc.DocumentType,
	})
}
