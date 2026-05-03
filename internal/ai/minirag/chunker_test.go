package minirag

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/PACTA-Team/pacta/internal/ai/minirag/embedding"
	"github.com/stretchr/testify/require"
)

func TestChunkByTokens_Basic(t *testing.T) {
	modelPath := filepath.Join(os.Getenv("PWD"), "internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found")
	}
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set")
	}

	emb, err := embedding.NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder: %v", err)
	}
	defer emb.Close()

	// Create a long text by repeating a sentence.
	sentence := "This is a test sentence. "
	text := ""
	for i := 0; i < 100; i++ {
		text += sentence
	}

	chunks, err := ChunkByTokens(emb, text, 50, 10)
	require.NoError(t, err)
	require.NotEmpty(t, chunks)

	// With long text, expect multiple chunks
	if len(chunks) < 2 {
		t.Errorf("expected at least 2 chunks, got %d", len(chunks))
	}
}

func TestChunkByTokens_Overlap(t *testing.T) {
	modelPath := filepath.Join(os.Getenv("PWD"), "internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		t.Skip("GGUF model file not found")
	}
	if os.Getenv("SKIP_LLAMA") == "1" {
		t.Skip("SKIP_LLAMA set")
	}

	emb, err := embedding.NewEmbedder()
	if err != nil {
		t.Skipf("Failed to create embedder: %v", err)
	}
	defer emb.Close()

	// Use a known phrase.
	text := "One two three four five six seven eight nine ten "
	// repeat enough to have several chunks
	full := ""
	for i := 0; i < 20; i++ {
		full += text
	}
	chunks, err := ChunkByTokens(emb, full, 30, 5)
	require.NoError(t, err)
	require.NotEmpty(t, chunks)

	// Check that adjacent chunks have overlapping tokens.
	tokens1, _ := emb.Tokenize(chunks[0].Text)
	tokens2, _ := emb.Tokenize(chunks[1].Text)
	if len(tokens1) < 5 || len(tokens2) < 5 {
		t.Skip("chunks too small for overlap test")
	}
	// Overlap of 5 tokens expected.
	overlapTokens := tokens1[len(tokens1)-5:]
	// Should equal first 5 tokens of tokens2
	for i, tok := range overlapTokens {
		if tok != tokens2[i] {
			t.Errorf("token overlap mismatch at index %d: got %v, want %v", i, tokens2[i], tok)
		}
	}
}
