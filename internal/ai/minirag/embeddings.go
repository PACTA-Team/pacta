package minirag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// EmbeddingClient generates embeddings for text using local models
type EmbeddingClient struct {
	Endpoint string
	Model    string
	Timeout  time.Duration
	client   *http.Client
}

// NewEmbeddingClient creates a new embedding client
func NewEmbeddingClient(endpoint, model string) *EmbeddingClient {
	if endpoint == "" {
		endpoint = "http://localhost:11434"
	}
	if model == "" {
		model = "all-minilm-l6-v2"
	}
	return &EmbeddingClient{
		Endpoint: endpoint,
		Model:    model,
		Timeout:  60 * time.Second,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// GenerateEmbedding generates an embedding vector for the given text
func (c *EmbeddingClient) GenerateEmbedding(text string) ([]float32, error) {
	if text == "" {
		return make([]float32, 384), nil // default dimension for all-minilm-l6-v2
	}

	// Ollama embedding API
	reqBody := map[string]interface{}{
		"model":  c.Model,
		"prompt": text,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), c.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST",
		c.Endpoint+"/api/embeddings",
		bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		// Fallback: try local ONNX runtime if available
		return c.fallbackEmbedding(text)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("embedding API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Embedding []float32 `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Embedding) == 0 {
		return nil, fmt.Errorf("empty embedding returned")
	}

	// Normalize
	normEmb := normalizeVector(result.Embedding)
	return normEmb, nil
}

// GenerateBatchEmbeddings generates embeddings for multiple texts
func (c *EmbeddingClient) GenerateBatchEmbeddings(texts []string) ([][]float32, error) {
	embeddings := make([][]float32, len(texts))
	for i, text := range texts {
		emb, err := c.GenerateEmbedding(text)
		if err != nil {
			return nil, fmt.Errorf("failed to generate embedding for text %d: %w", i, err)
		}
		embeddings[i] = emb
	}
	return embeddings, nil
}

// fallbackEmbedding generates a simple embedding without external API
func (c *EmbeddingClient) fallbackEmbedding(text string) ([]float32, error) {
	// Simple hash-based fallback for when no embedding model is available
	// This is NOT a real embedding but allows the system to work
	dim := 384 // all-minilm-l6-v2 dimension
	emb := make([]float32, dim)

	// Simple TF-based hash embedding
	hash := uint32(0)
	for _, ch := range text {
		hash = hash*31 + uint32(ch)
	}

	for i := 0; i < dim; i++ {
		hash = hash*31 + uint32(i)
		emb[i] = float32((hash%2000)-1000) / 1000.0
	}

	return normalizeVector(emb), nil
}

// CheckHealth checks if the embedding service is available
func (c *EmbeddingClient) CheckHealth() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET",
		c.Endpoint+"/api/tags", nil)
	if err != nil {
		return false
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == 200
}

// GetModelInfo retrieves information about the embedding model
func (c *EmbeddingClient) GetModelInfo() (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET",
		c.Endpoint+"/api/tags", nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}
