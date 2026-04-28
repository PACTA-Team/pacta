package handlers

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai"
)

// TestHandleAIGenerateContract tests the contract generation endpoint with table-driven tests.
func TestHandleAIGenerateContract(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	companyID := insertTestCompany(t, db)

	// Configure AI encryption
	ai.SetEncryptionKey([]byte("32-byte-test-key-1234567890ab"))
	encKey, err := ai.EncryptAPIKey("sk-test-mock-key")
	if err != nil {
		t.Fatalf("EncryptAPIKey: %v", err)
	}
	// Insert system AI settings
	if _, err := db.Exec(
		"INSERT INTO system_settings (key, value, category) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)",
		"ai_provider", "openai", "ai",
		"ai_api_key", encKey, "ai",
		"ai_model", "gpt-4o", "ai",
		"ai_endpoint", "", "ai",
	); err != nil {
		t.Fatalf("insert system_settings: %v", err)
	}

	// Base handler with mock client and rate limiter
	mockSuccessClient := &mockLLMClient{response: "Generated contract text"}
	h := &Handler{
		DB:          db,
		RateLimiter: ai.NewRateLimiter(db),
		LLMClient:   mockSuccessClient,
	}

	tests := []struct {
		name            string
		body            string
		modifyHandler   func(*testing.T, *Handler)
		wantStatus      int
		wantBodyContains []string
	}{
		{
			name: "valid request",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"test"}`,
			modifyHandler: nil,
			wantStatus: 200,
			wantBodyContains: []string{`"text":"Generated contract text"`},
		},
		{
			name: "missing required fields - empty contract_type",
			body: `{"contract_type":""}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`Missing required fields`},
		},
		{
			name: "invalid amount zero",
			body: `{"contract_type":"service","amount":0,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"test"}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`amount must be greater than zero`},
		},
		{
			name: "client_id negative",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":-1,"supplier_id":2,"description":"test"}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`client_id and supplier_id must be positive integers`},
		},
		{
			name: "supplier_id negative",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":-2,"description":"test"}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`client_id and supplier_id must be positive integers`},
		},
		{
			name: "start_date after end_date",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-12-31","end_date":"2025-01-01","client_id":1,"supplier_id":2,"description":"test"}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`start_date must be before end_date`},
		},
		{
			name: "start_date equals end_date",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-01-01","client_id":1,"supplier_id":2,"description":"test"}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`start_date must be before end_date`},
		},
		{
			name: "description too long",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"` + strings.Repeat("x", 10001) + `"}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`description too long`},
		},
		{
			name: "rate limit exceeded",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"test"}`,
			modifyHandler: func(t *testing.T, h *Handler) {
				today := time.Now().UTC().Format("2006-01-02")
				if _, err := db.Exec("INSERT INTO ai_rate_limits (company_id, date, count) VALUES (?, ?, ?)", companyID, today, 100); err != nil {
					t.Fatalf("seed rate limit: %v", err)
				}
			},
			wantStatus: 429,
			wantBodyContains: []string{`daily AI request limit`},
		},
		{
			name: "LLM returns error",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"test"}`,
			modifyHandler: func(t *testing.T, h *Handler) {
				h.LLMClient = &mockLLMClient{err: errors.New("LLM unavailable")}
			},
			wantStatus: 500,
			wantBodyContains: []string{`AI generation failed`},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			// Apply any handler modifications per test
			if tt.modifyHandler != nil {
				tt.modifyHandler(t, h)
			}

			req := httptest.NewRequest("POST", "/api/ai/generate-contract", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			// Inject company context
			req = withCompanyContext(req, companyID)
			w := httptest.NewRecorder()

			h.HandleAIGenerateContract(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d, body: %s", tt.wantStatus, w.Code, w.Body.String())
				return
			}
			body := w.Body.String()
			for _, substr := range tt.wantBodyContains {
				if !strings.Contains(body, substr) {
					t.Errorf("body missing substring %q.\nFull body: %s", substr, body)
				}
			}
		})
	}
}

// TestHandleAIReviewContract tests the contract review endpoint.
func TestHandleAIReviewContract(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	companyID := insertTestCompany(t, db)

	// AI config
	ai.SetEncryptionKey([]byte("32-byte-test-key-1234567890ab"))
	encKey, _ := ai.EncryptAPIKey("sk-test")
	db.Exec(
		"INSERT INTO system_settings (key, value, category) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)",
		"ai_provider", "openai", "ai",
		"ai_api_key", encKey, "ai",
		"ai_model", "gpt-4o", "ai",
		"ai_endpoint", "", "ai",
	)

	mockClient := &mockLLMClient{response: `{"summary":"Review OK","risks":[],"missing_clauses":[],"overall_risk":"low"}`}
	h := &Handler{
		DB:          db,
		RateLimiter: ai.NewRateLimiter(db),
		LLMClient:   mockClient,
	}

	tests := []struct {
		name            string
		body            string
		modifyHandler   func(t *testing.T)
		wantStatus      int
		wantBodyContains []string
	}{
		{
			name: "valid review via text",
			body: `{"text":"This is a contract text to review."}`,
			modifyHandler: nil,
			wantStatus: 200,
			wantBodyContains: []string{`"summary":"Review OK"`},
		},
		{
			name: "missing both text and document_url",
			body: `{}`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`either text or document_url must be provided`},
		},
		{
			name: "rate limit exceeded",
			body: `{"text":"contract"}`,
			modifyHandler: func(t *testing.T) {
				today := time.Now().UTC().Format("2006-01-02")
				db.Exec("INSERT INTO ai_rate_limits (company_id, date, count) VALUES (?,?,100)", companyID, today)
			},
			wantStatus: 429,
			wantBodyContains: []string{`daily AI request limit`},
		},
		{
			name: "LLM error",
			body: `{"text":"contract"}`,
			modifyHandler: func(t *testing.T) {
				h.LLMClient = &mockLLMClient{err: errors.New("LLM down")}
			},
			wantStatus: 500,
			wantBodyContains: []string{`AI review failed`},
		},
		{
			name: "invalid JSON",
			body: `not json`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`Invalid request body`},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			if tt.modifyHandler != nil {
				tt.modifyHandler(t)
			}
			req := httptest.NewRequest("POST", "/api/ai/review-contract", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			req = withCompanyContext(req, companyID)
			w := httptest.NewRecorder()
			h.HandleAIReviewContract(w, req)
			if w.Code != tt.wantStatus {
				t.Errorf("expected %d, got %d, body: %s", tt.wantStatus, w.Code, w.Body.String())
				return
			}
			body := w.Body.String()
			for _, substr := range tt.wantBodyContains {
				if !strings.Contains(body, substr) {
					t.Errorf("body missing substring %q. got: %s", substr, body)
				}
			}
		})
	}
}

// TestHandleAITestConnection tests the AI connection test endpoint.
func TestHandleAITestConnection(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// Mock client; we don't need AI config
	mockSuccess := &mockLLMClient{response: "Test successful"}
	h := &Handler{
		DB:        db,
		LLMClient: mockSuccess,
	}

	tests := []struct {
		name            string
		body            string
		modifyHandler   func(t *testing.T)
		wantStatus      int
		wantBodyContains []string
	}{
		{
			name: "valid credentials",
			body: `{"provider":"openai","api_key":"sk-test","model":"gpt-4o"}`,
			modifyHandler: nil,
			wantStatus: 200,
			wantBodyContains: []string{`"status":"success"`, `"message":"Connection successful"`},
		},
		{
			name: "LLM error",
			body: `{"provider":"openai","api_key":"sk-test","model":"gpt-4o"}`,
			modifyHandler: func(t *testing.T) {
				h.LLMClient = &mockLLMClient{err: errors.New("connection failed")}
			},
			wantStatus: 502,
			wantBodyContains: []string{`Connection failed`},
		},
		{
			name: "invalid JSON",
			body: `not json`,
			modifyHandler: nil,
			wantStatus: 400,
			wantBodyContains: []string{`Invalid request body`},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			if tt.modifyHandler != nil {
				tt.modifyHandler(t)
			}
			req := httptest.NewRequest("POST", "/api/ai/test", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.HandleAITestConnection(w, req)
			if w.Code != tt.wantStatus {
				t.Errorf("expected %d, got %d, body: %s", tt.wantStatus, w.Code, w.Body.String())
				return
			}
			body := w.Body.String()
			for _, substr := range tt.wantBodyContains {
				if !strings.Contains(body, substr) {
					t.Errorf("body missing substring %q.\nFull body: %s", substr, body)
				}
			}
		})
	}
}
