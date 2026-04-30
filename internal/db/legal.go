package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

// ========== TIPOS ==========

// LegalDocumentRow representa una fila de legal_documents
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
}

// CreateLegalDocumentParams parámetros para crear documento legal
type CreateLegalDocumentParams struct {
	Title            string     `json:"title"`
	DocumentType     string     `json:"document_type"`
	Source           string     `json:"source,omitempty"`
	Content          string     `json:"content"`
	ContentHash      string     `json:"content_hash"`
	Language         string     `json:"language"`
	Jurisdiction     string     `json:"jurisdiction"`
	EffectiveDate    *string    `json:"effective_date,omitempty"`
	PublicationDate  *string    `json:"publication_date,omitempty"`
	GacetaNumber     string     `json:"gaceta_number,omitempty"`
	Tags             []string   `json:"tags"`
	ChunkCount       int        `json:"chunk_count"`
	IndexedAt        *time.Time `json:"indexed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// LegalChatMessageRow representa una fila de ai_legal_chat_history
type LegalChatMessageRow struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	SessionID       string    `json:"session_id"`
	MessageType     string    `json:"message_type"`
	Content         string    `json:"content"`
	ContextDocs     string    `json:"context_documents,omitempty"`
	Metadata        string    `json:"metadata,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// CreateLegalChatMessageParams parámetros para crear mensaje de chat
type CreateLegalChatMessageParams struct {
	UserID          int64     `json:"user_id"`
	SessionID       string    `json:"session_id"`
	MessageType     string    `json:"message_type"`
	Content         string    `json:"content"`
	ContextDocuments string   `json:"context_documents,omitempty"`
	Metadata        string    `json:"metadata,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// ========== LEGAL DOCUMENTS ==========

// CreateLegalDocument inserta un nuevo documento legal
func CreateLegalDocument(ctx context.Context, db *sql.DB, arg CreateLegalDocumentParams) (LegalDocumentRow, error) {
	tagsJSON, _ := json.Marshal(arg.Tags)

	row := db.QueryRowContext(ctx, `
		INSERT INTO legal_documents (
			title, document_type, source, content, content_hash,
			language, jurisdiction, effective_date, publication_date,
			gaceta_number, tags, chunk_count, indexed_at,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15
		)
		RETURNING id, title, document_type, source, content, content_hash,
		          language, jurisdiction, effective_date, publication_date,
		          gaceta_number, tags, chunk_count, indexed_at, created_at, updated_at
	`,
		arg.Title,
		arg.DocumentType,
		arg.Source,
		arg.Content,
		arg.ContentHash,
		arg.Language,
		arg.Jurisdiction,
		arg.EffectiveDate,
		arg.PublicationDate,
		arg.GacetaNumber,
		tagsJSON,
		arg.ChunkCount,
		arg.IndexedAt,
		arg.CreatedAt,
		arg.UpdatedAt,
	)

	var doc LegalDocumentRow
	var effectiveDate, publicationDate, indexedAt sql.NullTime
	var tagsJSONOut []byte

	err := row.Scan(
		&doc.ID,
		&doc.Title,
		&doc.DocumentType,
		&doc.Source,
		&doc.Content,
		&doc.ContentHash,
		&doc.Language,
		&doc.Jurisdiction,
		&effectiveDate,
		&publicationDate,
		&doc.GacetaNumber,
		&tagsJSONOut,
		&doc.ChunkCount,
		&indexedAt,
		&doc.CreatedAt,
		&doc.UpdatedAt,
	)

	if err != nil {
		return doc, err
	}

	// Parse dates
	if effectiveDate.Valid {
		ed := effectiveDate.Time.Format("2006-01-02")
		doc.EffectiveDate = &ed
	}
	if publicationDate.Valid {
		pd := publicationDate.Time.Format("2006-01-02")
		doc.PublicationDate = &pd
	}
	if indexedAt.Valid {
		ia := indexedAt.Time
		doc.IndexedAt = &ia
	}

	// Parse tags
	if len(tagsJSONOut) > 0 {
		json.Unmarshal(tagsJSONOut, &doc.Tags)
	}

	return doc, nil
}

// GetLegalDocument retrieves a legal document by ID
func GetLegalDocument(ctx context.Context, db *sql.DB, id int64) (LegalDocumentRow, error) {
	row := db.QueryRowContext(ctx, `
		SELECT id, title, document_type, source, content, content_hash,
		       language, jurisdiction, effective_date, publication_date,
		       gaceta_number, tags, chunk_count, indexed_at, created_at, updated_at
		FROM legal_documents
		WHERE id = $1 AND deleted_at IS NULL
		LIMIT 1
	`, id)

	var doc LegalDocumentRow
	var tagsJSON []byte
	var effectiveDate, publicationDate, indexedAt sql.NullTime

	err := row.Scan(
		&doc.ID,
		&doc.Title,
		&doc.DocumentType,
		&doc.Source,
		&doc.Content,
		&doc.ContentHash,
		&doc.Language,
		&doc.Jurisdiction,
		&effectiveDate,
		&publicationDate,
		&doc.GacetaNumber,
		&tagsJSON,
		&doc.ChunkCount,
		&indexedAt,
		&doc.CreatedAt,
		&doc.UpdatedAt,
	)

	if err != nil {
		return doc, err
	}

	// Parse nullable fields
	if effectiveDate.Valid {
		ed := effectiveDate.Time.Format("2006-01-02")
		doc.EffectiveDate = &ed
	}
	if publicationDate.Valid {
		pd := publicationDate.Time.Format("2006-01-02")
		doc.PublicationDate = &pd
	}
	if indexedAt.Valid {
		ia := indexedAt.Time
		doc.IndexedAt = &ia
	}

	if len(tagsJSON) > 0 {
		json.Unmarshal(tagsJSON, &doc.Tags)
	}

	return doc, nil
}

// ListLegalDocuments retrieves all legal documents (optionally filtered by jurisdiction)
func ListLegalDocuments(ctx context.Context, db *sql.DB, jurisdiction string) ([]LegalDocumentRow, error) {
	query := `
		SELECT id, title, document_type, source, content, content_hash,
		       language, jurisdiction, effective_date, publication_date,
		       gaceta_number, tags, chunk_count, indexed_at, created_at, updated_at
		FROM legal_documents
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}

	if jurisdiction != "" {
		query += " AND jurisdiction = $1"
		args = append(args, jurisdiction)
	}

	query += " ORDER BY created_at DESC"

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []LegalDocumentRow
	for rows.Next() {
		var doc LegalDocumentRow
		var tagsJSON []byte
		var effectiveDate, publicationDate, indexedAt sql.NullTime

		err := rows.Scan(
			&doc.ID,
			&doc.Title,
			&doc.DocumentType,
			&doc.Source,
			&doc.Content,
			&doc.ContentHash,
			&doc.Language,
			&doc.Jurisdiction,
			&effectiveDate,
			&publicationDate,
			&doc.GacetaNumber,
			&tagsJSON,
			&doc.ChunkCount,
			&indexedAt,
			&doc.CreatedAt,
			&doc.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Parse dates
		if effectiveDate.Valid {
			ed := effectiveDate.Time.Format("2006-01-02")
			doc.EffectiveDate = &ed
		}
		if publicationDate.Valid {
			pd := publicationDate.Time.Format("2006-01-02")
			doc.PublicationDate = &pd
		}
		if indexedAt.Valid {
			ia := indexedAt.Time
			doc.IndexedAt = &ia
		}

		// Parse tags
		if len(tagsJSON) > 0 {
			json.Unmarshal(tagsJSON, &doc.Tags)
		}

		docs = append(docs, doc)
	}

	return docs, rows.Err()
}

// UpdateLegalDocumentIndexedAt updates the indexed_at timestamp and chunk_count
func UpdateLegalDocumentIndexedAt(ctx context.Context, db *sql.DB, id int64, chunkCount int) error {
	_, err := db.ExecContext(ctx, `
		UPDATE legal_documents
		SET indexed_at = CURRENT_TIMESTAMP, chunk_count = $2
		WHERE id = $1 AND deleted_at IS NULL
	`, id, chunkCount)
	return err
}

// DeleteLegalDocument soft-deletes a legal document
func DeleteLegalDocument(ctx context.Context, db *sql.DB, id int64) error {
	_, err := db.ExecContext(ctx, `
		UPDATE legal_documents
		SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND deleted_at IS NULL
	`, id)
	return err
}



// ========== LEGAL CHAT ==========

// CreateLegalChatMessage inserts a chat message
func CreateLegalChatMessage(ctx context.Context, db *sql.DB, arg CreateLegalChatMessageParams) (LegalChatMessageRow, error) {
	row := db.QueryRowContext(ctx, `
		INSERT INTO ai_legal_chat_history (
			user_id, session_id, message_type, content,
			context_documents, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, session_id, message_type, content,
		          context_documents, metadata, created_at
	`,
		arg.UserID,
		arg.SessionID,
		arg.MessageType,
		arg.Content,
		arg.ContextDocuments,
		arg.Metadata,
		arg.CreatedAt,
	)

	var msg LegalChatMessageRow
	err := row.Scan(
		&msg.ID,
		&msg.UserID,
		&msg.SessionID,
		&msg.MessageType,
		&msg.Content,
		&msg.ContextDocs,
		&msg.Metadata,
		&msg.CreatedAt,
	)

	return msg, err
}

// ListLegalChatMessages returns messages for a session
func ListLegalChatMessages(ctx context.Context, db *sql.DB, sessionID string) ([]LegalChatMessageRow, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, user_id, session_id, message_type, content,
		       context_documents, metadata, created_at
		FROM ai_legal_chat_history
		WHERE session_id = $1
		ORDER BY created_at ASC
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []LegalChatMessageRow
	for rows.Next() {
		var msg LegalChatMessageRow
		err := rows.Scan(
			&msg.ID,
			&msg.UserID,
			&msg.SessionID,
			&msg.MessageType,
			&msg.Content,
			&msg.ContextDocs,
			&msg.Metadata,
			&msg.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		msgs = append(msgs, msg)
	}

	return msgs, rows.Err()
}

// ========== SIMILARITY SEARCH ==========



// ========== CHAT SESSIONS ==========

// LegalChatSession represents a chat session summary
type LegalChatSession struct {
	SessionID    string    `json:"session_id"`
	UserID       int       `json:"user_id"`
	LastMessage  time.Time `json:"last_message"`
	CreatedAt    time.Time `json:"created_at"`
	MessageCount int       `json:"message_count"`
}

// ListLegalChatSessions returns all chat sessions for a user
func ListLegalChatSessions(ctx context.Context, db *sql.DB, userID int) ([]LegalChatSession, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT 
			session_id,
			user_id,
			MAX(created_at) as last_message,
			MIN(created_at) as created_at,
			COUNT(*) as message_count
		FROM ai_legal_chat_history
		WHERE user_id = $1
		GROUP BY session_id, user_id
		ORDER BY last_message DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []LegalChatSession
	for rows.Next() {
		var s LegalChatSession
		err := rows.Scan(&s.SessionID, &s.UserID, &s.LastMessage, &s.CreatedAt, &s.MessageCount)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}

	return sessions, rows.Err()
}

// ========== SETTINGS ==========

// GetAILegalEnabled returns whether AI legal is enabled
func GetAILegalEnabled(ctx context.Context, db *sql.DB) (bool, error) {
	row := db.QueryRowContext(ctx, `
		SELECT value FROM system_settings
		WHERE key = 'ai_legal_enabled' AND deleted_at IS NULL
		LIMIT 1
	`)

	var val string
	err := row.Scan(&val)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil // default: disabled
		}
		return false, err
	}

	return val == "true" || val == "1", nil
}

// SetAILegalEnabled sets the ai_legal_enabled setting
func SetAILegalEnabled(ctx context.Context, db *sql.DB, enabled bool) error {
	val := "false"
	if enabled {
		val = "true"
	}

	_, err := db.ExecContext(ctx, `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ('ai_legal_enabled', $1, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
	`, val)

	return err
}

// AILegalIntegrationEnabled returns whether form integration is enabled
func AILegalIntegrationEnabled(ctx context.Context, db *sql.DB) (bool, error) {
	row := db.QueryRowContext(ctx, `
		SELECT value FROM system_settings
		WHERE key = 'ai_legal_integration' AND deleted_at IS NULL
		LIMIT 1
	`)

	var val string
	err := row.Scan(&val)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return val == "true" || val == "1", nil
}
