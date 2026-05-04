package ai

import (
	"fmt"
	"strings"

	"github.com/PACTA-Team/pacta/internal/db"
)

// SimilarContract represents a contract retrieved for RAG
type SimilarContract struct {
	ID      int
	Title   string
	Type    string
	Content string // Extracted text from document
}

// ContractRetriever handles retrieving similar contracts using sqlc Queries
type ContractRetriever struct {
	Queries *db.Queries
}

// NewContractRetriever creates a new contract retriever using sqlc Queries
func NewContractRetriever(queries *db.Queries) *ContractRetriever {
	return &ContractRetriever{Queries: queries}
}

// GetSimilarContracts retrieves similar contracts based on type and counterpart, scoped to a company
func (r *ContractRetriever) GetSimilarContracts(companyID int, contractType string, clientID, supplierID int, limit int) ([]SimilarContract, error) {
	rows, err := r.Queries.GetSimilarContracts(context.Background(), db.GetSimilarContractsParams{
		ContractType: contractType,
		CompanyID:   int64(companyID),
		ClientID:    int64(clientID),
		SupplierID:  int64(supplierID),
		Limit:       int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query contracts: %w", err)
	}

	var contracts []SimilarContract
	for _, row := range rows {
		contracts = append(contracts, SimilarContract{
			ID:      int(row.ID),
			Title:   row.Title,
			Type:    row.Type,
			Content: row.Content,
		})
	}
	return contracts, nil
}

// BuildRAGContext builds a context string from similar contracts
func BuildRAGContext(contracts []SimilarContract) string {
	if len(contracts) == 0 {
		return "No previous contracts available for reference.\n"
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
