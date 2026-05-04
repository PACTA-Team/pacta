package hybrid

import (
	"context"
	"fmt"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/ai/minirag"
	"github.com/PACTA-Team/pacta/internal/db"
)

// Orchestrator manages hybrid RAG operations.
type Orchestrator struct {
	Service        *minirag.Service
	Indexer        *minirag.Indexer
	ExternalLLM    ai.LLMProvider
	ExternalModel  string
	ExternalKey    string
	ExternalEndpoint string
	Mode           string
	Strategy       string
	HybridRerank   bool
	Queries        *db.Queries // for enrichment
}

// NewOrchestrator creates a new hybrid orchestrator.
func NewOrchestrator(mode, localMode, strategy, localModel, embeddingModel string) *Orchestrator {
	o := &Orchestrator{
		Mode:         mode,
		Strategy:     strategy,
		HybridRerank: true,
	}
	// Note: Local LLM client removed (embedding-only). Embedder is accessed via Service.
	return o
}



// SearchSimilar searches for similar documents and returns enriched SearchResults.
func (o *Orchestrator) SearchSimilar(queryText string, k int) ([]minirag.SearchResult, error) {
	if o.Service == nil {
		return nil, fmt.Errorf("RAG service not initialized")
	}
	raw, err := o.Service.SearchLegalDocuments(queryText, nil, k)
	if err != nil {
		return nil, err
	}
	// Enrich results using contract metadata
	results := make([]minirag.SearchResult, 0, len(raw))
	contractCache := make(map[int64]db.GetContractForRAGRow)
	for _, r := range raw {
		meta := r.Meta
		row, ok := contractCache[meta.ContractID]
		if !ok {
			row, err = o.Queries.GetContractForRAG(context.Background(), meta.ContractID)
			if err != nil {
				continue
			}
			contractCache[meta.ContractID] = row
		}
		docMeta := minirag.DocumentMeta{
			ID:        fmt.Sprintf("legal_%d_chunk_%d", meta.ContractID, meta.ChunkIndex),
			Title:     row.Title,
			Type:      row.Type,
			Source:    "legal",
			Content:   meta.Content,
			CreatedAt: row.CreatedAt.Format("2006-01-02"),
			ExtraFields: map[string]string{
				"document_id":  fmt.Sprintf("%d", meta.ContractID),
				"jurisdiction": meta.ClauseType,
				"language":     "",
				"chunk_title":  "",
			},
		}
		results = append(results, minirag.SearchResult{
			ID:      docMeta.ID,
			Score:   r.Score,
			Meta:    docMeta,
			Content: meta.Content,
		})
	}
	return results, nil
}

// CheckHealth checks the health of all components.
func (o *Orchestrator) CheckHealth() map[string]bool {
	health := make(map[string]bool)
	// Local LLM is no longer supported; always false
	health["local_llm"] = false
	// Check embedder via Service
	if o.Service != nil && o.Service.Embedder != nil {
		health["local_embeddings"] = o.Service.Embedder.CheckHealth()
	} else {
		health["local_embeddings"] = false
	}
	if o.Service != nil && o.Service.Store != nil {
		if count, err := o.Service.Store.CountChunks(); err == nil && count >= 0 {
			health["vector_db"] = true
		} else {
			health["vector_db"] = false
		}
	} else {
		health["vector_db"] = false
	}
	health["external_llm"] = o.ExternalKey != ""
	return health
}


