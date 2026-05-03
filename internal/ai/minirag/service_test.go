package minirag

import (
	"os"
	"testing"

	"github.com/PACTA-Team/pacta/internal/models"
	"github.com/stretchr/testify/require"
)

func TestService_IndexAndSearch(t *testing.T) {
	// Create temporary database
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"
	svc, err := NewService("", dbPath)
	require.NoError(t, err)
	defer svc.Close()

	doc := &LegalDocument{
		ID:            1,
		DocumentType:  "acuerdo",
		Title:         "Test Contract",
		Content:       "El proveedor indemnizará al cliente por daños y perjuicios.",
		Jurisdiction:  "AR",
		Language:      "es",
	}
	err = svc.IndexLegalDocument(doc)
	require.NoError(t, err)

	results, err := svc.SearchLegalDocuments("indemnización", nil, 5)
	require.NoError(t, err)
	require.True(t, len(results) > 0)
	require.Contains(t, results[0].Content, "indemnizar")
}
