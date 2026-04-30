
package legal

import (
	"testing"
)

func TestParseByArticles_StructuredContent(t *testing.T) {
	content := `Artículo 1. Disposiciones generales.
Este contrato se rige por las leyes cubanas.

Artículo 2. Obligaciones.
Las partes se obligan mutuamente a cumplir con los términos establecidos.

Cláusula Única. Disposiciones finales.
Este contrato entra en vigor a partir de su firma.`

	chunks := ParseByArticles(content)

	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}

	// Check first chunk
	if chunks[0].Title != "Artículo 1" {
		t.Errorf("expected title 'Artículo 1', got %s", chunks[0].Title)
	}
	if chunks[0].Position != 0 {
		t.Errorf("expected position 0, got %d", chunks[0].Position)
	}
	if chunks[0].ID != 0 {
		t.Errorf("expected ID 0, got %d", chunks[0].ID)
	}
	expectedText1 := "Artículo 1. Disposiciones generales.\nEste contrato se rige por las leyes cubanas."
	if chunks[0].Text != expectedText1 {
		t.Errorf("unexpected text for chunk 0:\nexpected: %s\ngot: %s", expectedText1, chunks[0].Text)
	}

	// Check second chunk
	if chunks[1].Title != "Artículo 2" {
		t.Errorf("expected title 'Artículo 2', got %s", chunks[1].Title)
	}
	if chunks[1].Position != 1 {
		t.Errorf("expected position 1, got %d", chunks[1].Position)
	}

	// Check third chunk (Cláusula)
	if chunks[2].Title != "Cláusula Única" {
		t.Errorf("expected title 'Cláusula Única', got %s", chunks[2].Title)
	}
	if chunks[2].Position != 2 {
		t.Errorf("expected position 2, got %d", chunks[2].Position)
	}
}

func TestParseByArticles_UnstructuredContent(t *testing.T) {
	content := `Este es un contrato simple sin estructura de artículos.

Las partes acuerdan lo siguiente:
1. Pago mensual de 1000 CUP.
2. Plazo de 12 meses.

Firmado en La Habana.`

	chunks := ParseByArticles(content)

	if len(chunks) == 0 {
		t.Fatal("expected at least one chunk, got none")
	}

	// Should use generic chunking
	for i, chunk := range chunks {
		if chunk.Title != "" {
			t.Errorf("chunk %d should have empty title for unstructured content, got %s", i, chunk.Title)
		}
		if chunk.Position != i {
			t.Errorf("chunk %d expected position %d, got %d", i, i, chunk.Position)
		}
	}
}

func TestParseByArticles_EmptyContent(t *testing.T) {
	chunks := ParseByArticles("")

	if len(chunks) != 0 {
		t.Errorf("expected 0 chunks for empty content, got %d", len(chunks))
	}
}

func TestParseByArticles_MixedCaseArticles(t *testing.T) {
	content := `artículo 1. disposiciones generales.
Texto en minúsculas.

ARTICULO 2. OBLIGACIONES.
Texto en mayúsculas.

ArTiCuLo 3. Mezclado.
Texto mixto.`

	chunks := ParseByArticles(content)

	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks for mixed case, got %d", len(chunks))
	}

	if chunks[0].Title != "artículo 1" {
		t.Errorf("expected 'artículo 1', got %s", chunks[0].Title)
	}
	if chunks[1].Title != "ARTICULO 2" {
		t.Errorf("expected 'ARTICULO 2', got %s", chunks[1].Title)
	}
	if chunks[2].Title != "ArTiCuLo 3" {
		t.Errorf("expected 'ArTiCuLo 3', got %s", chunks[2].Title)
	}
}

