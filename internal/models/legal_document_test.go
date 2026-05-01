package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLegalDocument_SerializeDeserialize(t *testing.T) {
	now := time.Now()
	deleted := now.Add(-24 * time.Hour)

	doc := LegalDocument{
		ID:              1,
		Title:           "Ley de Inversión Extranjera",
		DocumentType:    "ley",
		Source:          "Ley_118_2022.pdf",
		Content:         "Texto completo de la ley...",
		ContentHash:     "abc123",
		Language:        "es",
		Jurisdiction:    "Cuba",
		EffectiveDate:   ptrString("2022-04-01"),
		PublicationDate: ptrString("2022-04-15"),
		GacetaNumber:    "Gaceta Oficial #45",
		Tags:            []string{"inversion", "extranjera"},
		ChunkCount:      45,
		IndexedAt:       &now,
		CreatedAt:       now,
		UpdatedAt:       now,
		DeletedAt:       &deleted,
		CompanyID:       1,
		UploadedBy:      5,
		StoragePath:     "data/legal_corpus/1/abc123.pdf",
		MimeType:        "application/pdf",
		SizeBytes:       254789,
		ChunkConfig:     `{"size":1000,"overlap":200,"strategy":"structured"}`,
		IsIndexed:       true,
	}

	// Test JSON serialization
	jsonBytes, err := doc.MarshalJSON()
	assert.NoError(t, err)
	assert.Contains(t, string(jsonBytes), `"company_id":1`)
	assert.Contains(t, string(jsonBytes), `"uploaded_by":5`)
	assert.Contains(t, string(jsonBytes), `"storage_path":"data/legal_corpus/1/abc123.pdf"`)
	assert.Contains(t, string(jsonBytes), `"mime_type":"application/pdf"`)
	assert.Contains(t, string(jsonBytes), `"size_bytes":254789`)
	assert.Contains(t, string(jsonBytes), `"is_indexed":true`)
	assert.Contains(t, string(jsonBytes), `"deleted_at"`)

	// Test deserialization
	var doc2 LegalDocument
	err = doc2.UnmarshalJSON(jsonBytes)
	assert.NoError(t, err)
	assert.Equal(t, doc.CompanyID, doc2.CompanyID)
	assert.Equal(t, doc.UploadedBy, doc2.UploadedBy)
	assert.Equal(t, doc.StoragePath, doc2.StoragePath)
	assert.Equal(t, doc.MimeType, doc2.MimeType)
	assert.Equal(t, doc.SizeBytes, doc2.SizeBytes)
	assert.Equal(t, doc.ChunkConfig, doc2.ChunkConfig)
	assert.Equal(t, doc.IsIndexed, doc2.IsIndexed)
	assert.Equal(t, doc.DeletedAt, doc2.DeletedAt)
}

func TestLegalDocument_TagsJSON(t *testing.T) {
	doc := LegalDocument{
		Tags: []string{"ley", "contratos", "cuba"},
	}

	tagsJSON, err := doc.GetTagsJSON()
	assert.NoError(t, err)
	assert.Contains(t, tagsJSON, `"ley"`)
	assert.Contains(t, tagsJSON, `"contratos"`)
	assert.Contains(t, tagsJSON, `"cuba"`)

	var tags []string
	err = json.Unmarshal([]byte(tagsJSON), &tags)
	assert.NoError(t, err)
	assert.Equal(t, 3, len(tags))
}

func TestLegalDocument_SetTagsFromJSON(t *testing.T) {
	doc := &LegalDocument{}
	err := doc.SetTagsFromJSON(`["tag1","tag2","tag3"]`)
	assert.NoError(t, err)
	assert.Equal(t, []string{"tag1", "tag2", "tag3"}, doc.Tags)
}

func ptrString(s string) *string {
	return &s
}
