package db

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// setupLegalTestDB creates an in-memory SQLite database with all tables
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

	// Create base tables (simplified from actual schema)
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
			jurisdiction TEXT DEFAULT 'cuba',
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
		`CREATE TABLE IF NOT EXISTS ai_legal_chat_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			session_id TEXT NOT NULL,
			message_type TEXT NOT NULL,
			content TEXT NOT NULL,
			context_documents TEXT,
			metadata TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS document_chunks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			document_id INTEGER NOT NULL,
			chunk_index INTEGER NOT NULL,
			content TEXT NOT NULL,
			metadata TEXT,
			embedding TEXT,
			source TEXT DEFAULT 'contract',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, stmt := range tables {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("failed to create table: %v\nstmt: %s", err, stmt)
		}
	}

	return db
}

func TestCreateLegalDocument(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	arg := CreateLegalDocumentParams{
		Title:         "Test Law",
		DocumentType:  "law",
		Source:        "test.pdf",
		Content:       "Artículo 1. Test content",
		ContentHash:   "hash123",
		Language:      "es",
		Jurisdiction:  "Cuba",
		EffectiveDate: nil,
		Tags:          []string{"test", "law"},
		ChunkCount:    0,
		IndexedAt:     nil,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	doc, err := CreateLegalDocument(ctx, db, arg)
	if err != nil {
		t.Fatalf("CreateLegalDocument failed: %v", err)
	}

	if doc.ID == 0 {
		t.Error("Expected non-zero ID")
	}
	if doc.Title != arg.Title {
		t.Errorf("Expected title %s, got %s", arg.Title, doc.Title)
	}
	if doc.DocumentType != arg.DocumentType {
		t.Errorf("Expected type %s, got %s", arg.DocumentType, doc.DocumentType)
	}
	if len(doc.Tags) != 2 {
		t.Errorf("Expected 2 tags, got %d", len(doc.Tags))
	}
}

func TestGetLegalDocument(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	// Insert test doc
	arg := CreateLegalDocumentParams{
		Title:         "Ley de Prueba",
		DocumentType:  "ley",
		Content:       "Contenido de prueba",
		ContentHash:   "hash456",
		Language:      "es",
		Jurisdiction:  "Cuba",
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	created, err := CreateLegalDocument(ctx, db, arg)
	if err != nil {
		t.Fatalf("Setup failed: %v", err)
	}

	// Retrieve it
	doc, err := GetLegalDocument(ctx, db, int64(created.ID))
	if err != nil {
		t.Fatalf("GetLegalDocument failed: %v", err)
	}

	if doc.ID != created.ID {
		t.Errorf("ID mismatch: %d vs %d", doc.ID, created.ID)
	}
	if doc.Title != "Ley de Prueba" {
		t.Errorf("Title mismatch: %s", doc.Title)
	}
}

func TestListLegalDocuments(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	// Insert two docs
	docs := []CreateLegalDocumentParams{
		{
			Title:         "Law 1",
			DocumentType:  "law",
			Content:       "Content 1",
			ContentHash:   "hash1",
			Language:      "es",
			Jurisdiction:  "Cuba",
			CreatedAt:     now,
			UpdatedAt:     now,
		},
		{
			Title:         "Law 2",
			DocumentType:  "law",
			Content:       "Content 2",
			ContentHash:   "hash2",
			Language:      "es",
			Jurisdiction:  "Cuba",
			CreatedAt:     now,
			UpdatedAt:     now,
		},
	}

	for _, d := range docs {
		_, err := CreateLegalDocument(ctx, db, d)
		if err != nil {
			t.Fatalf("Failed to create doc: %v", err)
		}
	}

	// List all
	listed, err := ListLegalDocuments(ctx, db, "")
	if err != nil {
		t.Fatalf("ListLegalDocuments failed: %v", err)
	}

	if len(listed) < 2 {
		t.Errorf("Expected at least 2 docs, got %d", len(listed))
	}

	// List by jurisdiction
	cubaDocs, err := ListLegalDocuments(ctx, db, "Cuba")
	if err != nil {
		t.Fatalf("List by jurisdiction failed: %v", err)
	}

	if len(cubaDocs) < 2 {
		t.Errorf("Expected at least 2 Cuba docs, got %d", len(cubaDocs))
	}
}

func TestUpdateLegalDocumentIndexedAt(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	arg := CreateLegalDocumentParams{
		Title:        "Indexed Law",
		DocumentType: "law",
		Content:      "Content",
		ContentHash:  "hash789",
		Language:     "es",
		Jurisdiction: "Cuba",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	doc, _ := CreateLegalDocument(ctx, db, arg)

	// Update indexed_at
	err := UpdateLegalDocumentIndexedAt(ctx, db, int64(doc.ID), 10)
	if err != nil {
		t.Fatalf("UpdateLegalDocumentIndexedAt failed: %v", err)
	}

	// Verify
	updated, err := GetLegalDocument(ctx, db, int64(doc.ID))
	if err != nil {
		t.Fatalf("Get updated doc failed: %v", err)
	}

	if updated.ChunkCount != 10 {
		t.Errorf("Expected chunk count 10, got %d", updated.ChunkCount)
	}
	if updated.IndexedAt == nil {
		t.Error("Expected indexed_at to be set")
	}
}

func TestDeleteLegalDocument(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	arg := CreateLegalDocumentParams{
		Title:        "To Delete",
		DocumentType: "law",
		Content:      "Delete me",
		ContentHash:  "delete123",
		Language:     "es",
		Jurisdiction: "Cuba",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	doc, _ := CreateLegalDocument(ctx, db, arg)

	// Delete
	err := DeleteLegalDocument(ctx, db, int64(doc.ID))
	if err != nil {
		t.Fatalf("DeleteLegalDocument failed: %v", err)
	}

	// Verify soft delete (deleted_at is set)
	_, err = GetLegalDocument(ctx, db, int64(doc.ID))
	if err == nil {
		t.Error("Expected document to be soft-deleted (should return error)")
	}
}

func TestGetLegalDocumentChunkCount(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	arg := CreateLegalDocumentParams{
		Title:        "Chunked Doc",
		DocumentType: "law",
		Content:      "Content",
		ContentHash:  "chunk456",
		Language:     "es",
		Jurisdiction: "Cuba",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	doc, _ := CreateLegalDocument(ctx, db, arg)

	// Initially 0 chunks
	count, err := GetLegalDocumentChunkCount(ctx, db, doc.ID)
	if err != nil {
		t.Fatalf("GetLegalDocumentChunkCount failed: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 chunks, got %d", count)
	}
}

func TestGetAILegalEnabled(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()

	// Default: disabled (setting not present)
	enabled, err := GetAILegalEnabled(ctx, db)
	if err != nil {
		t.Fatalf("GetAILegalEnabled failed: %v", err)
	}
	if enabled {
		t.Error("Expected disabled by default")
	}

	// Insert setting via direct DB
	_, err = db.ExecContext(ctx, `
		INSERT INTO system_settings (key, value, created_at, updated_at)
		VALUES ('ai_legal_enabled', 'true', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		t.Fatalf("Failed to insert setting: %v", err)
	}

	enabled, err = GetAILegalEnabled(ctx, db)
	if err != nil {
		t.Fatalf("GetAILegalEnabled after insert failed: %v", err)
	}
	if !enabled {
		t.Error("Expected enabled after setting true")
	}
}

