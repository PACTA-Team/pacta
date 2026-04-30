package hybrid

import (
	"context"
	"fmt"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/ai/minirag"
)

// Orchestrator manages hybrid RAG operations
type Orchestrator struct {
	LocalClient   *minirag.LocalClient
	Embedder      *minirag.EmbeddingClient
	VectorDB      *minirag.VectorDB
	Indexer       *minirag.Indexer
	ExternalLLM   ai.LLMProvider
	ExternalModel string
	ExternalKey   string
	ExternalEndpoint string
	Mode          string // "local", "external", "hybrid"
	Strategy      string // "local-first", "external-first", "parallel"
	HybridRerank  bool
}

// NewOrchestrator creates a new hybrid orchestrator
func NewOrchestrator(mode, strategy, localModel, embeddingModel string) *Orchestrator {
	o := &Orchestrator{
		Mode:         mode,
		Strategy:     strategy,
		HybridRerank: true,
	}

	// Initialize local components if mode is not external
	if mode != "external" {
		o.LocalClient = minirag.NewLocalClient("", localModel)
		o.Embedder = minirag.NewEmbeddingClient("", embeddingModel)
	}

	return o
}

// Query executes a query based on the configured mode and strategy
func (o *Orchestrator) Query(ctx context.Context, prompt, context string) (string, error) {
	switch o.Mode {
	case "local":
		return o.queryLocal(ctx, prompt, context)
	case "external":
		return o.queryExternal(ctx, prompt, context)
	case "hybrid":
		return o.queryHybrid(ctx, prompt, context)
	default:
		return "", fmt.Errorf("invalid RAG mode: %s", o.Mode)
	}
}

// queryLocal queries using only the local RAG system
func (o *Orchestrator) queryLocal(ctx context.Context, prompt, context string) (string, error) {
	if o.LocalClient == nil {
		return "", fmt.Errorf("local RAG not initialized")
	}

	// Build system prompt
	systemPrompt := ai.SystemPromptLegal
	if context != "" {
		systemPrompt = context + "\n\n" + systemPrompt
	}

	return o.LocalClient.Generate(ctx, prompt, systemPrompt)
}

// queryExternal queries using only the external LLM API
func (o *Orchestrator) queryExternal(ctx context.Context, prompt, context string) (string, error) {
	// Build system prompt
	systemPrompt := ai.SystemPromptLegal
	if context != "" {
		systemPrompt = context + "\n\n" + systemPrompt
	}

	// Create external client
	client := ai.NewLLMClient(o.ExternalLLM, o.ExternalKey, o.ExternalModel, o.ExternalEndpoint)

	return client.Generate(ctx, prompt, systemPrompt)
}

// queryHybrid queries using both local and external systems
func (o *Orchestrator) queryHybrid(ctx context.Context, prompt, context string) (string, error) {
	switch o.Strategy {
	case "local-first":
		return o.queryLocalFirst(ctx, prompt, context)
	case "external-first":
		return o.queryExternalFirst(ctx, prompt, context)
	case "parallel":
		return o.queryParallel(ctx, prompt, context)
	default:
		return o.queryLocalFirst(ctx, prompt, context)
	}
}

// queryLocalFirst tries local first, falls back to external
func (o *Orchestrator) queryLocalFirst(ctx context.Context, prompt, context string) (string, error) {
	// Try local first
	if o.LocalClient != nil && o.LocalClient.CheckHealth() {
		result, err := o.queryLocal(ctx, prompt, context)
		if err == nil && result != "" {
			return result, nil
		}
	}

	// Fall back to external
	fmt.Println("Local RAG failed or unavailable, falling back to external")
	return o.queryExternal(ctx, prompt, context)
}