func TestParseByArticles_OnlyClauses(t *testing.T) {
	content := `Cláusula Primera. Objeto.
El objeto de este contrato es la prestación de servicios.

Cláusula Segunda. Precio.
El precio total es de 5000 CUP.`

	chunks := ParseByArticles(content)

	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks for clauses only, got %d", len(chunks))
	}

	if chunks[0].Title != "Cláusula Primera" {
		t.Errorf("expected 'Cláusula Primera', got %s", chunks[0].Title)
	}
	if chunks[1].Title != "Cláusula Segunda" {
		t.Errorf("expected 'Cláusula Segunda', got %s", chunks[1].Title)
	}
}

func TestParseByArticles_LargeContent(t *testing.T) {
	// Create content larger than MaxChunkSize
	longParagraph := "Lorem ipsum dolor sit amet. "
	for len(longParagraph) < 3000 {
		longParagraph += "Lorem ipsum dolor sit amet. "
	}
	content := "Artículo 1. Disposiciones.\n" + longParagraph

	chunks := ParseByArticles(content)

	if len(chunks) == 0 {
		t.Fatal("expected at least one chunk for large content")
	}

	// Each chunk should respect size limits
	for i, chunk := range chunks {
		if len(chunk.Text) > MaxChunkSize*2 {
			t.Errorf("chunk %d exceeds reasonable size limit: %d", i, len(chunk.Text))
		}
	}
}

func TestParseByArticles_NoDoubleNewline(t *testing.T) {
	content := `Artículo 1. Disposiciones generales. Este contrato se rige por las leyes cubanas.
Artículo 2. Obligaciones. Las partes se obligan mutuamente.`

	chunks := ParseByArticles(content)

	// Should still parse even without double newlines
	if len(chunks) < 2 {
		t.Fatalf("expected at least 2 chunks, got %d", len(chunks))
	}
}

func TestStructuredChunking(t *testing.T) {
	content := `Artículo 1. Disposiciones.
Texto del artículo.

Artículo 2. Obligaciones.
Más texto.`

	chunks := structuredChunking(content, true, false)

	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(chunks))
	}

	if chunks[0].Title != "Artículo 1" {
		t.Errorf("expected title 'Artículo 1', got %s", chunks[0].Title)
	}
	if chunks[1].Title != "Artículo 2" {
		t.Errorf("expected title 'Artículo 2', got %s", chunks[1].Title)
	}
}

func TestGenericChunking(t *testing.T) {
	content := `Este es un párrafo largo que debería ser dividido en múltiples chunks.

Este es otro párrafo.

Y este es el tercer párrafo del texto.`

	chunks := genericChunking(content)

	if len(chunks) == 0 {
		t.Fatal("expected at least one chunk")
	}

	for i, chunk := range chunks {
		if chunk.Title != "" {
			t.Errorf("chunk %d should have empty title", i)
		}
		if len(chunk.Text) == 0 {
			t.Errorf("chunk %d has empty text", i)
		}
	}
}

func TestGenericChunking_Empty(t *testing.T) {
	chunks := genericChunking("")

	if len(chunks) != 0 {
		t.Errorf("expected 0 chunks for empty content, got %d", len(chunks))
	}
}

func TestMergeChunksWithOverlap(t *testing.T) {
	chunks := []Chunk{
		{ID: 0, Text: "First chunk text here.", Title: "Part 1", Position: 0},
		{ID: 1, Text: "Second chunk text here.", Title: "Part 2", Position: 1},
		{ID: 2, Text: "Third chunk text here.", Title: "Part 3", Position: 2},
	}

	merged := MergeChunksWithOverlap(chunks, 3)

	if len(merged) != 3 {
		t.Fatalf("expected 3 chunks after merge, got %d", len(merged))
	}

	// First chunk should remain unchanged
	if merged[0].Text != chunks[0].Text {
		t.Errorf("first chunk text changed: %s", merged[0].Text)
	}

	// Second chunk should have overlap from first
	if len(merged[1].Text) <= len(chunks[1].Text) {
		t.Errorf("second chunk should have overlap text, but length is %d", len(merged[1].Text))
	}

	// Titles and positions should be preserved
	for i := range chunks {
		if merged[i].Title != chunks[i].Title {
			t.Errorf("chunk %d title changed: %s", i, merged[i].Title)
		}
		if merged[i].Position != chunks[i].Position {
			t.Errorf("chunk %d position changed: %d", i, merged[i].Position)
		}
	}
}

