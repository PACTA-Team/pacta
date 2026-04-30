package hybrid

import (
	"fmt"
	"strings"

	"github.com/PACTA-Team/pacta/internal/ai/minirag"
)

// MergeStrategies combines results from multiple sources
type MergeStrategies struct{}

// LocalFirst prefers local results, supplements with external
func (m *MergeStrategies) LocalFirst(local, external []minirag.SearchResult) []minirag.SearchResult {
	if len(local) == 0 {
		return external
	}
	if len(external) == 0 || len(local) >= 5 {
		return local[:minInt(len(local), 5)]
	}

	// Combine, preferring local
	combined := append([]minirag.SearchResult{}, local...)
	for _, ext := range external {
		if !containsResult(combined, ext.ID) {
			combined = append(combined, ext)
		}
		if len(combined) >= 5 {
			break
		}
	}

	return combined[:minInt(len(combined), 5)]
}

// ExternalFirst prefers external results, supplements with local
func (m *MergeStrategies) ExternalFirst(local, external []minirag.SearchResult) []minirag.SearchResult {
	if len(external) == 0 {
		return local
	}
	if len(local) == 0 || len(external) >= 5 {
		return external[:minInt(len(external), 5)]
	}

	// Combine, preferring external
	combined := append([]minirag.SearchResult{}, external...)
	for _, loc := range local {
		if !containsResult(combined, loc.ID) {
			combined = append(combined, loc)
		}
		if len(combined) >= 5 {
			break
		}
	}

	return combined[:minInt(len(combined), 5)]
}

// ParallelWeighted combines with weighted scoring
func (m *MergeStrategies) ParallelWeighted(local, external []minirag.SearchResult, localWeight, externalWeight float64) []minirag.SearchResult {
	scoreMap := make(map[string]*scoredResult)

	// Add local results
	for _, res := range local {
		scoreMap[res.ID] = &scoredResult{
			SearchResult: res,
			score:        res.Score * float32(localWeight),
		}
	}

	// Add/combine external results
	for _, res := range external {
		if existing, ok := scoreMap[res.ID]; ok {
			// Combine scores
			existing.score = (existing.score + res.Score*float32(externalWeight)) / 2
		} else {
			scoreMap[res.ID] = &scoredResult{
				SearchResult: res,
				score:        res.Score * float32(externalWeight),
			}
		}
	}

	// Convert to slice and sort
	results := make([]scoredResult, 0, len(scoreMap))
	for _, sr := range scoreMap {
		results = append(results, *sr)
	}

	// Sort by score (descending)
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].score > results[i].score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	// Convert back
	final := make([]minirag.SearchResult, 0, minInt(len(results), 5))
	for i := 0; i < len(results) && i < 5; i++ {
		final = append(final, results[i].SearchResult)
	}

	return final
}

// Rerank reorders results based on semantic similarity to query
type Rerank struct {
	embedder *minirag.EmbeddingClient
	query    string
}

// NewRerank creates a new reranker
func NewRerank(embedder *minirag.EmbeddingClient, query string) *Rerank {
	return &Rerank{
		embedder: embedder,
		query:    query,
	}
}

// RerankResults reranks search results by relevance to query
func (r *Rerank) RerankResults(results []minirag.SearchResult) ([]minirag.SearchResult, error) {
	if len(results) <= 1 {
		return results, nil
	}

	// Generate query embedding
	queryEmb, err := r.embedder.GenerateEmbedding(r.query)
	if err != nil {
		return results, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	// Calculate semantic similarity scores
	reranked := make([]minirag.SearchResult, len(results))
	copy(reranked, results)

	for i := range reranked {
		// Combine original score with semantic similarity
		contentEmb, err := r.embedder.GenerateEmbedding(reranked[i].Content)
		if err != nil {
			continue // Keep original score if embedding fails
		}

		semanticScore := minirag.CosineSimilarity(queryEmb, contentEmb)
		// Weighted combination: 60% semantic, 40% original
		reranked[i].Score = 0.6*semanticScore + 0.4*reranked[i].Score
	}

	// Sort by new score
	for i := 0; i < len(reranked); i++ {
		for j := i + 1; j < len(reranked); j++ {
			if reranked[j].Score > reranked[i].Score {
				reranked[i], reranked[j] = reranked[j], reranked[i]
			}
		}
	}

	return reranked, nil
}

// CrossEncoder performs cross-encoder reranking (simulated)
type CrossEncoder struct {
	model string
}

// NewCrossEncoder creates a new cross-encoder
func NewCrossEncoder(model string) *CrossEncoder {
	if model == "" {
		model = "cross-encoder/ms-marco-MiniLM-L-6-v2"
	}
	return &CrossEncoder{model: model}
}

// Rerank performs cross-encoding reranking
func (ce *CrossEncoder) Rerank(query string, documents []string) ([]float64, error) {
	scores := make([]float64, len(documents))

	// Simulated cross-encoder scores
	// In production, would use actual cross-encoder model
	for i, doc := range documents {
		// Simple similarity-based scoring as placeholder
		commonWords := countCommonWords(query, doc)
		scores[i] = float64(commonWords) / float64(max(len(query), len(doc)))
	}

	return scores, nil
}

type scoredResult struct {
	minirag.SearchResult
	score float32
}

func containsResult(results []minirag.SearchResult, id string) bool {
	for _, res := range results {
		if res.ID == id {
			return true
		}
	}
	return false
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func countCommonWords(s1, s2 string) int {
	words1 := strings.Fields(strings.ToLower(s1))
	words2 := strings.Fields(strings.ToLower(s2))

	wordSet := make(map[string]bool)
	for _, w := range words1 {
		wordSet[w] = true
	}

	count := 0
	for _, w := range words2 {
		if wordSet[w] {
			count++
			delete(wordSet, w)
		}
	}

	return count
}

// SemanticRerank reranks using semantic similarity only
type SemanticRerank struct {
	embedder *minirag.EmbeddingClient
}

// NewSemanticRerank creates a new semantic reranker
func NewSemanticRerank(embedder *minirag.EmbeddingClient) *SemanticRerank {
	return &SemanticRerank{embedder: embedder}
}

// RerankByQuery reranks results by semantic similarity to query
func (sr *SemanticRerank) RerankByQuery(query string, results []minirag.SearchResult) ([]minirag.SearchResult, error) {
	if len(results) <= 1 {
		return results, nil
	}

	queryEmb, err := sr.embedder.GenerateEmbedding(query)
	if err != nil {
		return results, err
	}

	reranked := make([]minirag.SearchResult, len(results))
	copy(reranked, results)

	for i := range reranked {
		contentEmb, err := sr.embedder.GenerateEmbedding(reranked[i].Content)
		if err == nil {
			reranked[i].Score = minirag.CosineSimilarity(queryEmb, contentEmb)
		}
	}

	// Sort descending by score
	for i := 0; i < len(reranked); i++ {
		for j := i + 1; j < len(reranked); j++ {
			if reranked[j].Score > reranked[i].Score {
				reranked[i], reranked[j] = reranked[j], reranked[i]
			}
		}
	}

	return reranked, nil
}
