package ai

import (
	"database/sql"
	"testing"
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