func TestMergeChunksWithOverlap_SingleChunk(t *testing.T) {
	chunks := []Chunk{
		{ID: 0, Text: "Only one chunk.", Title: "Single", Position: 0},
	}

	merged := MergeChunksWithOverlap(chunks, 5)

	if len(merged) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(merged))
	}
	if merged[0].Text != chunks[0].Text {
		t.Errorf("chunk text changed: %s", merged[0].Text)
	}
}

func TestMergeChunksWithOverlap_Empty(t *testing.T) {
	chunks := []Chunk{}

	merged := MergeChunksWithOverlap(chunks, 5)

	if len(merged) != 0 {
		t.Errorf("expected 0 chunks, got %d", len(merged))
	}
}

func TestSplitBySections(t *testing.T) {
	content := `Section 1
Text here.

Section 2
More text.

Section 3
Final text.`

	sections := splitBySections(content)

	if len(sections) != 3 {
		t.Fatalf("expected 3 sections, got %d", len(sections))
	}
}

func TestSplitBySections_NoDoubleNewline(t *testing.T) {
	content := `Section 1
Text here.
Section 2
More text.`

	sections := splitBySections(content)

	// Should return as single section
	if len(sections) != 1 {
		t.Fatalf("expected 1 section, got %d", len(sections))
	}
}

func TestExtractTitle(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Artículo 1. Disposiciones generales.", "Artículo 1"},
		{"Cláusula Única. Objeto.", "Cláusula Única"},
		{"Artículo 10. Números.", "Artículo 10"},
		{"Texto sin título.", ""},
		{"", ""},
	}

	for _, tt := range tests {
		result := extractTitle(tt.input)
		if result != tt.expected {
			t.Errorf("extractTitle(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSplitIntoSentences(t *testing.T) {
	text := "Primera oración. Segunda oración! ¿Tercera oración? Sí."
	sentences := splitIntoSentences(text)

	if len(sentences) < 3 {
		t.Fatalf("expected at least 3 sentences, got %d", len(sentences))
	}
}

func TestSplitLargeSection(t *testing.T) {
	section := "Artículo 1. Disposiciones. "
	for len(section) < 2500 {
		section += "Texto largo que necesita ser dividido. "
	}

	parts := splitLargeSection(section, "Artículo 1")

	if len(parts) < 2 {
		t.Fatalf("expected multiple parts for large section, got %d", len(parts))
	}

	for _, part := range parts {
		if len(part) == 0 {
			t.Error("empty part in split result")
		}
	}
}

func TestForceSplit(t *testing.T) {
	text := "This is a very long text that needs to be split. "
	for len(text) < 3000 {
		text += "More text to make it longer. "
	}

	parts := forceSplit(text, 1000)

	if len(parts) < 2 {
		t.Fatalf("expected multiple parts, got %d", len(parts))
	}

	for _, part := range parts {
		if len(part) > 1000 {
			t.Errorf("part exceeds max size: %d", len(part))
		}
	}
}

func TestChunkSizeLimits(t *testing.T) {
	content := `Artículo 1. Disposiciones generales.
`
	// Create content that's between MinChunkSize and MaxChunkSize
	for len(content) < 1500 {
		content += "Texto adicional para el artículo. "
	}

	chunks := ParseByArticles(content)

	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}

	for i, chunk := range chunks {
		if len(chunk.Text) < MinChunkSize && len(content) > MinChunkSize {
			t.Logf("chunk %d is smaller than MinChunkSize (%d < %d), but this is acceptable for the last chunk", i, len(chunk.Text), MinChunkSize)
		}
		if len(chunk.Text) > MaxChunkSize {
			t.Errorf("chunk %d exceeds MaxChunkSize: %d > %d", i, len(chunk.Text), MaxChunkSize)
		}
	}
}
