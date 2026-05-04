package minirag

import (
	"github.com/PACTA-Team/pacta/internal/ai/minirag/embedding"
)

// ChunkByTokens splits text into overlapping chunks based on token count.
func ChunkByTokens(emb *embedding.Embedder, text string, chunkSize, overlap int) ([]Chunk, error) {
	tokens, err := emb.Tokenize(text)
	if err != nil {
		return nil, err
	}
	if len(tokens) <= chunkSize {
		content, _ := emb.TokensToText(tokens)
		return []Chunk{{ID: 0, Text: content, Position: 0}}, nil
	}
	step := chunkSize - overlap
	var chunks []Chunk
	for i := 0; i < len(tokens); i += step {
		end := i + chunkSize
		if end > len(tokens) {
			end = len(tokens)
		}
		chunkTokens := tokens[i:end]
		chunkText, _ := emb.TokensToText(chunkTokens)
		chunks = append(chunks, Chunk{
			ID:       len(chunks),
			Text:     chunkText,
			Position: i,
		})
	}
	return chunks, nil
}
