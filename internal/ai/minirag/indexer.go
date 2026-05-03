package minirag

import (
	"context"
	"fmt"

	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/models"
)

// Indexer handles automatic indexing of contracts into the vector database.
type Indexer struct {
	Queries *db.Queries
	Service *Service
}

// NewIndexer creates a new indexer using the provided service.
func NewIndexer(queries *db.Queries, svc *Service) *Indexer {
	return &Indexer{
		Queries: queries,
		Service: svc,
	}
}

// IndexContract indexes a single contract by converting it to a LegalDocument
// and delegating to the service.
func (idx *Indexer) IndexContract(contractID int) error {
	row, err := idx.Queries.GetContractForRAG(context.Background(), int64(contractID))
	if err != nil {
		return fmt.Errorf("failed to fetch contract: %w", err)
	}

	// Combine object (if any) with content
	fullText := row.Content
	if len(row.Object) > 0 {
		fullText = string(row.Object) + "\n" + row.Content
	}

	doc := &models.LegalDocument{
		ID:            row.ID,
		DocumentType:  row.Type,
		Title:         row.Title,
		Content:       fullText,
		// Language and Jurisdiction are not used for contracts; leave empty.
	}

	return idx.Service.IndexLegalDocument(doc)
}

// IndexAllContracts indexes all non-deleted contracts.
func (idx *Indexer) IndexAllContracts() (int, error) {
	rows, err := idx.Queries.GetAllContractIDsForRAG(context.Background())
	if err != nil {
		return 0, fmt.Errorf("failed to query contracts: %w", err)
	}

	var contractIDs []int64
	for _, r := range rows {
		contractIDs = append(contractIDs, r.ID)
	}

	successCount := 0
	for i, id := range contractIDs {
		if err := idx.IndexContract(int(id)); err != nil {
			fmt.Printf("Warning: failed to index contract %d: %v\n", id, err)
			continue
		}
		successCount++
		if (i + 1) % 10 == 0 {
			fmt.Printf("Indexed %d/%d contracts...\n", i+1, len(contractIDs))
		}
	}
	return successCount, nil
}

// IndexNewOrUpdatedContracts indexes only contracts created or updated since the given time.
func (idx *Indexer) IndexNewOrUpdatedContracts(since time.Time) (int, error) {
	rows, err := idx.Queries.GetNewOrUpdatedContractIDs(context.Background(), since)
	if err != nil {
		return 0, fmt.Errorf("failed to query new contracts: %w", err)
	}

	var contractIDs []int64
	for _, r := range rows {
		contractIDs = append(contractIDs, r.ID)
	}

	successCount := 0
	for _, id := range contractIDs {
		if err := idx.IndexContract(int(id)); err != nil {
			fmt.Printf("Warning: failed to index contract %d: %v\n", id, err)
			continue
		}
		successCount++
	}
	return successCount, nil
}

// IndexLegalDocument indexes a legal document by delegating to the service
// and then updating the legal_documents table with chunk count and indexed timestamp.
func (idx *Indexer) IndexLegalDocument(doc *models.LegalDocument) error {
	// Delegate to service for chunking, embedding, storing
	if err := idx.Service.IndexLegalDocument(doc); err != nil {
		return err
	}
	// Get chunk count from store
	chunks, err := idx.Service.Store.GetChunksByContract(int64(doc.ID))
	if err != nil {
		// Log but not fatal; continue
		fmt.Printf("Warning: could not get chunks for doc %d: %v\n", doc.ID, err)
		return nil
	}
	count := len(chunks)
	now := time.Now()
	// Update legal_documents table
	err = idx.Queries.UpdateLegalDocumentIndexed(context.Background(), db.UpdateLegalDocumentIndexedParams{
		ID:         int64(doc.ID),
		ChunkCount: count,
		IndexedAt:  &now,
	})
	if err != nil {
		return fmt.Errorf("failed to update legal_document indexed status: %w", err)
	}
	return nil
}

// Search performs a similarity search and returns results enriched with contract metadata.
func (idx *Indexer) Search(query string, k int) ([]SearchResult, error) {
	raw, err := idx.Service.SearchLegalDocuments(query, nil, k)
	if err != nil {
		return nil, err
	}
	results := make([]SearchResult, 0, len(raw))
	contractCache := make(map[int64]db.GetContractForRAGRow)
	for _, r := range raw {
		meta := r.Meta
		row, ok := contractCache[meta.ContractID]
		if !ok {
			row, err = idx.Queries.GetContractForRAG(context.Background(), meta.ContractID)
			if err != nil {
				// skip if contract not found
				continue
			}
			contractCache[meta.ContractID] = row
		}
		docMeta := DocumentMeta{
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
		results = append(results, SearchResult{
			ID:      docMeta.ID,
			Score:   r.Score,
			Meta:    docMeta,
			Content: meta.Content,
		})
	}
	return results, nil
}

// SearchLegalDocuments performs a search with optional filters and returns enriched results.
func (idx *Indexer) SearchLegalDocuments(query string, filter map[string]interface{}, limit int) ([]SearchResult, error) {
	raw, err := idx.Service.SearchLegalDocuments(query, filter, limit)
	if err != nil {
		return nil, err
	}
	results := make([]SearchResult, 0, len(raw))
	contractCache := make(map[int64]db.GetContractForRAGRow)
	for _, r := range raw {
		meta := r.Meta
		row, ok := contractCache[meta.ContractID]
		if !ok {
			row, err = idx.Queries.GetContractForRAG(context.Background(), meta.ContractID)
			if err != nil {
				continue
			}
			contractCache[meta.ContractID] = row
		}
		docMeta := DocumentMeta{
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
		results = append(results, SearchResult{
			ID:      docMeta.ID,
			Score:   r.Score,
			Meta:    docMeta,
			Content: meta.Content,
		})
	}
	return results, nil
}

// GetIndexStats returns statistics about the current index.
func (idx *Indexer) GetIndexStats() map[string]interface{} {
	count := 0
	var err error
	if idx.Service != nil && idx.Service.Store != nil {
		count, err = idx.Service.Store.CountChunks()
		if err != nil {
			count = 0
		}
	}
	return map[string]interface{}{
		"document_count": count,
		"index_type":     "FAISS",
		"embedding_dim":  384,
	}
}

// ClearIndex removes all chunks from the index (not implemented in FAISS mode).
func (idx *Indexer) ClearIndex() error {
	// Not implemented; FAISS index replacement would be required.
	return nil
}
