package ai

import (
	"database/sql"
	"fmt"
	"strings"
)

// SimilarContract represents a contract retrieved for RAG
type SimilarContract struct {
	ID      int
	Title   string
	Type    string
	Content string // Extracted text from document
}

// ContractRetriever handles retrieving similar contracts from SQLite
type ContractRetriever struct {
	DB *sql.DB
}

// NewContractRetriever creates a new contract retriever
func NewContractRetriever(db *sql.DB) *ContractRetriever {
	return &ContractRetriever{DB: db}
}

// GetSimilarContracts retrieves similar contracts based on type and counterpart
func (r *ContractRetriever) GetSimilarContracts(contractType string, clientID, supplierID int, limit int) ([]SimilarContract, error) {
	query := `
		SELECT c.id, c.title, c.type, COALESCE(c.object, '') as content
		FROM contracts c
		WHERE c.type = ?
		  AND c.deleted_at IS NULL
		  AND (c.client_id = ? OR c.supplier_id = ?)
		ORDER BY c.created_at DESC
		LIMIT ?
	`

	rows, err := r.DB.Query(query, contractType, clientID, supplierID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query contracts: %w", err)
	}
	defer rows.Close()

	var contracts []SimilarContract
	for rows.Next() {
		var c SimilarContract
		if err := rows.Scan(&c.ID, &c.Title, &c.Type, &c.Content); err != nil {
			continue // Skip problematic rows
		}
		contracts = append(contracts, c)
	}

	return contracts, nil
}

// BuildRAGContext builds a context string from similar contracts
func BuildRAGContext(contracts []SimilarContract) string {
	if len(contracts) == 0 {
		return "No previous contracts available for reference."
	}

	var builder strings.Builder
	builder.WriteString("Similar previous contracts for reference:\n\n")

	for i, c := range contracts {
		builder.WriteString(fmt.Sprintf("--- Contract %d: %s ---\n", i+1, c.Title))
		if c.Content != "" {
			builder.WriteString(c.Content)
		} else {
			builder.WriteString("(No content available)")
		}
		builder.WriteString("\n\n")
	}

	return builder.String()
}
