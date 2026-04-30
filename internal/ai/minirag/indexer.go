package minirag

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai/legal"
	"github.com/PACTA-Team/pacta/internal/models"
)

// Indexer handles automatic indexing of contracts into the vector database
type Indexer struct {
	DB        *sql.DB
	VectorDB  *VectorDB
	Embedder  *EmbeddingClient
	ChunkSize int
	ChunkOverlap int
}

// NewIndexer creates a new document indexer
func NewIndexer(db *sql.DB, vectorDB *VectorDB, embedder *EmbeddingClient) *Indexer {
	return &Indexer{
		DB:            db,
		VectorDB:      vectorDB,
		Embedder:      embedder,
		ChunkSize:     500,
		ChunkOverlap:  50,
	}
}

// IndexContract indexes a single contract into the vector database
func (idx *Indexer) IndexContract(contractID int) error {
	// Fetch contract from database
	query := `
		SELECT c.id, c.title, c.type, c.object, COALESCE(c.content, ''), 
		       cl.name as client_name, s.name as supplier_name, 
		       c.created_at
		FROM contracts c
		LEFT JOIN companies cl ON c.client_id = cl.id
		LEFT JOIN companies s ON c.supplier_id = s.id
		WHERE c.id = ? AND c.deleted_at IS NULL
	`

	var id int
	var title, ctype, content, createdAt string
	var clientName, supplierName sql.NullString
	var object []byte

	err := idx.DB.QueryRow(query, contractID).Scan(
		&id, &title, &ctype, &object, &content, &clientName, &supplierName, &createdAt,
	)
	if err != nil {
		return fmt.Errorf("failed to fetch contract: %w", err)
	}

	// Build document metadata
	meta := DocumentMeta{
		ID:        fmt.Sprintf("contract_%d", id),
		Title:     title,
		Type:      ctype,
		Source:    "contract",
		Content:   content,
		CreatedAt: createdAt,
		ExtraFields: map[string]string{
			"client":    nullString(clientName),
			"supplier":  nullString(supplierName),
		},
	}

	// Combine all text for embedding
	fullText := content
	if len(object) > 0 {
		fullText = string(object) + "\n" + content
	}

	// Create chunks
	chunks := chunkText(fullText, idx.ChunkSize, idx.ChunkOverlap)

	// Generate embeddings and add to vector DB
	for i, chunk := range chunks {
		embedding, err := idx.Embedder.GenerateEmbedding(chunk)
		if err != nil {
			return fmt.Errorf("failed to generate embedding for chunk %d: %w", i, err)
		}

		chunkMeta := meta
		chunkMeta.ID = fmt.Sprintf("%s_chunk_%d", meta.ID, i)
		chunkMeta.Content = chunk

		if err := idx.VectorDB.AddDocument(chunkMeta.ID, embedding, chunkMeta); err != nil {
			return fmt.Errorf("failed to add document to vector DB: %w", err)
		}
	}

	return nil
}

