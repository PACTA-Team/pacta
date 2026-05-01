package minirag

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/PACTA-Team/pacta/internal/models"
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

func setupTestVectorDB(t *testing.T) *VectorDB {
	t.Helper()

	tmpDir := t.TempDir()
	vectorDB, err := NewVectorDB(384, tmpDir)
	if err != nil {
		t.Fatalf("failed to create vector DB: %v", err)
	}

	return vectorDB
}

func TestIndexLegalDocument(t *testing.T) {
	db := setupTestDB(t)
	vectorDB := setupTestVectorDB(t)

	// Create mock embedding client
	embedder := &mockEmbeddingClient{}

	indexer := &Indexer{
		DB:           db,
		VectorDB:     vectorDB,
		Embedder:     embedder,
		ChunkSize:    500,
		ChunkOverlap: 50,
	}

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

	err := indexer.IndexLegalDocument(doc)
	if err != nil {
		t.Fatalf("IndexLegalDocument failed: %v", err)
	}

	// Verify chunks were created in vector DB
	vectorCount := vectorDB.Count()
	if vectorCount == 0 {
		t.Error("Expected chunks to be created in vector DB")
	}

	// Verify chunks have correct metadata
	for i := 0; i < vectorCount; i++ {
		chunkID := fmt.Sprintf("legal_%d_chunk_%d", doc.ID, i)
		meta, ok := vectorDB.GetDocument(chunkID)
		if !ok {
			t.Errorf("Chunk %s not found in vector DB", chunkID)
			continue
		}
		if meta.Source != "legal" {
			t.Errorf("Expected source 'legal', got '%s'", meta.Source)
		}
		if meta.ExtraFields["jurisdiction"] != "Cuba" {
			t.Errorf("Expected jurisdiction 'Cuba', got '%s'", meta.ExtraFields["jurisdiction"])
		}
	}

	// Verify legal_documents table: chunk_count and indexed_at updated
	var dbChunkCount int
	var indexedAt sql.NullTime
	err = db.QueryRow("SELECT chunk_count, indexed_at FROM legal_documents WHERE id = ?", doc.ID).Scan(&dbChunkCount, &indexedAt)
	if err != nil {
		t.Fatalf("Failed to query legal_documents: %v", err)
	}
	if dbChunkCount != vectorCount {
		t.Errorf("chunk_count mismatch: DB=%d, VectorDB=%d", dbChunkCount, vectorCount)
	}
	if !indexedAt.Valid {
		t.Error("indexed_at should be set after indexing")
	}
}
