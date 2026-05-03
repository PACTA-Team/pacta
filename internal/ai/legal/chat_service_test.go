package legal

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/ai/minirag"
	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/models"
	"github.com/stretchr/testify/require"
)

// setupTestDB creates an in-memory SQLite database with necessary tables for legal chat tests.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")
	database, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	// Create legal_documents table
	_, err = database.Exec(`
		CREATE TABLE IF NOT EXISTS legal_documents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			document_type TEXT,
			source TEXT,
			content TEXT,
			content_hash TEXT,
			language TEXT DEFAULT 'es',
			jurisdiction TEXT DEFAULT 'Cuba',
			effective_date TEXT,
			publication_date TEXT,
			gaceta_number TEXT,
			tags TEXT,
			chunk_count INTEGER DEFAULT 0,
			indexed_at TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now')),
			deleted_at TEXT,
			company_id INTEGER NOT NULL DEFAULT 1,
			uploaded_by INTEGER NOT NULL,
			storage_path TEXT NOT NULL,
			mime_type TEXT,
			size_bytes INTEGER,
			chunk_config TEXT,
			is_indexed BOOLEAN DEFAULT 0
		)
	`)
	if err != nil {
		t.Fatalf("failed to create legal_documents table: %v", err)
	}

	// Create ai_legal_chat_history table
	_, err = database.Exec(`
		CREATE TABLE IF NOT EXISTS ai_legal_chat_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			session_id TEXT NOT NULL,
			message_type TEXT NOT NULL,
			content TEXT NOT NULL,
			context_documents TEXT,
			metadata TEXT,
			created_at TEXT DEFAULT (datetime('now'))
		)
	`)
	if err != nil {
		t.Fatalf("failed to create ai_legal_chat_history table: %v", err)
	}

	// Insert a test legal document
	doc := &models.LegalDocument{
		ID:            1,
		Title:         "Ley de Contratos",
		DocumentType:  "law",
		Content:       "Artículo 1. Disposiciones generales. Las contrataciones se rigen por la presente ley.",
		ContentHash:   "test123",
		Language:      "es",
		Jurisdiction:  "Cuba",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		CompanyID:     1,
		UploadedBy:    1,
		StoragePath:   "data/legal_corpus/1/test123.pdf",
		MimeType:      "application/pdf",
		SizeBytes:     1024,
		ChunkConfig:   `{"size":1000,"overlap":200,"strategy":"structured"}`,
		IsIndexed:     false,
	}
	_, err = database.Exec(`
		INSERT INTO legal_documents (
			id, title, document_type, content, content_hash,
			language, jurisdiction, created_at, updated_at,
			company_id, uploaded_by, storage_path, mime_type,
			size_bytes, chunk_config, is_indexed
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, doc.ID, doc.Title, doc.DocumentType, doc.Content, doc.ContentHash,
		doc.Language, doc.Jurisdiction, doc.CreatedAt, doc.UpdatedAt,
		doc.CompanyID, doc.UploadedBy, doc.StoragePath, doc.MimeType,
		doc.SizeBytes, doc.ChunkConfig, doc.IsIndexed)
	if err != nil {
		t.Fatalf("failed to insert test legal document: %v", err)
	}

	t.Cleanup(func() {
		database.Close()
	})

	return database
}

// setupTestService creates a MiniRAG service with temporary storage.
func setupTestService(t *testing.T) *minirag.Service {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "minirag.db")
	svc, err := minirag.NewService("", dbPath)
	require.NoError(t, err)
	return svc
}

// TestChatService_Integration tests the full chat flow with RAG and LLM.
func TestChatService_Integration(t *testing.T) {
	// Skip if embedder not available (similar to other tests)
	modelPath := filepath.Join("internal/ai/minirag/models", "paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := testing.ReadFile(modelPath); err != nil {
		t.Skip("GGUF model file not found")
	}
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set")
	}

	// Setup dependencies
	dbConn := setupTestDB(t)
	queries := db.New(dbConn)
	svc := setupTestService(t)
	defer svc.Close()

	// Index the test legal document into RAG
	indexer := minirag.NewIndexer(queries, svc)
	doc := &models.LegalDocument{
		ID:           1,
		Title:        "Ley de Contratos",
		DocumentType: "law",
		Content:      "Artículo 1. Disposiciones generales. Las contrataciones se rigen por la presente ley.",
		ContentHash:  "test123",
		Language:     "es",
		Jurisdiction: "Cuba",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	if err := indexer.IndexLegalDocument(doc); err != nil {
		t.Fatalf("IndexLegalDocument failed: %v", err)
	}

	// Prepare LLM client using local CGo mode (placeholder response)
	localClient := minirag.NewLocalClient("cgo", "qwen2.5-0.5b-instruct-q4_0.gguf", "")
	llmClient := &ai.LLMClient{
		Provider:    ai.ProviderCustom,
		Model:       "qwen2.5-0.5b-instruct-q4_0.gguf",
		LocalClient: localClient,
	}

	// Create chat service
	chatSvc := legal.NewChatService(queries, svc, llmClient)

	// Process a message
	msg := legal.ChatMessage{
		SessionID: "sess-test-" + fmt.Sprintf("%d", time.Now().UnixNano()),
		UserID:    1,
		Content:   "¿Qué dice el artículo 1?",
	}
	resp, err := chatSvc.ProcessMessage(context.Background(), msg)
	if err != nil {
		t.Fatalf("ProcessMessage failed: %v", err)
	}
	if resp.Answer == "" {
		t.Error("expected non-empty answer")
	}
}
