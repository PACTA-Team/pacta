package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/PACTA-Team/pacta/internal/ai"
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
		`CREATE TABLE IF NOT EXISTS system_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			key TEXT UNIQUE NOT NULL,
			value TEXT,
			category TEXT NOT NULL DEFAULT 'general',
			updated_by INTEGER,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS legal_documents (
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
		`CREATE TABLE IF NOT EXISTS ai_rate_limits (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			company_id INTEGER NOT NULL,
			date TEXT NOT NULL,
			count INTEGER DEFAULT 0,
			UNIQUE(company_id, date)
		)`,
		`CREATE TABLE IF NOT EXISTS companies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			company_type TEXT NOT NULL DEFAULT 'single',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS users (
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

func mockLegalHandler(t *testing.T, db *sql.DB) *Handler {
	t.Helper()
	cfg := &Config{
		DataDir: "/tmp",
	}
	h := &Handler{
		DB:         db,
		Config:      cfg,
		RateLimiter: ai.NewRateLimiter(db),
	}
	return h
}

func TestUploadLegalDocument(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	// Set ai_legal_enabled = true
	db.Exec(`INSERT INTO system_settings (key, value, category) VALUES ('ai_legal_enabled', 'true', 'ai')`)

	// Build multipart form data with a file and fields
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	// File part
	fw, err := w.CreateFormFile("file", "test.txt")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	fw.Write([]byte("Artículo 1. Disposiciones generales."))
	// Form fields
	w.WriteField("title", "Test Law")
	w.WriteField("document_type", "law")
	w.WriteField("jurisdiction", "Cuba")
	// Close writer
	if err := w.Close(); err != nil {
		t.Fatalf("multipart close: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/ai/legal/documents", &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()

	handler.HandleUploadLegalDocument(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&resp)

	if resp["id"] == nil {
		t.Error("Expected document ID in response")
	}
}

func TestLegalChat(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	// Set ai_legal_enabled = true
	db.Exec(`INSERT INTO system_settings (key, value, category) VALUES ('ai_legal_enabled', 'true', 'ai')`)

	body := map[string]interface{}{
		"session_id": "test-123",
		"message":    "¿Qué es un contrato?",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/ai/legal/chat", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.HandleLegalChat(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	if resp["reply"] == nil {
		t.Error("Expected reply in response")
	}
}

func TestValidateContract(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	// Set ai_legal_enabled = true
	db.Exec(`INSERT INTO system_settings (key, value, category) VALUES ('ai_legal_enabled', 'true', 'ai')`)

	body := map[string]interface{}{
		"contract_text": "Contrato de prestación de servicios...",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/ai/legal/validate", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.HandleValidateContract(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	if resp["analysis"] == nil {
		t.Error("Expected analysis in response")
	}
}

// Test that endpoints return 403 when legal features are disabled
func TestLegalEndpointsDisabled(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	handler := mockLegalHandler(t, db)

	// Don't set ai_legal_enabled - should be disabled by default

	tests := []struct {
		name   string
		method string
		url    string
	}{
		{"UploadLegalDocument", "POST", "/api/ai/legal/documents"},
		{"LegalChat", "POST", "/api/ai/legal/chat"},
		{"ValidateContract", "POST", "/api/ai/legal/validate"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]interface{}{"test": "data"}
			jsonBody, _ := json.Marshal(body)

			req := httptest.NewRequest(tt.method, tt.url, bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			switch tt.name {
			case "UploadLegalDocument":
				handler.HandleUploadLegalDocument(w, req)
			case "LegalChat":
				handler.HandleLegalChat(w, req)
			case "ValidateContract":
				handler.HandleValidateContract(w, req)
			}

			if w.Code != http.StatusForbidden {
				t.Errorf("Expected status 403 when disabled, got %d. Body: %s", w.Code, w.Body.String())
			}

			if !strings.Contains(w.Body.String(), "disabled") {
				t.Errorf("Expected 'disabled' in response, got: %s", w.Body.String())
			}
		})
	}
}
