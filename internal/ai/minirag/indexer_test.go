package minirag

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/models"
	"github.com/stretchr/testify/require"
)

// mockEmbeddingClient is a test client that returns deterministic embeddings
type mockEmbeddingClient struct{}

func (m *mockEmbeddingClient) GenerateEmbedding(text string) ([]float32, error) {
	emb := make([]float32, 384)
	// Simple hash-based embedding for testing
	hash := 0
	for _, ch := range text {
		hash = hash*31 + int(ch)
	}
	for i := range emb {
		emb[i] = float32((hash+i)%1000) / 1000.0
	}
	return normalizeVector(emb), nil
}

func (m *mockEmbeddingClient) GenerateBatchEmbeddings(texts []string) ([][]float32, error) {
	embeddings := make([][]float32, len(texts))
	for i, text := range texts {
		emb, err := m.GenerateEmbedding(text)
		if err != nil {
			return nil, err
		}
		embeddings[i] = emb
	}
	return embeddings, nil
}

func (m *mockEmbeddingClient) CheckHealth() bool {
	return true
}

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Create a temporary database for testing
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	// Create legal_documents table (complete schema)
	_, err = db.Exec(`
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

	// Note: document_chunks table is no longer used (VectorDB persisted as JSON)
	// No need to create it

	// Insert a test document
	doc := &models.LegalDocument{
		ID:           1,
		Title:        "Ley de Contratos",
		DocumentType: "law",
		Content:      "Artículo 1. Disposiciones generales. Las contrataciones se rigen por la presente ley.",
		ContentHash:  "test123",
		Language:     "es",
		Jurisdiction: "Cuba",
		CompanyID:    1,
		UploadedBy:   1,
		StoragePath:  "data/legal_corpus/1/test123.pdf",
		MimeType:     "application/pdf",
		SizeBytes:    1024,
		ChunkConfig:  `{"size":1000,"overlap":200,"strategy":"structured"}`,
		IsIndexed:    false,
	}

	_, err = db.Exec(`
		INSERT INTO legal_documents (
			id, title, document_type, content, content_hash,
			language, jurisdiction, company_id, uploaded_by,
			storage_path, mime_type, size_bytes, chunk_config, is_indexed
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		doc.ID, doc.Title, doc.DocumentType, doc.Content, doc.ContentHash,
		doc.Language, doc.Jurisdiction, doc.CompanyID, doc.UploadedBy,
		doc.StoragePath, doc.MimeType, doc.SizeBytes, doc.ChunkConfig, doc.IsIndexed)
	if err != nil {
		t.Fatalf("failed to insert test document: %v", err)
	}

	t.Cleanup(func() {
		db.Close()
	})

	return db
}



	return vectorDB
}

func TestIndexLegalDocument(t *testing.T) {
	// Skip if embedder not available
	modelPath := filepath.Join(os.Getenv("PWD"), "internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found")
	}
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set")
	}

	dbConn := setupTestDB(t)
	// Create RAG service
	tmpDir := t.TempDir()
	svc, err := minirag.NewService("", filepath.Join(tmpDir, "minirag.db"))
	require.NoError(t, err)
	defer svc.Close()

	// Create queries and indexer
	queries := db.NewQueries(dbConn)
	indexer := minirag.NewIndexer(queries, svc)

	content := `Artículo 1. Disposiciones generales.
Las contrataciones se rigen por la presente ley.`

	doc := &models.LegalDocument{
		ID:           1,
		Title:        "Ley de Contratos",
		DocumentType: "law",
		Content:      content,
		ContentHash:  "test123",
		Language:     "es",
		Jurisdiction: "Cuba",
	}

	err = indexer.IndexLegalDocument(doc)
	if err != nil {
		t.Fatalf("IndexLegalDocument failed: %v", err)
	}

	// Verify chunks were created
	count, err := svc.Count()
	if err != nil {
		t.Fatalf("Failed to get chunk count: %v", err)
	}
	if count == 0 {
		t.Error("Expected chunks to be created")
	}

	// Verify legal_documents table: chunk_count and indexed_at updated
	var dbChunkCount int
	var indexedAt sql.NullTime
	err = dbConn.QueryRow("SELECT chunk_count, indexed_at FROM legal_documents WHERE id = ?", doc.ID).Scan(&dbChunkCount, &indexedAt)
	if err != nil {
		t.Fatalf("Failed to query legal_documents: %v", err)
	}
	if dbChunkCount != count {
		t.Errorf("chunk_count mismatch: DB=%d, Service=%d", dbChunkCount, count)
	}
	if !indexedAt.Valid {
		t.Error("indexed_at should be set after indexing")
	}
}
