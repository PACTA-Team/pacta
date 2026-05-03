package minirag

import (
	"github.com/PACTA-Team/pacta/internal/ai/minirag/embedding"
)

// EmbeddingClient is an alias for embedding.Embedder to maintain backward compatibility.
type EmbeddingClient = embedding.Embedder

// NewEmbeddingClient creates a new EmbeddingClient (CGo-based embedder).
// The endpoint and model parameters are currently ignored; the default
// embedded model is used.
func NewEmbeddingClient(endpoint, model string) *EmbeddingClient {
	e, err := embedding.NewEmbedder()
	if err != nil {
		panic("failed to create embedder: " + err.Error())
	}
	return e
}
