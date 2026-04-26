package handlers

import (
	"testing"
)

func TestValidateStorageKey(t *testing.T) {
	cases := []struct {
		key     string
		wantErr bool
	}{
		{"abc123", false},
		{"a1b2-c3d4", false},
		{"../../../etc/passwd", true},
		{"..\\..\\windows", true},
		{"path/to/file", true},
		{"", true},
	}
	for _, c := range cases {
		err := validateStorageKey(c.key)
		hasErr := err != nil
		if hasErr != c.wantErr {
			t.Errorf("validateStorageKey(%q) error = %v, wantErr %v", c.key, err, c.wantErr)
		}
	}
}
