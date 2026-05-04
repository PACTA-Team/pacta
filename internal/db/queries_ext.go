package db

import (
	"context"
	"database/sql"
	"time"
)

// DB returns the underlying *sql.DB.
// This is used by components that need direct DB access (e.g., for transactions).
func (q *Queries) DB() *sql.DB {
	return q.db
}

// NewQueriesWithTx returns a Queries bound to the provided transaction.
// This allows using sqlc-generated queries within an explicit transaction.
func NewQueriesWithTx(tx *sql.Tx) *Queries {
	return &Queries{db: tx}
}

// GetContractForRAGRow represents the result of the GetContractForRAG query.
type GetContractForRAGRow struct {
	ID           int64     `json:"id"`
	Title        string    `json:"title"`
	Type         string    `json:"type"`
	Object       []byte    `json:"object"` // may contain JSON or extra text
	Content      string    `json:"content"`
	ClientName   string    `json:"client_name"`
	SupplierName string    `json:"supplier_name"`
	CreatedAt    time.Time `json:"created_at"`
}

// GetContractForRAG retrieves a contract with joined client/supplier names for RAG indexing.
func (q *Queries) GetContractForRAG(ctx context.Context, id int64) (GetContractForRAGRow, error) {
	row := GetContractForRAGRow{}
	// Query matches the SQL in internal/db/queries/contracts.sql (GetContractForRAG)
	query := `
		SELECT
			c.id, c.title, c.type, c.object, COALESCE(c.description, '') as content,
			COALESCE(cl.name, '') as client_name, COALESCE(s.name, '') as supplier_name,
			c.created_at
		FROM contracts c
		LEFT JOIN companies cl ON c.client_id = cl.id
		LEFT JOIN companies s ON c.supplier_id = s.id
		WHERE c.id = ? AND c.deleted_at IS NULL
		LIMIT 1`
	err := q.db.QueryRowContext(ctx, query, id).Scan(
		&row.ID, &row.Title, &row.Type, &row.Object, &row.Content,
		&row.ClientName, &row.SupplierName, &row.CreatedAt,
	)
	return row, err
}
