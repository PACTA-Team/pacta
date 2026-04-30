package legal

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "path/filepath"
    "testing"
    "time"

    _ "modernc.org/sqlite"

    "github.com/PACTA-Team/pacta/internal/ai"
    "github.com/PACTA-Team/pacta/internal/ai/minirag"
    "github.com/PACTA-Team/pacta/internal/db"
    "github.com/PACTA-Team/pacta/internal/models"
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
            deleted_at TEXT
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
    }
    _, err = database.Exec(`
        INSERT INTO legal_documents (id, title, document_type, content, content_hash, language, jurisdiction, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, doc.ID, doc.Title, doc.DocumentType, doc.Content, doc.ContentHash, doc.Language, doc.Jurisdiction, doc.CreatedAt, doc.UpdatedAt)
    if err != nil {
        t.Fatalf("failed to insert test legal document: %v", err)
    }

    t.Cleanup(func() {
        database.Close()
    })

    return database
}

// setupTestVectorDB creates a temporary vector database for testing.
func setupTestVectorDB(t *testing.T) *minirag.VectorDB {
    t.Helper()
    tmpDir := t.TempDir()
    vdb, err := minirag.NewVectorDB(384, tmpDir)
    if err != nil {
        t.Fatalf("failed to create vector DB: %v", err)
    }
    return vdb
}

// TestChatService_Integration tests the full chat flow with RAG and LLM.
func TestChatService_Integration(t *testing.T) {
    // Setup dependencies
    db := setupTestDB(t)
    vectorDB := setupTestVectorDB(t)
    embedder := minirag.NewEmbeddingClient("", "") // uses fallback embeddings
    // Index the test legal document into the vector DB
    indexer := minirag.NewIndexer(db, vectorDB, embedder)
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
    svc := legal.NewChatService(db, vectorDB, embedder, llmClient)

    // Process a message
    msg := legal.ChatMessage{
        SessionID: "test-session",
        UserID:    1,
        Content:   "¿Qué dice el artículo 1?",
    }
    answer, err := svc.ProcessMessage(context.Background(), msg)
    if err != nil {
        t.Fatalf("ProcessMessage failed: %v", err)
    }
    if answer == "" {
        t.Error("expected non-empty answer")
    }

    // Verify that messages were stored in DB
    var count int
    err = db.QueryRow("SELECT COUNT(*) FROM ai_legal_chat_history WHERE session_id = ?", msg.SessionID).Scan(&count)
    if err != nil {
        t.Fatalf("failed to count chat messages: %v", err)
    }
    if count != 2 { // user + assistant
        t.Errorf("expected 2 messages, got %d", count)
    }
}

// TestGetChatHistory tests retrieval of chat history.
func TestGetChatHistory(t *testing.T) {
    db := setupTestDB(t)
    vectorDB := setupTestVectorDB(t)
    embedder := minirag.NewEmbeddingClient("", "")
    indexer := minirag.NewIndexer(db, vectorDB, embedder)
    doc := &models.LegalDocument{
        ID:           2,
        Title:        "Ley de Contratos 2",
        DocumentType: "law",
        Content:      "Artículo 2. ...",
        ContentHash:  "test456",
        Language:     "es",
        Jurisdiction: "Cuba",
        CreatedAt:    time.Now(),
        UpdatedAt:    time.Now(),
    }
    if err := indexer.IndexLegalDocument(doc); err != nil {
        t.Fatalf("IndexLegalDocument failed: %v", err)
    }

    // Setup chat service with LLM placeholder to avoid real calls
    localClient := minirag.NewLocalClient("cgo", "", "")
    llmClient := &ai.LLMClient{
        Provider:    ai.ProviderCustom,
        LocalClient: localClient,
    }
    svc := legal.NewChatService(db, vectorDB, embedder, llmClient)

    // No messages yet - history should be empty
    msgs, err := svc.GetChatHistory("nonexistent")
    if err != nil {
        t.Fatalf("GetChatHistory error: %v", err)
    }
    if len(msgs) != 0 {
        t.Errorf("expected 0 messages, got %d", len(msgs))
    }

    // Send a message to create history
    _, err = svc.ProcessMessage(context.Background(), legal.ChatMessage{
        SessionID: "sess123",
        UserID:    2,
        Content:   "Pregunta de prueba",
    })
    if err != nil {
        t.Fatalf("ProcessMessage failed: %v", err)
    }

    // Retrieve history
    msgs, err = svc.GetChatHistory("sess123")
    if err != nil {
        t.Fatalf("GetChatHistory failed: %v", err)
    }
    if len(msgs) != 2 {
        t.Errorf("expected 2 messages, got %d", len(msgs))
    }
}
