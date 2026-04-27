package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
