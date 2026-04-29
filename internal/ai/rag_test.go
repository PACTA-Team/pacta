package ai

import (
	"database/sql"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestNewContractRetriever(t *testing.T) {
	// Mock DB - in real tests, use sqlmock or similar
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	retriever := NewContractRetriever(db)
	if retriever == nil {
		t.Error("retriever should not be nil")
	}
	if retriever.DB != db {
		t.Error("DB should match")
	}
}

func TestBuildRAGContext(t *testing.T) {
	contracts := []SimilarContract{
		{ID: 1, Title: "Service Contract A", Content: "Contract content A..."},
		{ID: 2, Title: "Service Contract B", Content: "Contract content B..."},
	}

	context := BuildRAGContext(contracts)

	if !contains(context, "Service Contract A") {
		t.Error("context should contain contract title")
	}
	if !strings.Contains(context, "Contract content A...") { // Using strings.Contains from stdlib
		t.Error("context should contain contract content")
	}
	if !strings.Contains(context, "Contract 1") {
		t.Error("context should have contract numbering")
	}
}

func TestBuildRAGContext_NoContracts(t *testing.T) {
	contracts := []SimilarContract{}
	context := BuildRAGContext(contracts)

	if context == "" || context == "No previous contracts available for reference." {
		// OK
	} else {
		t.Errorf("unexpected context for empty contracts: %s", context)
	}
}

// TestGetSimilarContracts_FiltersByCompany verifies that RAG queries are scoped to the user's company
func TestGetSimilarContracts_FiltersByCompany(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	// Create minimal contracts table schema
	createSQL := `
		CREATE TABLE contracts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT,
			type TEXT,
			object TEXT,
			client_id INTEGER,
			supplier_id INTEGER,
			company_id INTEGER NOT NULL DEFAULT 1,
			deleted_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`
	if _, err := db.Exec(createSQL); err != nil {
		t.Fatalf("failed to create table: %v", err)
	}

	// Insert contracts for company 1
	insert := `INSERT INTO contracts (title, type, object, client_id, supplier_id, company_id, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`
	
	// Contract A: company_id=1, matches client_id=1
	if _, err := db.Exec(insert, "Contract A", "service", "content A", 1, 99, 1, "2025-01-01T00:00:00Z"); err != nil {
		t.Fatalf("insert A failed: %v", err)
	}
	// Contract B: company_id=1, matches supplier_id=99
	if _, err := db.Exec(insert, "Contract B", "service", "content B", 99, 99, 1, "2025-01-02T00:00:00Z"); err != nil {
		t.Fatalf("insert B failed: %v", err)
	}
	// Contract C: company_id=2, should NOT be returned for companyID=1
	if _, err := db.Exec(insert, "Contract C", "service", "content C", 2, 98, 2, "2025-01-03T00:00:00Z"); err != nil {
		t.Fatalf("insert C failed: %v", err)
	}

	retriever := NewContractRetriever(db)

	// Query with companyID=1, clientID=1, supplierID=99 (should return A and B only)
	results, err := retriever.GetSimilarContracts(1, "service", 1, 99, 10)
	if err != nil {
		t.Fatalf("GetSimilarContracts returned error: %v", err)
	}

	// Verify all returned contracts belong to company 1
	for _, c := range results {
		// We need to check company_id but it's not in the query results.
		// The test verifies by logic: only contracts with company_id=1 should be returned.
		// Since we can't directly check company_id from result, we infer by title:
		if c.Title == "Contract C" {
			t.Errorf("unexpected contract from different company returned: %s", c.Title)
		}
	}

	// Should have returned exactly 2 contracts (A and B)
	if len(results) != 2 {
		t.Errorf("expected 2 contracts for company 1, got %d", len(results))
	}

	// Verify titles
	titles := make(map[string]bool)
	for _, c := range results {
		titles[c.Title] = true
	}
	if !titles["Contract A"] {
		t.Error("missing Contract A in results")
	}
	if !titles["Contract B"] {
		t.Error("missing Contract B in results")
	}
}

// Simple contains using strings package
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && stringsContains(s, substr))
}

func stringsContains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
