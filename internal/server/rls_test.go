package server

import (
	"testing"
)

func TestValidateTableName_RejectsMalicious(t *testing.T) {
	testCases := []struct {
		table  string
		wantOK bool
	}{
		{"contracts", true},
		{"users", true},
		{"audit_logs", true},
		{"users; DROP TABLE users;--", false},
		{"../etc/passwd", false},
		{"nonexistent_table", false},
		{"", false},
	}

	for _, tc := range testCases {
		ok := validateTableName(tc.table)
		if ok != tc.wantOK {
			t.Errorf("validateTableName(%q) = %v, want %v", tc.table, ok, tc.wantOK)
		}
	}
}
