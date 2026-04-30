package minirag

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/PACTA-Team/pacta/internal/ai/legal"
)

func TestCosineSimilarity(t *testing.T) {
	// Identical vectors -> similarity 1.0
	v := []float32{0.5, 0.5, 0.5}
	sim := CosineSimilarity(v, v)
	require.InDelta(t, 1.0, float64(sim), 1e-5)

	// Orthogonal vectors -> ~0
	v1 := []float32{1, 0, 0}
	v2 := []float32{0, 1, 0}
	sim = CosineSimilarity(v1, v2)
	require.InDelta(t, 0.0, float64(sim), 1e-5)

	// Opposite vectors -> -1
	v3 := []float32{1, 0, 0}
	v4 := []float32{-1, 0, 0}
	sim = CosineSimilarity(v3, v4)
	require.InDelta(t, -1.0, float64(sim), 1e-5)
}

func TestVectorDB_AddAndSearch(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)

	// Add two documents
	emb1 := make([]float32, 384)
	emb2 := make([]float32, 384)
	// Fill with deterministic values
	for i := range emb1 {
		emb1[i] = float32(i+1) / 384.0
		emb2[i] = float32(384-i) / 384.0
	}
	emb1 = normalizeVector(emb1)
	emb2 = normalizeVector(emb2)

	meta1 := DocumentMeta{
		ID:    "doc1",
		Title: "First Document",
		Type:  "test",
		Source:"test",
		Content:"content1",
	}
	meta2 := DocumentMeta{
		ID:    "doc2",
		Title: "Second Document",
		Type:  "test",
		Source:"test",
		Content:"content2",
	}

	err = db.AddDocument("doc1", emb1, meta1)
	require.NoError(t, err)
	err = db.AddDocument("doc2", emb2, meta2)
	require.NoError(t, err)

	// Search using emb1 (should return doc1 as top hit)
	results := db.Search(emb1, 2)
	require.Len(t, results, 2)
	require.Equal(t, "doc1", results[0].ID)
	require.Greater(t, results[0].Score, results[1].Score)
}

func TestVectorDB_AddLegalDocumentChunks(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)

	chunks := []legal.Chunk{
		{Title: "Section 1", Text: "This is the first section content."},
		{Title: "Section 2", Text: "This is the second section content."},
	}
	legalMeta := LegalDocumentMetadata{
		DocumentID:   42,
		DocumentType: "ley",
		Title:        "Test Law",
		Jurisdiction: "Cuba",
		Language:     "es",
	}
	emb1 := make([]float32, 384)
	emb2 := make([]float32, 384)
	for i := range emb1 {
		emb1[i] = 0.1
		emb2[i] = 0.2
	}
	embeddings := [][]float32{emb1, emb2}

	err = db.AddLegalDocumentChunks(chunks, legalMeta, embeddings)
	require.NoError(t, err)

	// Verify count
	require.Equal(t, 2, db.Count())

	// Search for something similar to first chunk
	results, err := db.SearchLegalDocuments(emb1, nil, 1)
	require.NoError(t, err)
	require.Len(t, results, 1)
	require.Equal(t, "legal_42_chunk_0", results[0].ID)
	require.Equal(t, "Section 1", results[0].Meta.ExtraFields["chunk_title"])
}

func TestVectorDB_SearchLegalDocuments_Filter(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)

	chunks := []legal.Chunk{
		{Title: "Art 1", Text: "Content A",},
		{Title: "Art 2", Text: "Content B",},
	}
	legalMeta := LegalDocumentMetadata{
		DocumentID:   1,
		DocumentType: "decreto",
		Title:        "Decreto 123",
		Jurisdiction: "Cuba",
		Language:     "es",
	}
	emb := make([]float32, 384)
	for i := range emb {
		emb[i] = 0.5
	}
	emb = normalizeVector(emb)
	embeddings := [][]float32{emb, emb}

	err = db.AddLegalDocumentChunks(chunks, legalMeta, embeddings)
	require.NoError(t, err)

	// Filter by jurisdiction
	filter := map[string]interface{}{"jurisdiction": "Cuba"}
	results, err := db.SearchLegalDocuments(emb, filter, 10)
	require.NoError(t, err)
	require.Len(t, results, 2)

	// Filter by jurisdiction mismatch
	filter2 := map[string]interface{}{"jurisdiction": "USA"}
	results2, err2 := db.SearchLegalDocuments(emb, filter2, 10)
	require.NoError(t, err2)
	require.Len(t, results2, 0)
}

func TestVectorDB_DeleteDocument(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)

	emb := make([]float32, 384)
	for i := range emb {
		emb[i] = 0.33
	}
	emb = normalizeVector(emb)
	meta := DocumentMeta{ID: "to-delete", Title: "Delete Me", Type: "test", Source:"test", Content:"test"}
	err = db.AddDocument("to-delete", emb, meta)
	require.NoError(t, err)
	require.Equal(t, 1, db.Count())

	err = db.DeleteDocument("to-delete")
	require.NoError(t, err)
	require.Equal(t, 0, db.Count())
}

func TestNormalizeVector(t *testing.T) {
	v := []float32{3, 4}
	norm := normalizeVector(v)
	// sqrt(9+16)=5, so normalized: [0.6, 0.8]
	require.InDelta(t, 0.6, float64(norm[0]), 1e-5)
	require.InDelta(t, 0.8, float64(norm[1]), 1e-5)
}

func TestVectorDB_PersistAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	// Create and populate DB
	db1, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)
	emb := make([]float32, 384)
	for i := range emb {
		emb[i] = 0.1
	}
	emb = normalizeVector(emb)
	meta := DocumentMeta{ID: "persist", Title: "Persist", Type:"t", Source:"t", Content:"c"}
	err = db1.AddDocument("persist", emb, meta)
	require.NoError(t, err)
	// Explicit save not needed; AddDocument auto-saves every 10, but force for test
	err = db1.save()
	require.NoError(t, err)

	// Create a new VectorDB that loads from the same path
	db2, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)

	// Check loaded metadata
	meta2, ok := db2.GetDocument("persist")
	require.True(t, ok)
	require.Equal(t, "persist", meta2.ID)
	require.Equal(t, "Persist", meta2.Title)
}

func TestVectorDB_Search_Empty(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)
	results := db.Search(nil, 5)
	require.Nil(t, results)
}

func TestVectorDB_AddDocument_DimMismatch(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := NewVectorDB(384, tmpDir)
	require.NoError(t, err)
	emb := make([]float32, 128) // wrong dimension
	meta := DocumentMeta{ID: "bad", Title:"bad", Type:"t", Source:"t", Content:"c"}
	err = db.AddDocument("bad", emb, meta)
	require.Error(t, err)
	require.Contains(t, err.Error(), "dimension mismatch")
}
