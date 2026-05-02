package db

import "database/sql"

// GetDB returns the underlying *sql.DB from a Queries.
// This is useful when needing direct DB access (e.g., Begin transactions)
// while still using sqlc for queries.
func GetDB(q *Queries) *sql.DB {
	return q.db
}
