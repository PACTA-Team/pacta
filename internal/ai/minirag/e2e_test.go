package minirag

import (
	"testing"
	"time"

	"github.com/PACTA-Team/pacta/internal/models"
	"github.com/stretchr/testify/require"
)

// newTestService constructs a Service with a temporary SQLite database.
// The embedder uses the embedded GGUF model; FAISS uses an in-memory index.
func newTestService(t *testing.T) *Service {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"
	svc, err := NewService("", dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = svc.Close()
	})
	return svc
}

// newLegalDocument creates a sample Spanish confidentiality agreement for testing.
func newLegalDocument() *models.LegalDocument {
	now := time.Now()
	return &models.LegalDocument{
		ID:            1,
		Title:         "Acuerdo de Confidencialidad",
		DocumentType:  "acuerdo de confidencialidad",
		Content:       "EL PROVEEDOR se obliga a mantener la confidencialidad de la información del CLIENTE. " +
			"El proveedor no divulgará datos personales, secretos comerciales, ni know-how. " +
			"Esta obligación sobrevivirá por cinco años tras la terminación del contrato. " +
			"El proveedor indemnizará al cliente por cualquier divulgación no autorizada.",
		Language:     "es",
		Jurisdiction: "AR",
		// Required non-nullable fields for full model:
		ContentHash: "sha256:testhash12345",
		CreatedAt:   now,
		UpdatedAt:   now,
		CompanyID:   1,
		UploadedBy:  1,
		StoragePath: "/tmp/test_contract.pdf",
	}
}

// TestE2E_IndexAndSemanticSearch tests the full RAG pipeline: chunking, embedding,
// FAISS indexing, and semantic search retrieval.
func TestE2E_IndexAndSemanticSearch(t *testing.T) {
	svc := newTestService(t)

	doc := newLegalDocument()

	// Index the document
	err := svc.IndexLegalDocument(doc)
	require.NoError(t, err, "indexing should succeed")

	// Verify some chunks were created
	count, err := svc.Count()
	require.NoError(t, err)
	require.Greater(t, count, 0, "should have indexed at least one chunk")

	// Test semantic search for "indemnización"
	results1, err := svc.SearchLegalDocuments("indemnización", nil, 3)
	require.NoError(t, err, "search should succeed")
	require.NotEmpty(t, results1, "search for 'indemnización' should return results")

	// At least one result should contain semantically related content ("indemnizar" or "indemnización")
	found1 := false
	for _, r := range results1 {
		if r.Content != "" && (containsSpanishIndemnity(r.Content)) {
			found1 = true
			break
		}
	}
	require.True(t, found1, "at least one result for 'indemnización' should contain 'indemnizar' or 'indemnización'")

	// Test search for "confidencialidad"
	results2, err := svc.SearchLegalDocuments("confidencialidad", nil, 3)
	require.NoError(t, err, "search should succeed")
	require.NotEmpty(t, results2, "search for 'confidencialidad' should return results")

	// At least one result should contain "confidencial"
	found2 := false
	for _, r := range results2 {
		if r.Content != "" && containsConfidentiality(r.Content) {
			found2 = true
			break
		}
	}
	require.True(t, found2, "at least one result for 'confidencialidad' should contain 'confidencial'")
}

// TestE2E_SearchWithJurisdictionFilter tests filtering by jurisdiction.
func TestE2E_SearchWithJurisdictionFilter(t *testing.T) {
	svc := newTestService(t)
	doc := newLegalDocument()
	doc.Jurisdiction = "AR"
	require.NoError(t, svc.IndexLegalDocument(doc))

	// Filter by AR should return results
	results, err := svc.SearchLegalDocuments("indemnización", map[string]interface{}{
		"jurisdiction": "AR",
	}, 3)
	require.NoError(t, err)
	require.NotEmpty(t, results)

	// Filter by non-matching jurisdiction should return empty
	results2, err := svc.SearchLegalDocuments("indemnización", map[string]interface{}{
		"jurisdiction": "MX",
	}, 3)
	require.NoError(t, err)
	require.Empty(t, results2, "non-matching jurisdiction filter should return no results")
}

// TestE2E_UnrelatedQueryThreshold tests that unrelated queries return low-relevance results.
func TestE2E_UnrelatedQueryThreshold(t *testing.T) {
	svc := newTestService(t)
	doc := newLegalDocument()
	require.NoError(t, svc.IndexLegalDocument(doc))

	// Unrelated nonsensical query should still return results (FAISS is not semantic),
	// but scores may be low and content will not relate.
	results, err := svc.SearchLegalDocuments("random unrelated nonsense zxcvbnm", nil, 3)
	require.NoError(t, err)
	// FAISS returns nearest neighbors even for random queries; there should be some results
	// but we verify that none of the returned content contains relevant Spanish legal terms
	for _, r := range results {
		require.NotContains(t, r.Content, "indemnizar")
		require.NotContains(t, r.Content, "confidencial")
		require.NotContains(t, r.Content, "proveedor")
	}
}

// Helper functions to check semantic term presence (simplified for e2e validation)
func containsSpanishIndemnity(s string) bool {
	lower := toLowerASCII(s)
	return contains(lower, "indemnizar") ||
		contains(lower, "indemnización") ||
		contains(lower, "indemnidad") ||
		contains(lower, "daños") ||
		contains(lower, "perjuicios") ||
		contains(lower, "responsabilidad")
}

func containsConfidentiality(s string) bool {
	lower := toLowerASCII(s)
	return contains(lower, "confidencial") ||
		contains(lower, "secreto") ||
		contains(lower, "privacidad") ||
		contains(lower, "reservado")
}

func toLowerASCII(s string) string {
	// Simple ASCII lowercase for Spanish terms
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 'a' - 'A'
		}
	}
	return string(b)
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (haystack == needle || len(haystack) > len(needle) && indexOf(haystack, needle) >= 0)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
