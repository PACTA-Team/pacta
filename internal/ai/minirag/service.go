package minirag

import (
	"database/sql"
	"errors"
	"fmt"
	"os"

	"github.com/PACTA-Team/pacta/internal/ai/minirag/embedding"
	"github.com/PACTA-Team/pacta/internal/ai/minirag/storage"
	"github.com/PACTA-Team/pacta/internal/ai/minirag/vector"
	"github.com/PACTA-Team/pacta/internal/models"
)

// Service orchestrates RAG operations: embedding, vector search, and metadata storage.
type Service struct {
	Embedder *embedding.Embedder
	VectorDB *vector.FAISSIndex
	Store    *storage.SQLiteStore
}

// RAGSearchResult is the raw search result returned by the service.
type RAGSearchResult struct {
	ID      string            `json:"id"`
	Score   float32           `json:"score"`
	Meta    storage.ChunkMeta `json:"meta"`
	Content string            `json:"content"`
}

// LegalDocument is an alias for models.LegalDocument for convenience.
type LegalDocument = models.LegalDocument

// NewService creates a new Service with embedded embedder, FAISS index, and SQLite store.
// modelPath is currently unused (embedded model is fixed).
// The MINIRAG_ADAPTER environment variable controls whether the linear adapter is applied.
func NewService(modelPath, dbPath string) (*Service, error) {
	useAdapter := os.Getenv("MINIRAG_ADAPTER") == "1"
	emb, err := embedding.NewEmbedder(useAdapter)
	if err != nil {
		return nil, fmt.Errorf("failed to create embedder: %w", err)
	}
	vdb, err := vector.NewFAISSIndex(384)
	if err != nil {
		return nil, fmt.Errorf("failed to create FAISS index: %w", err)
	}
	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create SQLite store: %w", err)
	}
	return &Service{
		Embedder: emb,
		VectorDB: vdb,
		Store:    store,
	}, nil
}
	vdb, err := vector.NewFAISSIndex(384)
	if err != nil {
		return nil, fmt.Errorf("failed to create FAISS index: %w", err)
	}
	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create SQLite store: %w", err)
	}
	return &Service{
		Embedder: emb,
		VectorDB: vdb,
		Store:    store,
	}, nil
}

// IndexLegalDocument chunks, embeds, and indexes a legal document.
func (s *Service) IndexLegalDocument(doc *LegalDocument) error {
	// 1. Chunk the document by tokens
	chunks, err := ChunkByTokens(s.Embedder, doc.Content, 512, 50)
	if err != nil {
		return fmt.Errorf("failed to chunk document: %w", err)
	}
	if len(chunks) == 0 {
		return fmt.Errorf("no chunks generated from document")
	}

	// 2. Generate embeddings for all chunks in batch
	texts := make([]string, len(chunks))
	for i, c := range chunks {
		texts[i] = c.Text
	}
	embeddings, err := s.Embedder.GenerateBatch(texts, 32)
	if err != nil {
		return fmt.Errorf("failed to generate embeddings: %w", err)
	}

	// 3. Determine starting vector ID (monotonic)
	maxID, err := s.Store.GetMaxVectorID()
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("failed to get max vector ID: %w", err)
	}
	startID := maxID + 1

	// 4. Add each chunk vector and metadata
	for i, chunk := range chunks {
		vectorID := startID + int64(i)
		if err := s.VectorDB.Add(embeddings[i], vectorID); err != nil {
			return fmt.Errorf("failed to add vector for chunk %d: %w", i, err)
		}
		meta := storage.ChunkMeta{
			ContractID: int64(doc.ID),
			ChunkIndex: i,
			Content:    chunk.Text,
			ClauseType: doc.Jurisdiction, // store jurisdiction for filtering
			VectorID:   vectorID,
		}
		if err := s.Store.AddChunk(meta); err != nil {
			return fmt.Errorf("failed to add chunk metadata: %w", err)
		}
	}
	return nil
}

// SearchLegalDocuments searches for relevant document chunks.
// filters is optional; currently only "jurisdiction" is supported (matches ClauseType).
func (s *Service) SearchLegalDocuments(query string, filters map[string]interface{}, limit int) ([]RAGSearchResult, error) {
	qEmb, err := s.Embedder.GenerateEmbedding(query)
	if err != nil {
		return nil, fmt.Errorf("failed to embed query: %w", err)
	}
	raw := s.VectorDB.Search(qEmb, limit*2) // retrieve more to filter
	results := make([]RAGSearchResult, 0, limit)
	for _, r := range raw {
		meta, err := s.Store.GetChunkByVectorID(r.ID)
		if err != nil {
			continue
		}
		// Apply jurisdiction filter if provided
		if filters != nil {
			if jur, ok := filters["jurisdiction"].(string); ok && jur != "" {
				if meta.ClauseType != jur {
					continue
				}
			}
		}
		results = append(results, RAGSearchResult{
			ID:      fmt.Sprintf("%d", meta.ID),
			Score:   r.Score,
			Meta:    meta,
			Content: meta.Content,
		})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

// Close releases all resources.
func (s *Service) Close() error {
	var errs []error
	if err := s.Store.Close(); err != nil {
		errs = append(errs, err)
	}
	s.Embedder.Close()
	s.VectorDB.Close()
	if len(errs) > 0 {
		return errs[0]
	}
	return nil
}

// Count returns the total number of indexed chunks.
func (s *Service) Count() (int, error) {
	return s.Store.CountChunks()
}

// DeleteDocumentChunks removes all chunks associated with a document from the store.
// Vectors remain in FAISS but become unreachable.
func (s *Service) DeleteDocumentChunks(docID int64) error {
	return s.Store.DeleteChunksByContract(docID)
}
