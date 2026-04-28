package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// setupTestDB creates an in-memory SQLite database with all necessary tables
// for testing AI handlers.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	// Enable foreign keys for referential integrity
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("PRAGMA foreign_keys: %v", err)
	}
	// Create required tables
	tables := []string{
		`CREATE TABLE companies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			address TEXT,
			tax_id TEXT,
			company_type TEXT NOT NULL DEFAULT 'single',
			parent_id INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL CHECK (role IN ('admin','manager','editor','viewer')),
			status TEXT NOT NULL DEFAULT 'active',
			company_id INTEGER,
			last_access DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE system_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			key TEXT UNIQUE NOT NULL,
			value TEXT,
			category TEXT NOT NULL,
			updated_by INTEGER,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		)`,
		`CREATE TABLE ai_rate_limits (
			company_id INTEGER NOT NULL,
			date TEXT NOT NULL,
			count INTEGER DEFAULT 0,
			PRIMARY KEY (company_id, date),
			FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE contracts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT,
			type TEXT,
			object TEXT,
			company_id INTEGER NOT NULL,
			client_id INTEGER NOT NULL,
			supplier_id INTEGER NOT NULL,
			deleted_at DATETIME,
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

// insertTestCompany inserts a company and returns its ID.
func insertTestCompany(t *testing.T, db *sql.DB) int {
	t.Helper()
	res, err := db.Exec("INSERT INTO companies (name, company_type) VALUES (?, ?)", "Test Company", "single")
	if err != nil {
		t.Fatalf("insert company: %v", err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

// insertTestUser inserts a user linked to the given company and returns user ID.
func insertTestUser(t *testing.T, db *sql.DB, companyID int) int {
	t.Helper()
	res, err := db.Exec("INSERT INTO users (name, email, password_hash, role, company_id, status) VALUES (?, ?, ?, ?, ?, ?)",
		"Test User", "test@example.com", "$2a$10$dummyhashforpassword", "admin", companyID, "active")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

// withCompanyContext injects the given companyID into the request context
// using the key expected by Handler.GetCompanyID.
func withCompanyContext(r *http.Request, companyID int) *http.Request {
	// ctxCompanyID is defined in company_middleware.go (unexported but accessible within package)
	return r.WithContext(context.WithValue(r.Context(), ctxCompanyID, companyID))
}

// mockLLMClient is a mock implementation of the LLMClient interface for testing.
type mockLLMClient struct {
	response string
	err      error
}

func (m *mockLLMClient) Generate(ctx context.Context, prompt string, context string) (string, error) {
	return m.response, m.err
}
