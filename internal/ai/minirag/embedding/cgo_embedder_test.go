package embedding

import (
	"math"
	"os"
	"path/filepath"
	"testing"
)

// TestNormalizeVector verifies L2 normalization of a simple vector.
// Input [3, 4] has norm 5, so normalized is [0.6, 0.8].
func TestNormalizeVector(t *testing.T) {
	vec := []float32{3, 4}
	normalized := normalizeVector(vec)
	if len(normalized) != 2 {
		t.Fatalf("expected len 2, got %d", len(normalized))
	}
	// norm of [3,4] is 5 → [0.6, 0.8]
	expected := []float32{0.6, 0.8}
	eps := 1e-6
	for i := range normalized {
		if math.Abs(float64(normalized[i]-expected[i])) > eps {
			t.Errorf("normalized[%d] = %f, want %f", i, normalized[i], expected[i])
		}
	}
}

// TestGenerateEmbedding_NonEmpty tests that a real embedding is produced
// when the GGUF model is available and llama.cpp is built.
// Skips if model file is missing or if CI indicates build deps not present.
func TestGenerateEmbedding_NonEmpty(t *testing.T) {
	// Check for model file presence
	modelPath := filepath.Join(os.Getenv("PWD"),
		"internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found at: " + modelPath)
	}

	// Also skip if explicitly told to (local dev without llama.cpp)
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set, skipping llama.cpp test")
	}

	emb, err := NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder (llama.cpp not built?): %v", err)
	}
	defer emb.Close()

	vec, err := emb.GenerateEmbedding("test sentence")
	if err != nil {
		t.Fatalf("GenerateEmbedding error: %v", err)
	}

	// Verify embedding dimension (MiniLM-L3-v2 → 384)
	if len(vec) != 384 {
		t.Fatalf("expected 384-dim embedding, got %d", len(vec))
	}

	// All values should be finite
	for i, v := range vec {
		if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) {
			t.Fatalf("non-finite value at index %d: %v", i, v)
		}
	}

	// L2 norm should be ~1.0
	var normSq float64
	for _, v := range vec {
		normSq += float64(v * v)
	}
	norm := math.Sqrt(normSq)
	if diff := math.Abs(norm - 1.0); diff > 1e-5 {
		t.Errorf("L2 norm = %f, want ~1.0", norm)
	}
}

// TestGenerateEmbedding_Empty returns a zero vector of the correct dimension.
func TestGenerateEmbedding_Empty(t *testing.T) {
	modelPath := filepath.Join(os.Getenv("PWD"),
		"internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found at: " + modelPath)
	}

	emb, err := NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder: %v", err)
	}
	defer emb.Close()

	vec, err := emb.GenerateEmbedding("")
	if err != nil {
		t.Fatalf("GenerateEmbedding('') error: %v", err)
	}
	if len(vec) != 384 {
		t.Fatalf("expected 384-dim zero vector, got %d", len(vec))
	}
	// Zero vector — all zeros (not normalized)
	for _, v := range vec {
		if v != 0 {
			t.Errorf("expected all zeros, got %v", v)
			break
		}
	}
}

// TestBatchEmbedding_SmallBatch tests batch generation of 3 texts.
func TestBatchEmbedding_SmallBatch(t *testing.T) {
	modelPath := filepath.Join(os.Getenv("PWD"),
		"internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found at: " + modelPath)
	}

	emb, err := NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder: %v", err)
	}
	defer emb.Close()

	texts := []string{
		"first sentence",
		"second example text",
		"third document fragment",
	}
	embeddings, err := emb.GenerateBatch(texts, 0)
	if err != nil {
		t.Fatalf("GenerateBatch error: %v", err)
	}

	if len(embeddings) != len(texts) {
		t.Fatalf("batch size mismatch: got %d, want %d", len(embeddings), len(texts))
	}
	for i, vec := range embeddings {
		if len(vec) != 384 {
			t.Errorf("embedding %d: dim=%d, want 384", i, len(vec))
		}
		// basic sanity: each vector should be normalized (~1.0)
		var normSq float64
		for _, v := range vec {
			normSq += float64(v * v)
		}
		norm := math.Sqrt(normSq)
		if math.Abs(norm-1.0) > 1e-5 {
			t.Errorf("embedding %d: L2 norm=%f, want ~1.0", i, norm)
		}
	}
}

// TestTokenize verifies that tokenization produces a non-empty token slice.
func TestTokenize(t *testing.T) {
	modelPath := filepath.Join(os.Getenv("PWD"), "internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found at: " + modelPath)
	}
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set, skipping llama.cpp test")
	}

	emb, err := NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder (llama.cpp not built?): %v", err)
	}
	defer emb.Close()

	tokens, err := emb.Tokenize("Hello world")
	if err != nil {
		t.Fatalf("Tokenize error: %v", err)
	}
	if len(tokens) == 0 {
		t.Error("expected non-empty token slice")
	}
}

// TestTokensToText_RoundTrip tests that tokenizing and then detokenizing yields similar text.
func TestTokensToText_RoundTrip(t *testing.T) {
	modelPath := filepath.Join(os.Getenv("PWD"), "internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found at: " + modelPath)
	}
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set, skipping llama.cpp test")
	}

	emb, err := NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder: %v", err)
	}
	defer emb.Close()

	text := "Hello world"
	tokens, err := emb.Tokenize(text)
	if err != nil {
		t.Fatalf("Tokenize error: %v", err)
	}
	recovered, err := emb.TokensToText(tokens)
	if err != nil {
		t.Fatalf("TokensToText error: %v", err)
	}
	if recovered == "" {
		t.Error("expected non-empty recovered text")
	}
}
