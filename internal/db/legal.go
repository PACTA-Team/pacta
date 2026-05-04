package db

import (
	"context"
	"encoding/json"
	"time"
)

// ========== TYPES ==========

// LegalDocumentRow represents a row from legal_documents
type LegalDocumentRow struct {
	ID              int        `json:"id"`
	Title           string     `json:"title"`
	DocumentType    string     `json:"document_type"`
	Source          string     `json:"source,omitempty"`
	Content         string     `json:"content"`
	ContentHash     string     `json:"content_hash"`
	Language        string     `json:"language"`
	Jurisdiction    string     `json:"jurisdiction"`
	EffectiveDate   *string    `json:"effective_date,omitempty"`
	PublicationDate *string    `json:"publication_date,omitempty"`
	GacetaNumber    string     `json:"gaceta_number,omitempty"`
	Tags            []string   `json:"tags"`
	ChunkCount      int        `json:"chunk_count"`
	IndexedAt       *time.Time `json:"indexed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
	CompanyID       int        `json:"company_id"`
	UploadedBy      int        `json:"uploaded_by"`
	StoragePath     string     `json:"storage_path"`
	MimeType        string     `json:"mime_type,omitempty"`
	SizeBytes       int        `json:"size_bytes,omitempty"`
	ChunkConfig     string     `json:"chunk_config,omitempty"`
	IsIndexed       bool       `json:"is_indexed"`
}

// LegalChatMessageRow represents a row from ai_legal_chat_history
type LegalChatMessageRow struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	SessionID   string    `json:"session_id"`
	MessageType string    `json:"message_type"`
	Content     string    `json:"content"`
	ContextDocs string    `json:"context_documents,omitempty"`
	Metadata    string    `json:"metadata,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateLegalChatMessageParams parameters for creating a chat message
type CreateLegalChatMessageParams struct {
	UserID      int64
	SessionID   string
	MessageType string
	Content     string
	ContextDocs string
	Metadata    string
}

// LegalChatSession represents a chat session summary
type LegalChatSession struct {
	SessionID    string    `json:"session_id"`
	UserID       int       `json:"user_id"`
	LastMessage  time.Time `json:"last_message"`
	CreatedAt    time.Time `json:"created_at"`
	MessageCount int       `json:"message_count"`
}

// ========== LEGAL DOCUMENTS ==========

// GetAILegalEnabled returns whether AI legal is enabled using sqlc Queries
func GetAILegalEnabled(ctx context.Context, queries *Queries) (bool, error) {
	val, err := queries.GetBoolSetting(ctx, "ai_legal_enabled")
	if err != nil {
		return false, err
	}
	return val == "true" || val == "1", nil
}

// SetAILegalEnabled sets the ai_legal_enabled setting using sqlc Queries
func SetAILegalEnabled(ctx context.Context, queries *Queries, enabled bool) error {
	val := "false"
	if enabled {
		val = "true"
	}
	return queries.SetSettingValue(ctx, SetSettingValueParams{
		Key:   "ai_legal_enabled",
		Value: val,
	})
}

// AILegalIntegrationEnabled returns whether form integration is enabled
func AILegalIntegrationEnabled(ctx context.Context, queries *Queries) (bool, error) {
	val, err := queries.GetBoolSetting(ctx, "ai_legal_integration")
	if err != nil {
		return false, err
	}
	return val == "true" || val == "1", nil
}

// CreateLegalDocument creates a new legal document using sqlc Queries
// Returns a LegalDocumentRow
func CreateLegalDocument(ctx context.Context, queries *Queries, arg CreateLegalDocumentParams) (LegalDocumentRow, error) {
	tagsJSON, err := json.Marshal(arg.Tags)
	if err != nil {
		return LegalDocumentRow{}, err
	}

	row, err := queries.CreateLegalDocument(ctx, CreateLegalDocumentParams{
		Title:           arg.Title,
		DocumentType:    arg.DocumentType,
		Source:          arg.Source,
		Content:         arg.Content,
		ContentHash:     arg.ContentHash,
		Language:        arg.Language,
		Jurisdiction:    arg.Jurisdiction,
		EffectiveDate:   arg.EffectiveDate,
		PublicationDate: arg.PublicationDate,
		GacetaNumber:    arg.GacetaNumber,
		Tags:            string(tagsJSON),
		ChunkCount:      arg.ChunkCount,
		IndexedAt:       arg.IndexedAt,
		CreatedAt:       arg.CreatedAt,
		UpdatedAt:       arg.UpdatedAt,
	})
	if err != nil {
		return LegalDocumentRow{}, err
	}

	return legalDocumentRowFromDB(row), nil
}

// GetLegalDocument retrieves a legal document by ID using sqlc Queries
func GetLegalDocument(ctx context.Context, queries *Queries, id int64) (LegalDocumentRow, error) {
	row, err := queries.GetLegalDocument(ctx, id)
	if err != nil {
		return LegalDocumentRow{}, err
	}
	return legalDocumentRowFromDB(row), nil
}

// ListLegalDocuments retrieves legal documents using sqlc Queries
func ListLegalDocuments(ctx context.Context, queries *Queries, jurisdiction string) ([]LegalDocumentRow, error) {
	rows, err := queries.ListLegalDocuments(ctx, jurisdiction)
	if err != nil {
		return nil, err
	}

	var docs []LegalDocumentRow
	for _, r := range rows {
		docs = append(docs, legalDocumentRowFromDB(r))
	}
	return docs, nil
}

// UpdateLegalDocumentIndexed updates the indexed_at and chunk_count
func UpdateLegalDocumentIndexed(ctx context.Context, queries *Queries, id int64, chunkCount int) error {
	return queries.UpdateLegalDocumentIndexed(ctx, UpdateLegalDocumentIndexedParams{
		ID:         id,
		ChunkCount: chunkCount,
	})
}

// DeleteLegalDocument soft-deletes a legal document
func DeleteLegalDocument(ctx context.Context, queries *Queries, id int64) error {
	return queries.DeleteLegalDocument(ctx, id)
}

// GetLegalDocumentChunkCount returns the chunk count for a document
func GetLegalDocumentChunkCount(ctx context.Context, queries *Queries, documentID int64) (int, error) {
	var count int
	err := queries.GetLegalDocumentChunkCount(ctx, documentID).Scan(&count)
	return count, err
}

// CountLegalDocuments returns the total count of non-deleted legal documents
func CountLegalDocuments(ctx context.Context, queries *Queries) (int, error) {
	return queries.CountLegalDocuments(ctx)
}

// GetLastLegalDocumentIndexTime returns the most recent indexed_at time
func GetLastLegalDocumentIndexTime(ctx context.Context, queries *Queries) (sql.NullTime, error) {
	return queries.GetLastLegalDocumentIndexTime(ctx)
}

// ========== LEGAL CHAT ==========

// CreateLegalChatMessage inserts a chat message using sqlc Queries
func CreateLegalChatMessage(ctx context.Context, queries *Queries, arg CreateLegalChatMessageParams) (LegalChatMessageRow, error) {
	row, err := queries.CreateLegalChatMessage(ctx, CreateLegalChatMessageParams{
		UserID:      arg.UserID,
		SessionID:   arg.SessionID,
		MessageType: arg.MessageType,
		Content:     arg.Content,
		ContextDocs: arg.ContextDocs,
		Metadata:    arg.Metadata,
	})
	if err != nil {
		return LegalChatMessageRow{}, err
	}

	return LegalChatMessageRow{
		ID:          int(row.ID),
		UserID:      int(row.UserID),
		SessionID:   row.SessionID,
		MessageType: row.MessageType,
		Content:     row.Content,
		ContextDocs: row.ContextDocuments,
		Metadata:    row.Metadata,
		CreatedAt:   row.CreatedAt,
	}, nil
}

// ListLegalChatMessages returns messages for a session using sqlc Queries
func ListLegalChatMessages(ctx context.Context, queries *Queries, sessionID string) ([]LegalChatMessageRow, error) {
	rows, err := queries.GetLegalChatHistoryBySession(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	var msgs []LegalChatMessageRow
	for _, r := range rows {
		msgs = append(msgs, LegalChatMessageRow{
			ID:          int(r.ID),
			UserID:      int(r.UserID),
			SessionID:   r.SessionID,
			MessageType: r.MessageType,
			Content:     r.Content,
			ContextDocs: r.ContextDocuments,
			Metadata:    r.Metadata,
			CreatedAt:   r.CreatedAt,
		})
	}
	return msgs, nil
}

// ListLegalChatSessions returns all chat sessions for a user using sqlc Queries
func ListLegalChatSessions(ctx context.Context, queries *Queries, userID int) ([]LegalChatSession, error) {
	rows, err := queries.GetLegalChatSessionsByUser(ctx, int64(userID))
	if err != nil {
		return nil, err
	}

	var sessions []LegalChatSession
	for _, r := range rows {
		sessions = append(sessions, LegalChatSession{
			SessionID:    r.SessionID,
			UserID:       int(r.UserID),
			LastMessage:  r.LastMessage,
			CreatedAt:    r.CreatedAt,
			MessageCount: int(r.MessageCount),
		})
	}
	return sessions, nil
}

// DeleteLegalChatSession soft-deletes a chat session
func DeleteLegalChatSession(ctx context.Context, queries *Queries, sessionID string) error {
	return queries.DeleteLegalChatSession(ctx, sessionID)
}

// ========== HELPERS ==========

// legalDocumentRowFromDB converts a sqlc-generated row to LegalDocumentRow
func legalDocumentRowFromDB(row GetLegalDocumentRow) LegalDocumentRow {
	r := LegalDocumentRow{
		ID:           int(row.ID),
		Title:        row.Title,
		DocumentType: row.DocumentType,
		Source:       row.Source,
		Content:      row.Content,
		ContentHash:  row.ContentHash,
		Language:     row.Language,
		Jurisdiction: row.Jurisdiction,
		ChunkCount:   int(row.ChunkCount),
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
		CompanyID:    int(row.CompanyID),
		UploadedBy:   int(row.UploadedBy),
		StoragePath:  row.StoragePath,
		MimeType:     row.MimeType,
		SizeBytes:    int(row.SizeBytes),
		ChunkConfig:  row.ChunkConfig,
		IsIndexed:    row.IsIndexed,
	}

	if row.EffectiveDate.Valid {
		ed := row.EffectiveDate.Time.Format("2006-01-02")
		r.EffectiveDate = &ed
	}
	if row.PublicationDate.Valid {
		pd := row.PublicationDate.Time.Format("2006-01-02")
		r.PublicationDate = &pd
	}
	if row.IndexedAt.Valid {
		r.IndexedAt = &row.IndexedAt.Time
	}
	if row.DeletedAt.Valid {
		r.DeletedAt = &row.DeletedAt.Time
	}

	// Parse tags JSON
	if len(row.Tags) > 0 && row.Tags[0] == '[' {
		json.Unmarshal(row.Tags, &r.Tags)
	}

	return r
}
