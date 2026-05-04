package minirag

import (
	"math"
	"time"
)

// DocumentMeta stores metadata for a document chunk group.
// This is the public-facing metadata returned in search results.
type DocumentMeta struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Type        string            `json:"type"`
	Source      string            `json:"source"`
	Content     string            `json:"content"`
	CreatedAt   string            `json:"created_at"`
	ExtraFields map[string]string `json:"extra_fields,omitempty"`
}

// SearchResult represents a single search result with metadata and content.
type SearchResult struct {
	ID      string       `json:"id"`
	Score   float32      `json:"score"`
	Meta    DocumentMeta `json:"meta"`
	Content string       `json:"content"`
}

// Chunk represents a chunk of text with metadata.
type Chunk struct {
	ID       int    `json:"id"`
	Text     string `json:"text"`
	Title    string `json:"title"`
	Position int    `json:"position"`
}

// CosineSimilarity calculates cosine similarity between two vectors.
// Returns a float32 between -1 and 1 (1 for identical normalized vectors).
func CosineSimilarity(a, b []float32) float32 {
	if len(a) != len(b) {
		return 0
	}
	var dot, normA, normB float32
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	denom := float32(math.Sqrt(float64(normA)) * math.Sqrt(float64(normB)))
	if denom < 1e-12 {
		return 0
	}
	return dot / denom
}
