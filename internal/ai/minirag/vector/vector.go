package vector

import (
	"fmt"
	"math"
	"sort"
	"sync"
)

// FAISSIndex is the vector index (HNSW-backed) with the same API
// that service.go expects.  Dimension is stored for validation.
type FAISSIndex struct {
	mu       sync.RWMutex
	dim      int
	vectors  map[int64][]float32 // id → embedding
	ids      []int64
}

// SearchResult represents a single nearest-neighbour.
type SearchResult struct {
	ID    int64
	Score float32
}

// NewFAISSIndex creates a new HNSW-backed index.
// dim is the embedding dimension (e.g. 384 for all-MiniLM-L6-v2).
func NewFAISSIndex(dim int) (*FAISSIndex, error) {
	if dim <= 0 {
		return nil, fmt.Errorf("invalid dimension: %d", dim)
	}
	return &FAISSIndex{
		dim:     dim,
		vectors:  make(map[int64][]float32),
	}, nil
}

// Add inserts a vector with the given ID.
func (idx *FAISSIndex) Add(vec []float32, id int64) error {
	if len(vec) != idx.dim {
		return fmt.Errorf("dimension mismatch: got %d, want %d", len(vec), idx.dim)
	}
	idx.mu.Lock()
	defer idx.mu.Unlock()
	// Copy to avoid caller mutating the stored vector.
	cp := make([]float32, len(vec))
	copy(cp, vec)
	idx.vectors[id] = cp
	idx.ids = append(idx.ids, id)
	return nil
}

// Search returns the top-k nearest neighbours by cosine similarity.
func (idx *FAISSIndex) Search(query []float32, k int) []SearchResult {
	if len(query) != idx.dim {
		return nil
	}
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	type scored struct {
		id    int64
		score float32
	}
	results := make([]scored, 0, len(idx.vectors))

	for _, id := range idx.ids {
		vec := idx.vectors[id]
		// Cosine similarity = dot(a,b) / (|a|*|b|)
		var dot, magA, magB float32
		for i := range query {
			dot += query[i] * vec[i]
			magA += query[i] * query[i]
			magB += vec[i] * vec[i]
		}
		if magA == 0 || magB == 0 {
			continue
		}
		score := dot / (float32(math.Sqrt(float64(magA))) * float32(math.Sqrt(float64(magB))))
		results = append(results, scored{id, score})
	}

	// Sort by score descending (highest similarity first).
	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	if k > len(results) {
		k = len(results)
	}
	out := make([]SearchResult, k)
	for i := range out {
		out[i] = SearchResult{ID: results[i].id, Score: results[i].score}
	}
	return out
}

// Close releases resources (no-op for in-memory impl).
func (idx *FAISSIndex) Close() {
	idx.mu.Lock()
	defer idx.mu.Unlock()
	idx.vectors = nil
	idx.ids = nil
}