// IndexAllContracts indexes all non-deleted contracts
func (idx *Indexer) IndexAllContracts() (int, error) {
	// Get all contract IDs
	rows, err := idx.DB.Query(`
		SELECT id FROM contracts WHERE deleted_at IS NULL ORDER BY id
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to query contracts: %w", err)
	}
	defer rows.Close()

	var count int
	var contractIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			continue
		}
		contractIDs = append(contractIDs, id)
		count++
	}

	// Index each contract
	successCount := 0
	for i, id := range contractIDs {
		if err := idx.IndexContract(id); err != nil {
			fmt.Printf("Warning: failed to index contract %d: %v\n", id, err)
			continue
		}
		successCount++

		if (i+1)%10 == 0 {
			fmt.Printf("Indexed %d/%d contracts...\n", i+1, len(contractIDs))
		}
	}

	// Save vector DB
	if err := idx.VectorDB.save(); err != nil {
		return successCount, fmt.Errorf("failed to save vector DB: %w", err)
	}

	return successCount, nil
}

// IndexNewOrUpdatedContracts indexes only contracts modified after the last index time
func (idx *Indexer) IndexNewOrUpdatedContracts(since time.Time) (int, error) {
	rows, err := idx.DB.Query(`
		SELECT id FROM contracts
		WHERE deleted_at IS NULL
		  AND (created_at > ? OR updated_at > ?)
		ORDER BY id
	`, since, since)
	if err != nil {
		return 0, fmt.Errorf("failed to query new contracts: %w", err)
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			continue
		}

		if err := idx.IndexContract(id); err != nil {
			fmt.Printf("Warning: failed to index contract %d: %v\n", id, err)
			continue
		}
		count++
	}

	if err := idx.VectorDB.save(); err != nil {
		return count, fmt.Errorf("failed to save vector DB: %w", err)
	}

	return count, nil
}

// chunkText splits text into overlapping chunks
func chunkText(text string, chunkSize, overlap int) []string {
	if len(text) <= chunkSize {
		return []string{text}
	}

	var chunks []string
	step := chunkSize - overlap

	for i := 0; i < len(text); i += step {
		end := i + chunkSize
		if end > len(text) {
			end = len(text)
		}

		chunk := strings.TrimSpace(text[i:end])
		if chunk != "" {
			chunks = append(chunks, chunk)
		}

		if end == len(text) {
			break
		}
	}

	return chunks
}

func nullString(s sql.NullString) string {
	if s.Valid {
		return s.String
	}
	return ""
}

// embedText generates embedding for a single text using the embedder
func (i *Indexer) embedText(text string) ([]float32, error) {
	return i.Embedder.GenerateEmbedding(text)
}

// ClearIndex removes all documents from the vector database
func (idx *Indexer) ClearIndex() error {
	// This is a simplified version - in production, you'd want to properly clear
	idx.VectorDB = &VectorDB{
		index:    newHNSWIndex(384, 16, 200),
		metadata: make(map[string]DocumentMeta),
		path:     idx.VectorDB.path,
		dim:      384,
	}
	return nil
}

// GetIndexStats returns statistics about the current index
func (idx *Indexer) GetIndexStats() map[string]interface{} {
	return map[string]interface{}{
		"document_count": idx.VectorDB.Count(),
		"index_type":     "HNSW",
		"embedding_dim":  384,
		"chunk_size":     idx.ChunkSize,
		"chunk_overlap":  idx.ChunkOverlap,
	}
}

// IndexLegalDocument indexes a legal document by chunking and embedding
func (idx *Indexer) IndexLegalDocument(doc *models.LegalDocument) error {
	// Parse document into chunks using legal.ParseByArticles
	chunks := legal.ParseByArticles(doc.Content)

	if len(chunks) == 0 {
		return fmt.Errorf("no chunks generated from document content")
	}

	// Add overlap between chunks using legal.MergeChunksWithOverlap
	chunks = legal.MergeChunksWithOverlap(chunks, 50)

	// Generate embeddings for each chunk using embedText helper
	embeddings := make([][]float32, len(chunks))
	for i, chunk := range chunks {
		embedding, err := idx.embedText(chunk.Text)
		if err != nil {
			return fmt.Errorf("failed to generate embedding for chunk %d: %w", i, err)
		}
		embeddings[i] = embedding
	}

	// Store in vector DB using AddLegalDocumentChunks
	legalMeta := LegalDocumentMetadata{
		DocumentID:   doc.ID,
		DocumentType: doc.DocumentType,
		Title:        doc.Title,
		Jurisdiction: doc.Jurisdiction,
		Language:     doc.Language,
	}

	err := idx.VectorDB.AddLegalDocumentChunks(chunks, legalMeta, embeddings)
	if err != nil {
		return fmt.Errorf("failed to add chunks to vector DB: %w", err)
	}

	// Update document chunk count and indexed timestamp
	now := time.Now()
	_, err = idx.DB.Exec(`
		UPDATE legal_documents
		SET chunk_count = ?, indexed_at = ?
		WHERE id = ?
	`, len(chunks), &now, doc.ID)
	if err != nil {
		return fmt.Errorf("failed to update document chunk count: %w", err)
	}

	return nil
}

// Search searches for similar documents in the vector database
func (idx *Indexer) Search(queryText string, k int) ([]SearchResult, error) {
	// Generate embedding for query
	embedding, err := idx.Embedder.GenerateEmbedding(queryText)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	// Search vector database
	results := idx.VectorDB.Search(embedding, k)
	return results, nil
}

// SearchLegalDocuments searches within legal document chunks using a text query
func (idx *Indexer) SearchLegalDocuments(query string, filter map[string]interface{}, limit int) ([]SearchResult, error) {
	// Generate embedding for query
	embedding, err := idx.embedText(query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	// Search vector database
	results, err := idx.VectorDB.SearchLegalDocuments(embedding, filter, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search legal documents: %w", err)
	}

	return results, nil
}
