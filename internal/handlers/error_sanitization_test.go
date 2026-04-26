package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/stretchr/testify/assert"
)

// TestContractsList_ErrorSanitization tests that listContracts does not leak
// raw database errors in the response.
func TestContractsList_ErrorSanitization(t *testing.T) {
	database := setupTestDB(t)
	h := &Handler{DB: database}
	// Close DB to provoke a "database is closed" error
	database.Close()

	req := httptest.NewRequest("GET", "/api/contracts?entity_id=1&entity_type=contract", nil)
	rec := httptest.NewRecorder()
	h.HandleContracts(rec, req)

	// Should return 500, not the raw DB error
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	body := rec.Body.String()
	// Ensure the raw DB error is not exposed
	assert.NotContains(t, body, "database is closed")
	assert.NotContains(t, body, "sql:", "response should not contain raw SQL error details")
}

// TestSetup_ErrorSanitization tests that HandleSetup returns a generic error
// on validation failures instead of leaking specific validation details.
func TestSetup_ErrorSanitization(t *testing.T) {
	// Fresh DB with no users
	dir := t.TempDir()
	database, err := db.Open(dir)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	defer database.Close()
	if err := db.Migrate(database); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}
	h := &Handler{DB: database, DataDir: t.TempDir()}

	// Build an invalid setup request: admin password not strong enough
	reqBody := map[string]interface{}{
		"company_mode": "single",
		"admin": map[string]string{
			"name":     "Admin",
			"email":    "admin@test.com",
			"password": "Password1", // missing special character
		},
		"company": map[string]interface{}{"name": "TestCo"},
		"client":  map[string]interface{}{"name": "TestClient"},
		"supplier": map[string]interface{}{"name": "TestSupplier"},
	}
	encoded, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/setup", bytes.NewReader(encoded))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.HandleSetup(rec, req)

	// Should return 400 with generic message "invalid request"
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	body := rec.Body.String()
	// Should not contain specific validation detail
	assert.NotContains(t, body, "uppercase")
	assert.NotContains(t, body, "special character")
	assert.NotContains(t, body, "number")
	assert.Contains(t, body, "invalid request")
}

// TestDocumentsUploadTemp_ErrorSanitization tests that file validation errors
// in HandleUploadTempDocument do not leak raw error messages.
func TestDocumentsUploadTemp_ErrorSanitization(t *testing.T) {
	// We don't need any DB state because this endpoint doesn't check contracts
	// (validateFileUpload runs before any DB interaction).
	dir := t.TempDir()
	database, err := db.Open(dir)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	defer database.Close()
	if err := db.Migrate(database); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}
	h := &Handler{DB: database, DataDir: dir}

	// Build multipart form with an invalid file extension (.exe)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	// No need for entity fields for temp upload; just file
	fileWriter, err := writer.CreateFormFile("file", "malicious.exe")
	if err != nil {
		t.Fatal(err)
	}
	fileWriter.Write([]byte("fake exe content"))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/documents/temp", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	h.HandleUploadTempDocument(rec, req)

	// Should return 400 with generic "invalid request"
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	respBody := rec.Body.String()
	// Should not contain specific validation error like "invalid file extension"
	assert.NotContains(t, respBody, "invalid file extension")
	assert.NotContains(t, respBody, ".exe")
	assert.Contains(t, respBody, "invalid request")
}

// Helper to create a minimal contract for document tests (not used currently, but kept for potential expansion)
func createContractInDB(t *testing.T, db *sql.DB, companyID int64) int64 {
	// Create a client
	resC, err := db.Exec("INSERT INTO clients (name) VALUES (?)", "Test Client")
	if err != nil {
		t.Fatal(err)
	}
	clientID, _ := resC.LastInsertId()

	// Create a supplier
	resS, err := db.Exec("INSERT INTO suppliers (name) VALUES (?)", "Test Supplier")
	if err != nil {
		t.Fatal(err)
	}
	supplierID, _ := resS.LastInsertId()

	contractNumber := "CNT-TEST-" + time.Now().Format("20060102150405")
	res, err := db.Exec(`
		INSERT INTO contracts (contract_number, client_id, supplier_id, start_date, end_date, amount, company_id, document_url, document_key)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, contractNumber, clientID, supplierID, "2025-01-01", "2025-12-31", 1000.0, companyID, "http://test", "key")
	if err != nil {
		t.Fatalf("Failed to insert contract: %v", err)
	}
	id, _ := res.LastInsertId()
	return id
}