func TestSetAILegalEnabled(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()

	// Enable
	err := SetAILegalEnabled(ctx, db, true)
	if err != nil {
		t.Fatalf("SetAILegalEnabled failed: %v", err)
	}

	enabled, err := GetAILegalEnabled(ctx, db)
	if err != nil {
		t.Fatalf("GetAILegalEnabled after set failed: %v", err)
	}
	if !enabled {
		t.Error("Expected enabled after setting")
	}

	// Disable
	err = SetAILegalEnabled(ctx, db, false)
	if err != nil {
		t.Fatalf("SetAILegalEnabled(false) failed: %v", err)
	}

	enabled, err = GetAILegalEnabled(ctx, db)
	if err != nil {
		t.Fatalf("GetAILegalEnabled after disable failed: %v", err)
	}
	if enabled {
		t.Error("Expected disabled after setting false")
	}
}

func TestCreateLegalChatMessage(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	arg := CreateLegalChatMessageParams{
		UserID:      1,
		SessionID:   "session-123",
		MessageType: "user",
		Content:     "¿Qué es un contrato?",
		CreatedAt:   now,
	}

	msg, err := CreateLegalChatMessage(ctx, db, arg)
	if err != nil {
		t.Fatalf("CreateLegalChatMessage failed: %v", err)
	}

	if msg.ID == 0 {
		t.Error("Expected non-zero ID")
	}
	if msg.UserID != 1 {
		t.Errorf("Expected user_id 1, got %d", msg.UserID)
	}
	if msg.Content != arg.Content {
		t.Errorf("Content mismatch")
	}
}

