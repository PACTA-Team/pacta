package storage

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// ChunkMeta stores metadata for a chunk, linked to a FAISS vector via VectorID.
type ChunkMeta struct {
	ID          int64        `json:"id"`
	ContractID  int64        `json:"contract_id"`
	ChunkIndex  int          `json:"chunk_index"`
	Content     string       `json:"content"`
	PageNumber  *int         `json:"page_number,omitempty"`
	ClauseType  string       `json:"clause_type,omitempty"`
	VectorID    int64        `json:"vector_id"` // maps to FAISS vector id
	CreatedAt   time.Time    `json:"created_at"`
}

// SQLiteStore provides persistence for chunk metadata using SQLite.
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore opens a SQLite database at the given file path, applies pragmas,
// runs migrations, and returns a store.
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite db: %w", err)
	}

	// Apply WAL mode and synchronous=NORMAL for durability + performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("failed to set journal_mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA synchronous=NORMAL"); err != nil {
		return nil, fmt.Errorf("failed to set synchronous: %w", err)
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	return &SQLiteStore{db: db}, nil
}

// AddChunk inserts a chunk metadata record into the database.
func (s *SQLiteStore) AddChunk(meta ChunkMeta) error {
	_, err := s.db.Exec(`
		INSERT INTO minirag_chunks
			(contract_id, chunk_index, content, page_number, clause_type, vector_id)
		VALUES (?, ?, ?, ?, ?, ?)`,
		meta.ContractID, meta.ChunkIndex, meta.Content, meta.PageNumber, meta.ClauseType, meta.VectorID,
	)
	return err
}

// GetChunkByVectorID retrieves a chunk by its FAISS vector ID.
func (s *SQLiteStore) GetChunkByVectorID(vectorID int64) (ChunkMeta, error) {
	row := s.db.QueryRow(`
		SELECT id, contract_id, chunk_index, content, page_number, clause_type, vector_id, created_at
		FROM minirag_chunks WHERE vector_id = ?`, vectorID)

	var meta ChunkMeta
	var pageNum sql.NullInt64
	var clauseType sql.NullString
	var createdAtStr string

	err := row.Scan(&meta.ID, &meta.ContractID, &meta.ChunkIndex, &meta.Content,
		&pageNum, &clauseType, &meta.VectorID, &createdAtStr)
	if err != nil {
		return meta, err
	}

	// Convert nullable fields
	if pageNum.Valid {
		p := int(pageNum.Int64)
		meta.PageNumber = &p
	}
	if clauseType.Valid {
		meta.ClauseType = clauseType.String
	}

	// Parse timestamp (SQLite stores as TEXT)
	if t, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
		meta.CreatedAt = t
	} else {
		// Fallback: try SQLite default format
		if t, err := time.Parse("2006-01-02 15:04:05", createdAtStr); err == nil {
			meta.CreatedAt = t
		}
	}

	return meta, nil
}

// GetChunksByContract returns all chunks for a given contract, ordered by chunk_index.
func (s *SQLiteStore) GetChunksByContract(contractID int64) ([]ChunkMeta, error) {
	rows, err := s.db.Query(`
		SELECT id, contract_id, chunk_index, content, page_number, clause_type, vector_id, created_at
		FROM minirag_chunks
		WHERE contract_id = ?
		ORDER BY chunk_index ASC`, contractID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chunks []ChunkMeta
	for rows.Next() {
		var meta ChunkMeta
		var pageNum sql.NullInt64
		var clauseType sql.NullString
		var createdAtStr string

		if err := rows.Scan(&meta.ID, &meta.ContractID, &meta.ChunkIndex, &meta.Content,
			&pageNum, &clauseType, &meta.VectorID, &createdAtStr); err != nil {
			return nil, err
		}

		if pageNum.Valid {
			p := int(pageNum.Int64)
			meta.PageNumber = &p
		}
		if clauseType.Valid {
			meta.ClauseType = clauseType.String
		}
		if t, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
			meta.CreatedAt = t
		} else if t, err := time.Parse("2006-01-02 15:04:05", createdAtStr); err == nil {
			meta.CreatedAt = t
		}

		chunks = append(chunks, meta)
	}
	return chunks, rows.Err()
}

// Close closes the database connection.
func (s *SQLiteStore) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// runMigrations creates the minirag_chunks table and indexes if they do not exist.
func runMigrations(db *sql.DB) error {
	// Best practice: wrap in transaction for atomicity
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Table DDL
	createTable := `
	CREATE TABLE IF NOT EXISTS minirag_chunks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		contract_id INTEGER NOT NULL,
		chunk_index INTEGER NOT NULL,
		content TEXT NOT NULL,
		page_number INTEGER,
		clause_type TEXT,
		vector_id INTEGER NOT NULL UNIQUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`
	if _, err := tx.Exec(createTable); err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	// Indexes
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_minirag_contract ON minirag_chunks(contract_id)",
		"CREATE INDEX IF NOT EXISTS idx_minirag_vector_id ON minirag_chunks(vector_id)",
		"CREATE INDEX IF NOT EXISTS idx_minirag_clause_type ON minirag_chunks(clause_type)",
	}
	for _, idx := range indexes {
		if _, err := tx.Exec(idx); err != nil {
			return fmt.Errorf("create index: %w", err)
		}
	}

	return tx.Commit()
}
