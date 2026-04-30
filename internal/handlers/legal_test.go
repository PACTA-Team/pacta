package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func setupLegalTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("PRAGMA foreign_keys: %v", err)
	}

	// Create tables
	tables := []string{
		`CREATE TABLE system_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			key TEXT UNIQUE NOT NULL,
			value TEXT,
			category TEXT NOT NULL DEFAULT 'general',
			updated_by INTEGER,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE legal_documents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			document_type TEXT NOT NULL,
			source TEXT,
			content TEXT NOT NULL,
			content_hash TEXT NOT NULL,
			language TEXT DEFAULT 'es',
			jurisdiction TEXT DEFAULT 'Cuba',
			effective_date DATE,
			publication_date DATE,
			gaceta_number TEXT,
			tags TEXT,
			chunk_count INTEGER DEFAULT 0,
			indexed_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE ai_legal_chat_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			session_id TEXT NOT NULL,
			message_type TEXT NOT NULL,
			content TEXT NOT NULL,
			context_documents TEXT,
			metadata TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE document_chunks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			document_id INTEGER NOT NULL,
			chunk_index INTEGER NOT NULL,
			content TEXT NOT NULL,
			metadata TEXT,
			embedding TEXT,
			source TEXT DEFAULT 'contract',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE companies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			company_type TEXT NOT NULL DEFAULT 'single',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			role TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			company_id INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
	}

	for _, stmt := range tables {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("failed to create table: %v\nstmt: %s", err, stmt)
		}
	}

	// Insert default company
	db.Exec(`INSERT INTO companies (name, company_type) VALUES ('Test Company', 'single')`)

	return db
}

// mockHandler creates a test handler with DB and queries
func mockLegalHandler(t *testing.T, db *sql.DB) *Handler {
	t.Helper()
	// Create a minimal Config
	cfg := &Config{
		DataDir: "/tmp",
	}
	h := &Handler{
		DB:       db,
		Config:   cfg,
		RateLimiter: &RateLimiter{}, // mock
	}
	return h
}

func TestHandleLegalStatus(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	// Set ai_legal_enabled = true
	db.Exec(`INSERT INTO system_settings (key, value) VALUES ('ai_legal_enabled', 'true')`)

	handler := mockLegalHandler(t, db)

	req := httptest.NewRequest("GET", "/api/ai/legal/status", nil)
	w := httptest.NewRecorder()

	handler.HandleLegalStatus(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	if resp["enabled"] != true {
		t.Errorf("Expected enabled=true, got %v", resp["enabled"])
	}
	if resp["document_count"] == nil {
		t.Error("Expected document_count in response")
	}
}

func TestHandleListLegalDocuments(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	now := time.Now()
	db.Exec(`
		INSERT INTO legal_documents (title, document_type, content, content_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, "Ley de Prueba", "ley", "Contenido", "hash", now, now)

	handler := mockLegalHandler(t, db)

	req := httptest.NewRequest("GET", "/api/ai/legal/documents", nil)
	w := httptest.NewRecorder()

	handler.HandleListLegalDocuments(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	docs, ok := resp["documents"].([]interface{})
	if !ok || len(docs) == 0 {
		t.Error("Expected non-empty documents array")
	}
}

func TestHandleUploadLegalDocument(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	// Create multipart form data
	body := `--boundary
Content-Disposition: form-data; name="file"; filename="test.pdf"
Content-Type: text/plain

Artículo 1. Esta es una ley de prueba.
--boundary
Content-Disposition: form-data; name="title"

Test Law
--boundary
Content-Disposition: form-data; name="document_type"

ley
--boundary--
`

	req := httptest.NewRequest("POST", "/api/ai/legal/documents/upload", strings.NewReader(body))
	req.Header.Set("Content-Type", "multipart/form-data; boundary=boundary")
	w := httptest.NewRecorder()

	handler.HandleUploadLegalDocument(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	if resp["id"] == nil {
		t.Error("Expected document ID in response")
	}
}

func TestHandleLegalChat(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	reqBody := map[string]string{
		"message":    "¿Qué dice la ley?",
		"session_id": "test-session",
	}
	jsonBody, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/ai/legal/chat", strings.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.HandleLegalChat(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	if resp["reply"] == nil {
		t.Error("Expected reply in response")
	}
	if resp["session_id"] == nil {
		t.Error("Expected session_id in response")
	}
}

func TestHandleValidateContract(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	reqBody := map[string]string{
		"contract_text":  "Cláusula de precio: USD 1000",
		"contract_type":  "suministro",
	}
	jsonBody, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/ai/legal/validate", strings.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.HandleValidateContract(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	if resp["analysis"] == nil {
		t.Error("Expected analysis in response")
	}
}
