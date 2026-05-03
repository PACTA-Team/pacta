package minirag

import "time"

// DocumentMeta stores metadata for a document chunk group.
// This is the public-facing metadata returned in search results.
type DocumentMeta struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Type        string            `json:"type"`
	Source      string            `json:"source"`
	Content     string            `json:"content"`
	CreatedAt   string            `json:"created_at"`
	ExtraFields map[string]string `json:"extra_fields,omitempty"`
}

// SearchResult represents a single search result with metadata and content.
type SearchResult struct {
	ID      string       `json:"id"`
	Score   float32      `json:"score"`
	Meta    DocumentMeta `json:"meta"`
	Content string       `json:"content"`
}