func TestListLegalChatMessages(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	// Insert multiple messages for same session
	messages := []CreateLegalChatMessageParams{
		{
			UserID:      1,
			SessionID:   "session-456",
			MessageType: "user",
			Content:     "Question 1",
			CreatedAt:   now,
		},
		{
			UserID:      1,
			SessionID:   "session-456",
			MessageType: "assistant",
			Content:     "Answer 1",
			CreatedAt:   now.Add(1 * time.Second),
		},
	}

	for _, m := range messages {
		_, err := CreateLegalChatMessage(ctx, db, m)
		if err != nil {
			t.Fatalf("Setup failed: %v", err)
		}
	}

	// List
	listed, err := ListLegalChatMessages(ctx, db, "session-456")
	if err != nil {
		t.Fatalf("ListLegalChatMessages failed: %v", err)
	}

	if len(listed) != 2 {
		t.Errorf("Expected 2 messages, got %d", len(listed))
	}

	// Verify order (ASC by created_at)
	if listed[0].Content != "Question 1" {
		t.Error("First message should be user question")
	}
	if listed[1].Content != "Answer 1" {
		t.Error("Second message should be assistant answer")
	}
}

func TestListLegalChatSessions(t *testing.T) {
	db := setupLegalTestDB(t)
	defer db.Close()

	ctx := context.Background()
	now := time.Now()

	// Insert messages for two different sessions by same user
	messages := []CreateLegalChatMessageParams{
		{
			UserID:      1,
			SessionID:   "session-1",
			MessageType: "user",
			Content:     "Question 1",
			CreatedAt:   now,
		},
		{
			UserID:      1,
			SessionID:   "session-1",
			MessageType: "assistant",
			Content:     "Answer 1",
			CreatedAt:   now.Add(1 * time.Second),
		},
		{
			UserID:      1,
			SessionID:   "session-2",
			MessageType: "user",
			Content:     "Question 2",
			CreatedAt:   now.Add(2 * time.Second),
		},
	}

	for _, m := range messages {
		_, err := CreateLegalChatMessage(ctx, db, m)
		if err != nil {
			t.Fatalf("Setup failed: %v", err)
		}
	}

	// List sessions
	sessions, err := ListLegalChatSessions(ctx, db, 1)
	if err != nil {
		t.Fatalf("ListLegalChatSessions failed: %v", err)
	}

	if len(sessions) != 2 {
		t.Errorf("Expected 2 sessions, got %d", len(sessions))
	}

	// Verify sessions are ordered by last_message DESC (session-2 should be first)
	if sessions[0].SessionID != "session-2" {
		t.Errorf("Expected first session to be session-2, got %s", sessions[0].SessionID)
	}
	if sessions[0].MessageCount != 1 {
		t.Errorf("Expected session-2 to have 1 message, got %d", sessions[0].MessageCount)
	}
	if sessions[1].MessageCount != 2 {
		t.Errorf("Expected session-1 to have 2 messages, got %d", sessions[1].MessageCount)
	}
}