// queryExternalFirst tries external first, falls back to local
func (o *Orchestrator) queryExternalFirst(ctx context.Context, prompt, context string) (string, error) {
	// Try external first
	result, err := o.queryExternal(ctx, prompt, context)
	if err == nil && result != "" {
		return result, nil
	}

	// Fall back to local
	fmt.Println("External RAG failed, falling back to local")
	if o.LocalClient != nil && o.LocalClient.CheckHealth() {
		return o.queryLocal(ctx, prompt, context)
	}

	return result, err
}

// queryParallel queries both systems in parallel and combines results
func (o *Orchestrator) queryParallel(ctx context.Context, prompt, context string) (string, error) {
	type result struct {
		text string
		err  error
		from string
	}

	results := make(chan result, 2)

	// Query local
	go func() {
		var r result
		if o.LocalClient != nil && o.LocalClient.CheckHealth() {
			r.text, r.err = o.queryLocal(ctx, prompt, context)
			r.from = "local"
		} else {
			r.err = fmt.Errorf("local unavailable")
		}
		results <- r
	}()

	// Query external
	go func() {
		var r result
		r.text, r.err = o.queryExternal(ctx, prompt, context)
		r.from = "external"
		results <- r
	}()

	// Collect results
	var localResult, externalResult string
	var localErr, externalErr error

	for i := 0; i < 2; i++ {
		r := <-results
		if r.from == "local" {
			localResult = r.text
			localErr = r.err
		} else {
			externalResult = r.text
			externalErr = r.err
		}
	}

	// Combine results based on reranking
	if o.HybridRerank {
		return o.rerankResults(localResult, externalResult, localErr, externalErr)
	}

	// Simple fallback: prefer external if available
	if externalErr == nil && externalResult != "" {
		return externalResult, nil
	}
	if localErr == nil && localResult != "" {
		return localResult, nil
	}

	// Both failed
	if externalErr != nil {
		return "", externalErr
	}
	return "", localErr
}

// rerankResults combines and reranks results from both sources
func (o *Orchestrator) rerankResults(local, external string, localErr, externalErr error) (string, error) {
	// If one failed, use the other
	if localErr != nil && externalErr == nil {
		return external, nil
	}
	if externalErr != nil && localErr == nil {
		return local, nil
	}
	if localErr != nil && externalErr != nil {
		return "", fmt.Errorf("both systems failed: local=%v, external=%v", localErr, externalErr)
	}

	// Both succeeded - prefer external for complex queries, local for simple/fast
	if len(external) > len(local)*2 {
		// External is much more detailed, probably better
		return external, nil
	}

	// Similar length or local is better - use local (faster, cheaper)
	return local, nil
}

// SearchSimilar searches for similar documents
func (o *Orchestrator) SearchSimilar(queryText string, k int) ([]minirag.SearchResult, error) {
	if o.VectorDB == nil {
		return nil, fmt.Errorf("vector database not initialized")
	}

	// Generate embedding
	embedding, err := o.Embedder.GenerateEmbedding(queryText)
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Search vector DB
	results := o.VectorDB.Search(embedding, k)
	return results, nil
}

// CheckHealth checks the health of all components
func (o *Orchestrator) CheckHealth() map[string]bool {
	health := make(map[string]bool)

	if o.LocalClient != nil {
		health["local_llm"] = o.LocalClient.CheckHealth()
	} else {
		health["local_llm"] = false
	}

	if o.Embedder != nil {
		health["local_embeddings"] = o.Embedder.CheckHealth()
	} else {
		health["local_embeddings"] = false
	}

	if o.VectorDB != nil {
		health["vector_db"] = o.VectorDB.Count() >= 0
	} else {
		health["vector_db"] = false
	}

	// External health check would require actual API call
	health["external_llm"] = o.ExternalKey != ""

	return health
}

// GetMode returns the current RAG mode
func (o *Orchestrator) GetMode() string {
	return o.Mode
}

// SetMode updates the RAG mode
func (o *Orchestrator) SetMode(mode string) error {
	switch mode {
	case "local", "external", "hybrid":
		o.Mode = mode
		return nil
	default:
		return fmt.Errorf("invalid RAG mode: %s", mode)
	}
}
