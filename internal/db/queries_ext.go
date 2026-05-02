package db

import "database/sql"

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

