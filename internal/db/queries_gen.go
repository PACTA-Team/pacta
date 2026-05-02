package db

import (
	"context"
	"database/sql"
	"time"
)

// Queries is the sqlc-generated query runner.
type Queries struct {
	db *sql.DB
}

// New creates a new Queries instance.
func New(db *sql.DB) *Queries {
	return &Queries{db: db}
}

// GetBoolSetting returns a setting value as a string.
func (q *Queries) GetBoolSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := q.db.QueryRowContext(ctx, "SELECT value FROM system_settings WHERE key = ? AND deleted_at IS NULL LIMIT 1", key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetSettingValue returns a setting value by key.
func (q *Queries) GetSettingValue(ctx context.Context, key string) (string, error) {
	var value string
	err := q.db.QueryRowContext(ctx, "SELECT value FROM system_settings WHERE key = ? AND deleted_at IS NULL LIMIT 1", key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetSettingsByKeys returns settings for the given keys.
func (q *Queries) GetSettingsByKeys(ctx context.Context, keys []string) ([]struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	query := "SELECT key, value FROM system_settings WHERE deleted_at IS NULL AND key IN ("
	args := make([]interface{}, len(keys))
	for i, k := range keys {
		if i > 0 {
			query += ", "
		}
		query += "?"
		args[i] = k
	}
	query += ")"
	rows, err := q.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	for rows.Next() {
		var r struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		if err := rows.Scan(&r.Key, &r.Value); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// SetSettingValue sets a setting value.
func (q *Queries) SetSettingValue(ctx context.Context, arg SetSettingValueParams) error {
	_, err := q.db.ExecContext(ctx, `
		INSERT INTO system_settings (key, value, category, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			category = excluded.category,
			updated_at = CURRENT_TIMESTAMP
	`, arg.Key, arg.Value, arg.Category)
	return err
}

// GetAllSettings returns all settings.
func (q *Queries) GetAllSettings(ctx context.Context) ([]struct {
	ID        int    `json:"id"`
	Key       string `json:"key"`
	Value     string `json:"value"`
	Category  string `json:"category"`
	UpdatedBy int    `json:"updated_by"`
	UpdatedAt string `json:"updated_at"`
}, error) {
	rows, err := q.db.QueryContext(ctx, "SELECT id, key, value, category, updated_by, updated_at FROM system_settings WHERE deleted_at IS NULL ORDER BY category, key")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []struct {
		ID        int    `json:"id"`
		Key       string `json:"key"`
		Value     string `json:"value"`
		Category  string `json:"category"`
		UpdatedBy int    `json:"updated_by"`
		UpdatedAt string `json:"updated_at"`
	}
	for rows.Next() {
		var r struct {
			ID        int    `json:"id"`
			Key       string `json:"key"`
			Value     string `json:"value"`
			Category  string `json:"category"`
			UpdatedBy int    `json:"updated_by"`
			UpdatedAt string `json:"updated_at"`
		}
		if err := rows.Scan(&r.ID, &r.Key, &r.Value, &r.Category, &r.UpdatedBy, &r.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// UpdateSettingValue updates a setting value.
func (q *Queries) UpdateSettingValue(ctx context.Context, arg UpdateSettingValueParams) error {
	_, err := q.db.ExecContext(ctx, "UPDATE system_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND deleted_at IS NULL", arg.Value, arg.UpdatedBy, arg.Key)
	return err
}

// DeleteSetting soft-deletes a setting.
func (q *Queries) DeleteSetting(ctx context.Context, key string) error {
	_, err := q.db.ExecContext(ctx, "UPDATE system_settings SET deleted_at = CURRENT_TIMESTAMP WHERE key = ? AND deleted_at IS NULL", key)
	return err
}

// ========== ai_legal queries ==========

// CreateLegalDocument creates a new legal document.
func (q *Queries) CreateLegalDocument(ctx context.Context, arg CreateLegalDocumentParams) (GetLegalDocumentRow, error) {
	row := GetLegalDocumentRow{}
	err := q.db.QueryRowContext(ctx, `
		INSERT INTO legal_documents (
			title, document_type, source, content, content_hash,
			language, jurisdiction, effective_date, publication_date,
			gaceta_number, tags, chunk_count, indexed_at,
			created_at, updated_at
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
		RETURNING *
	`, arg.Title, arg.DocumentType, arg.Source, arg.Content, arg.ContentHash,
		arg.Language, arg.Jurisdiction, arg.EffectiveDate, arg.PublicationDate,
		arg.GacetaNumber, arg.Tags, arg.ChunkCount, arg.IndexedAt).Scan(
		&row.ID, &row.Title, &row.DocumentType, &row.Source, &row.Content,
		&row.ContentHash, &row.Language, &row.Jurisdiction, &row.EffectiveDate,
		&row.PublicationDate, &row.GacetaNumber, &row.Tags, &row.ChunkCount,
		&row.IndexedAt, &row.CreatedAt, &row.UpdatedAt, &row.DeletedAt,
		&row.CompanyID, &row.UploadedBy, &row.StoragePath, &row.MimeType,
		&row.SizeBytes, &row.ChunkConfig, &row.IsIndexed)
	return row, err
}

// GetLegalDocument retrieves a legal document by ID.
func (q *Queries) GetLegalDocument(ctx context.Context, id int64) (GetLegalDocumentRow, error) {
	row := GetLegalDocumentRow{}
	err := q.db.QueryRowContext(ctx, "SELECT * FROM legal_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1", id).Scan(
		&row.ID, &row.Title, &row.DocumentType, &row.Source, &row.Content,
		&row.ContentHash, &row.Language, &row.Jurisdiction, &row.EffectiveDate,
		&row.PublicationDate, &row.GacetaNumber, &row.Tags, &row.ChunkCount,
		&row.IndexedAt, &row.CreatedAt, &row.UpdatedAt, &row.DeletedAt,
		&row.CompanyID, &row.UploadedBy, &row.StoragePath, &row.MimeType,
		&row.SizeBytes, &row.ChunkConfig, &row.IsIndexed)
	return row, err
}

// ListLegalDocuments lists legal documents by jurisdiction.
func (q *Queries) ListLegalDocuments(ctx context.Context, jurisdiction string) ([]GetLegalDocumentRow, error) {
	rows, err := q.db.QueryContext(ctx, "SELECT * FROM legal_documents WHERE (jurisdiction = ? OR ? = '') AND deleted_at IS NULL ORDER BY created_at DESC", jurisdiction, jurisdiction)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []GetLegalDocumentRow
	for rows.Next() {
		var row GetLegalDocumentRow
		if err := rows.Scan(&row.ID, &row.Title, &row.DocumentType, &row.Source, &row.Content,
			&row.ContentHash, &row.Language, &row.Jurisdiction, &row.EffectiveDate,
			&row.PublicationDate, &row.GacetaNumber, &row.Tags, &row.ChunkCount,
			&row.IndexedAt, &row.CreatedAt, &row.UpdatedAt, &row.DeletedAt,
			&row.CompanyID, &row.UploadedBy, &row.StoragePath, &row.MimeType,
			&row.SizeBytes, &row.ChunkConfig, &row.IsIndexed); err != nil {
			return nil, err
		}
		results = append(results, row)
	}
	return results, nil
}

// UpdateLegalDocumentIndexed updates indexed_at and chunk_count.
func (q *Queries) UpdateLegalDocumentIndexed(ctx context.Context, arg UpdateLegalDocumentIndexedParams) error {
	_, err := q.db.ExecContext(ctx, "UPDATE legal_documents SET indexed_at = CURRENT_TIMESTAMP, chunk_count = ? WHERE id = ? AND deleted_at IS NULL", arg.ChunkCount, arg.ID)
	return err
}

// DeleteLegalDocument soft-deletes a legal document.
func (q *Queries) DeleteLegalDocument(ctx context.Context, id int64) error {
	_, err := q.db.ExecContext(ctx, "UPDATE legal_documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", id)
	return err
}

// CountLegalDocuments returns the count of non-deleted legal documents.
func (q *Queries) CountLegalDocuments(ctx context.Context) (int, error) {
	var count int
	err := q.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM legal_documents WHERE deleted_at IS NULL").Scan(&count)
	return count, err
}

// GetLastLegalDocumentIndexTime returns the most recent indexed_at time.
func (q *Queries) GetLastLegalDocumentIndexTime(ctx context.Context) (sql.NullTime, error) {
	var t sql.NullTime
	err := q.db.QueryRowContext(ctx, "SELECT MAX(indexed_at) FROM legal_documents WHERE deleted_at IS NULL").Scan(&t)
	return t, err
}

// GetLegalDocumentChunkCount returns the chunk count for a document.
func (q *Queries) GetLegalDocumentChunkCount(ctx context.Context, documentID int64) *sql.Row {
	return q.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM document_chunks WHERE document_id = ? AND source = 'legal'", documentID)
}

// ========== ai_legal_chat_history queries ==========

// CreateLegalChatMessage creates a chat message.
func (q *Queries) CreateLegalChatMessage(ctx context.Context, arg CreateLegalChatMessageParams) (struct {
	ID          int64
	UserID      int64
	SessionID   string
	MessageType string
	Content     string
	ContextDocs string
	Metadata    string
	CreatedAt   time.Time
}, error) {
	var row struct {
		ID          int64
		UserID      int64
		SessionID   string
		MessageType string
		Content     string
		ContextDocs string
		Metadata    string
		CreatedAt   time.Time
	}
	err := q.db.QueryRowContext(ctx, `
		INSERT INTO ai_legal_chat_history (
			user_id, session_id, message_type, content,
			context_documents, metadata, created_at
		) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		RETURNING *
	`, arg.UserID, arg.SessionID, arg.MessageType, arg.Content, arg.ContextDocs, arg.Metadata).Scan(
		&row.ID, &row.UserID, &row.SessionID, &row.MessageType, &row.Content,
		&row.ContextDocs, &row.Metadata, &row.CreatedAt)
	return row, err
}

// GetLegalChatHistoryBySession returns chat messages for a session.
func (q *Queries) GetLegalChatHistoryBySession(ctx context.Context, sessionID string) ([]struct {
	ID          int64
	UserID      int64
	SessionID   string
	MessageType string
	Content     string
	ContextDocs string
	Metadata    string
	CreatedAt   time.Time
}, error) {
	rows, err := q.db.QueryContext(ctx, "SELECT * FROM ai_legal_chat_history WHERE session_id = ? ORDER BY created_at ASC", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []struct {
		ID          int64
		UserID      int64
		SessionID   string
		MessageType string
		Content     string
		ContextDocs string
		Metadata    string
		CreatedAt   time.Time
	}
	for rows.Next() {
		var r struct {
			ID          int64
			UserID      int64
			SessionID   string
			MessageType string
			Content     string
			ContextDocs string
			Metadata    string
			CreatedAt   time.Time
		}
		if err := rows.Scan(&r.ID, &r.UserID, &r.SessionID, &r.MessageType, &r.Content,
			&r.ContextDocs, &r.Metadata, &r.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// GetLegalChatSessionsByUser returns chat sessions for a user.
func (q *Queries) GetLegalChatSessionsByUser(ctx context.Context, userID int64) ([]struct {
	SessionID      string
	UserID         int64
	LastMessage    time.Time
	CreatedAt      time.Time
	MessageCount   int
}, error) {
	rows, err := q.db.QueryContext(ctx, `
		SELECT session_id, user_id, MAX(created_at) as last_message,
			created_at, COUNT(*) as message_count
		FROM ai_legal_chat_history
		WHERE user_id = ?
		GROUP BY session_id, user_id
		ORDER BY last_message DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []struct {
		SessionID    string
		UserID       int64
		LastMessage  time.Time
		CreatedAt    time.Time
		MessageCount int
	}
	for rows.Next() {
		var r struct {
			SessionID    string
			UserID       int64
			LastMessage  time.Time
			CreatedAt    time.Time
			MessageCount int
		}
		if err := rows.Scan(&r.SessionID, &r.UserID, &r.LastMessage, &r.CreatedAt, &r.MessageCount); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// DeleteLegalChatSession soft-deletes a chat session.
func (q *Queries) DeleteLegalChatSession(ctx context.Context, sessionID string) error {
	_, err := q.db.ExecContext(ctx, "UPDATE ai_legal_chat_history SET deleted_at = CURRENT_TIMESTAMP WHERE session_id = ?", sessionID)
	return err
}
