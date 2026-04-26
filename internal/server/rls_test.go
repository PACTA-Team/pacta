package server

import (
	"testing"
)

func TestValidateTableName_RejectsMalicious(t *testing.T) {
	tests := []struct {
		name     string
		table    string
		wantValid bool
	}{
		{"valid table", "contracts", true},
		{"SQL injection attempt", "users; DROP TABLE users;--", false},
		{"path traversal", "../etc/passwd", false},
		{"nonexistent table", "nonexistent", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validateTableName(tt.table)
			if got != tt.wantValid {
				t.Errorf("validateTableName(%q) = %v, want %v", tt.table, got, tt.wantValid)
			}
		})
	}
}

func Test_EnforceOwnership_InvalidTableRejected(t *testing.T) {
	// Use a mock DB - for simplicity we just test validation logic
	// The goal is to ensure invalid table names are rejected before hitting DB
	invalidTable := "users; DROP TABLE users;--"
	if validateTableName(invalidTable) {
		t.Error("expected invalid table to be rejected")
	}

	validTable := "contracts"
	if !validateTableName(validTable) {
		t.Error("expected valid table to be accepted")
	}
}
