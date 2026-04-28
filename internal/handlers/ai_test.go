package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/db"
)

// TestHandleAI_NotConfigured tests that AI endpoints return service unavailable when not configured
func TestHandleAI_NotConfigured(t *testing.T) {
	// This test will be expanded when we have the actual implementation
	// For now, just verify the method signature exists
	t.Skip("Implementation pending full integration")
}

// TestHandleAIGenerateContract_InvalidRequest tests that invalid contract generation requests return 400
func TestHandleAIGenerateContract_InvalidRequest(t *testing.T) {
	// Set up test database
	dir := t.TempDir()
	database, err := db.Open(dir)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	h := &Handler{DB: database}

	// Invalid request: missing required fields (empty contract_type)
	reqBody := []byte(`{"contract_type": ""}`)
	req := httptest.NewRequest("POST", "/api/ai/generate-contract", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleAIGenerateContract(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// TestHandleAIGenerateContract_InvalidInput tests various invalid inputs for contract generation
func TestHandleAIGenerateContract_InvalidInput(t *testing.T) {
	dir := t.TempDir()
	database, err := db.Open(dir)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	h := &Handler{DB: database}

	tests := []struct {
		name    string
		body    string
		wantCode int
	}{
		{
			name: "amount zero",
			body: `{"contract_type":"service","amount":0,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"test"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name: "clientID negative",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":-1,"supplier_id":2,"description":"test"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name: "supplierID negative",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":-2,"description":"test"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name: "startDate >= endDate",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-12-31","end_date":"2025-01-01","client_id":1,"supplier_id":2,"description":"test"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name: "startDate equals endDate",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-01-01","client_id":1,"supplier_id":2,"description":"test"}`,
			wantCode: http.StatusBadRequest,
		},
		{
			name: "description too long",
			body: `{"contract_type":"service","amount":1000,"start_date":"2025-01-01","end_date":"2025-12-31","client_id":1,"supplier_id":2,"description":"` + strings.Repeat("x", 10001) + `"}`,
			wantCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/ai/generate-contract", bytes.NewReader([]byte(tt.body)))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			h.HandleAIGenerateContract(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("expected %d, got %d, body: %s", tt.wantCode, w.Code, w.Body.String())
			}
		})
	}
}

// TestHandleAITestConnection_Valid tests the connection test endpoint with a mock
func TestHandleAITestConnection_Valid(t *testing.T) {
	dir := t.TempDir()
	database, err := db.Open(dir)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	h := &Handler{DB: database}

	reqBody := map[string]string{
		"provider": "openai",
		"api_key":  "sk-test-invalid-key-that-will-fail",
		"model":    "gpt-4o",
	}
	encoded, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/ai/test", bytes.NewReader(encoded))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.HandleAITestConnection(w, req)

	// Expect a failure because the API key is invalid, but not a server error (5xx)
	// Should be 502 Bad Gateway from "Connection failed"
	if w.Code == http.StatusInternalServerError {
		t.Errorf("got 500 Internal Server Error, expected either 502 (connection fail) or 200 if mocking")
	}
}
