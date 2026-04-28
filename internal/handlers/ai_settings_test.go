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

// TestValidateAIProvider validates the provider validation helper
func TestValidateAIProvider(t *testing.T) {
	validProviders := []string{"openai", "groq", "anthropic", "openrouter", "custom"}

	for _, provider := range validProviders {
		if !isValidAIProvider(provider) {
			t.Errorf("provider %s should be valid", provider)
		}
	}

	if isValidAIProvider("invalid") {
		t.Error("invalid provider should not be valid")
	}
}

// isValidAIProvider checks if a provider string is valid
func isValidAIProvider(provider string) bool {
	valid := map[string]bool{
		"openai":     true,
		"groq":       true,
		"anthropic":  true,
		"openrouter": true,
		"custom":     true,
	}
	return valid[provider]
}

// TestUpdateSystemSettings_EncryptsAPIKey tests that ai_api_key is encrypted on update
func TestUpdateSystemSettings_EncryptsAPIKey(t *testing.T) {
	// Initialize encryption key for tests
	ai.SetEncryptionKey([]byte("test-key-123456789012345678901234")) // 32 bytes

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

	// Insert a test user for updated_by reference
	_, err = database.Exec("INSERT INTO users (id, name, email, password_hash, role, status) VALUES (1, 'Test User', 'test@example.com', 'hash', 'admin', 'active')")
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}

	// Insert initial plain ai_api_key directly (bypassing handler)
	plainAPIKey := "sk-test-plain-key-1234567890"
	_, err = database.Exec(
		"INSERT INTO system_settings (key, value, category, updated_by) VALUES (?, ?, ?, ?)",
		"ai_api_key", plainAPIKey, "ai", 1,
	)
	if err != nil {
		t.Fatalf("Failed to insert initial setting: %v", err)
	}

	// Build update request with same plain key
	reqBody := []UpdateSettingRequest{
		{Key: "ai_api_key", Value: plainAPIKey},
	}
	encoded, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/system/settings", bytes.NewReader(encoded))
	req.Header.Set("Content-Type", "application/json")

	// Set user ID in context (mimicking authenticated user)
	ctx := req.Context()
	ctx = context.WithValue(ctx, ctxUserID, 1)
	req = req.WithContext(ctx)

	// Call handler
	w := httptest.NewRecorder()
	h.UpdateSystemSettings(w, req)

	// Should succeed
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	// Verify that the stored value is now encrypted (not the plain key)
	var storedValue string
	err = database.QueryRow("SELECT value FROM system_settings WHERE key = 'ai_api_key'").Scan(&storedValue)
	if err != nil {
		t.Fatalf("Failed to query ai_api_key: %v", err)
	}

	// Encrypted value should NOT equal the plain API key
	if storedValue == plainAPIKey {
		t.Error("ai_api_key should be encrypted in database, but found plain text")
	}

	// Encrypted value should be decodable base64 and decrypt to original
	decrypted, err := ai.DecryptAPIKey(storedValue)
	if err != nil {
		t.Errorf("Failed to decrypt stored value: %v", err)
	}
	if decrypted != plainAPIKey {
		t.Errorf("Decrypted key mismatch. Got %s, want %s", decrypted, plainAPIKey)
	}
}

// TestUpdateSystemSettings_EmptyAPIKey tests that empty ai_api_key is not encrypted
func TestUpdateSystemSettings_EmptyAPIKey(t *testing.T) {
	ai.SetEncryptionKey([]byte("test-key-123456789012345678901234"))

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

	// Insert test user
	_, err = database.Exec("INSERT INTO users (id, name, email, password_hash, role, status) VALUES (1, 'Test', 'test@example.com', 'hash', 'admin', 'active')")
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}

	// Insert initial empty ai_api_key
	_, err = database.Exec(
		"INSERT INTO system_settings (key, value, category, updated_by) VALUES (?, ?, ?, ?)",
		"ai_api_key", "", "ai", 1,
	)
	if err != nil {
		t.Fatalf("Failed to insert initial setting: %v", err)
	}

	// Update with empty value
	reqBody := []UpdateSettingRequest{{Key: "ai_api_key", Value: ""}}
	encoded, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/system/settings", bytes.NewReader(encoded))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), ctxUserID, 1)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.UpdateSystemSettings(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", w.Code)
	}

	// Verify empty value remains empty
	var storedValue string
	database.QueryRow("SELECT value FROM system_settings WHERE key = 'ai_api_key'").Scan(&storedValue)
	if storedValue != "" {
		t.Errorf("Expected empty value, got: %s", storedValue)
	}
}

// TestUpdateSystemSettings_NonAIKey tests that non-ai keys are not encrypted
func TestUpdateSystemSettings_NonAIKey(t *testing.T) {
	ai.SetEncryptionKey([]byte("test-key-123456789012345678901234"))

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

	// Insert test user
	_, err = database.Exec("INSERT INTO users (id, name, email, password_hash, role, status) VALUES (1, 'Test', 'test@example.com', 'hash', 'admin', 'active')")
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}

	// Insert some other key
	plainValue := "some-normal-setting-value"
	_, err = database.Exec(
		"INSERT INTO system_settings (key, value, category, updated_by) VALUES (?, ?, ?, ?)",
		"smtp_host", plainValue, "smtp", 1,
	)
	if err != nil {
		t.Fatalf("Failed to insert initial setting: %v", err)
	}

	// Update with a non-ai key
	reqBody := []UpdateSettingRequest{{Key: "smtp_host", Value: plainValue}}
	encoded, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/api/system/settings", bytes.NewReader(encoded))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), ctxUserID, 1)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.UpdateSystemSettings(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", w.Code)
	}

	// Verify value is stored as plain (not encrypted)
	var storedValue string
	database.QueryRow("SELECT value FROM system_settings WHERE key = 'smtp_host'").Scan(&storedValue)
	if storedValue != plainValue {
		t.Errorf("Expected plain value %s, got %s", plainValue, storedValue)
	}
}
