package minirag

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEmbeddingClient_GenerateEmbedding_Empty(t *testing.T) {
	client := NewEmbeddingClient("", "")
	emb, err := client.GenerateEmbedding("")
	require.NoError(t, err)
	require.Len(t, emb, 384)
	// Check normalized
	norm := float32(0)
	for _, v := range emb {
		norm += v * v
	}
	require.InDelta(t, 1.0, float64(norm), 1e-5)
}

func TestEmbeddingClient_GenerateEmbedding_Success(t *testing.T) {
	// Spin up a test server that mimics Ollama /api/embeddings
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/embeddings", r.URL.Path)
		require.Equal(t, "POST", r.Method)
		// Decode request to verify model
		var req struct {
			Model  string `json:"model"`
			Prompt string `json:"prompt"`
		}
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)
		require.Equal(t, "all-minilm-l6-v2", req.Model)
		require.Equal(t, "test text", req.Prompt)

		// Respond with a fixed embedding
		resp := map[string]interface{}{
			"embedding": generateDummyEmbedding(384, 0.5),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewEmbeddingClient(server.URL, "all-minilm-l6-v2")
	// Override client.HTTPClient.Timeout maybe not needed
	emb, err := client.GenerateEmbedding("test text")
	require.NoError(t, err)
	require.Len(t, emb, 384)
	// Verify normalized and roughly matches 0.5 values
	sum := float32(0)
	for _, v := range emb {
		sum += v
	}
	// average should be around 0.5; not strict but check range
	avg := sum / float32(len(emb))
	require.InDelta(t, 0.5, float64(avg), 0.1)
}

func TestEmbeddingClient_GenerateEmbedding_Fallback(t *testing.T) {
	// Server that returns error to trigger fallback
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`error`))
	}))
	defer server.Close()

	client := NewEmbeddingClient(server.URL, "all-minilm-l6-v2")
	emb, err := client.GenerateEmbedding("some text")
	// fallback should produce an embedding even with error
	require.NoError(t, err)
	require.Len(t, emb, 384)
	// Should be normalized
	norm := float32(0)
	for _, v := range emb {
		norm += v * v
	}
	require.InDelta(t, 1.0, float64(norm), 1e-5)
}

func TestEmbeddingClient_CheckHealth(t *testing.T) {
	// Healthy server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tags" && r.Method == "GET" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"models":[{"name":"test"}]}`))
		}
	}))
	defer server.Close()

	client := NewEmbeddingClient(server.URL, "all-minilm-l6-v2")
	ok := client.CheckHealth()
	require.True(t, ok)

	// Unhealthy server
	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server2.Close()
	client2 := NewEmbeddingClient(server2.URL, "all-minilm-l6-v2")
	ok2 := client2.CheckHealth()
	require.False(t, ok2)
}

func TestEmbeddingClient_GetModelInfo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tags" && r.Method == "GET" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"models":[{"name":"m1","size":12345},{"name":"m2","size":67890}]}`))
			return
		}
	}))
	defer server.Close()

	client := NewEmbeddingClient(server.URL, "all-minilm-l6-v2")
	info, err := client.GetModelInfo()
	require.NoError(t, err)
	require.Contains(t, info, "models")
}

// generateDummyEmbedding creates an embedding slice with all values = val
func generateDummyEmbedding(dim int, val float32) []float32 {
	emb := make([]float32, dim)
	for i := range emb {
		emb[i] = val
	}
	return emb
}
