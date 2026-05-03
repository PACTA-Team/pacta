package vector

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFAISSAddAndSearch(t *testing.T) {
	// Skip if FAISS lib not built (CI ensures it is)
	idx := NewFAISSIndex(384)
	defer idx.Close()

	// Create normalized vector
	vec := make([]float32, 384)
	for i := range vec {
		vec[i] = 0.1
	}
	vec = normalizeVector(vec) // use existing helper from embedding package or duplicate

	id := int64(42)
	err := idx.Add(vec, id)
	require.NoError(t, err)

	// Search for self
	results := idx.Search(vec, 1)
	require.Len(t, results, 1)
	require.Equal(t, id, results[0].ID)
	require.InDelta(t, 1.0, results[0].Score, 1e-5) // inner product of identical normalized vectors ≈ 1
}
