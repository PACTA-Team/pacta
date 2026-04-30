package models

import (
	"encoding/json"
	"time"
)

type LegalDocument struct {
	ID              int        `json:"id" db:"id"`
	Title           string     `json:"title" db:"title"`
	DocumentType    string     `json:"document_type" db:"document_type"`
	Source          string     `json:"source,omitempty" db:"source"`
	Content         string     `json:"content" db:"content"`
	ContentHash     string     `json:"content_hash" db:"content_hash"`
	Language        string     `json:"language" db:"language"`
	Jurisdiction    string     `json:"jurisdiction" db:"jurisdiction"`
	EffectiveDate   *string    `json:"effective_date,omitempty" db:"effective_date"`
	PublicationDate *string    `json:"publication_date,omitempty" db:"publication_date"`
	GacetaNumber    string     `json:"gaceta_number,omitempty" db:"gaceta_number"`
	Tags            []string   `json:"tags" db:"tags"`
	ChunkCount      int        `json:"chunk_count" db:"chunk_count"`
	IndexedAt       *time.Time `json:"indexed_at,omitempty" db:"indexed_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

func (ld *LegalDocument) GetTagsJSON() (string, error) {
	data, err := json.Marshal(ld.Tags)
	return string(data), err
}

func (ld *LegalDocument) SetTagsFromJSON(data string) error {
	return json.Unmarshal([]byte(data), &ld.Tags)
}
