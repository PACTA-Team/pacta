
package minirag

import (
	"regexp"
	"strings"
	"unicode"
)

const (
	MinChunkSize     = 200
	MaxChunkSize     = 2000
	DefaultChunkSize = 1000
	DefaultOverlap   = 50
)

// Chunk represents a chunk of legal text with metadata.
type Chunk struct {
	ID       int
	Text     string
	Title    string // e.g., "Artículo 1", "Cláusula Única"
	Position int    // order in document
}

// ParseByArticles is the main entry point for parsing legal documents.
// It splits content by articles (Artículo) and clauses (Cláusula),
// with fallback to generic chunking if no structure is detected.
func ParseByArticles(content string) []Chunk {
	if strings.TrimSpace(content) == "" {
		return []Chunk{}
	}

	// Detect if content has article or clause markers
	hasArticles := hasArticleMarkers(content)
	hasClauses := hasClauseMarkers(content)

	if hasArticles || hasClauses {
		return structuredChunking(content, hasArticles, hasClauses)
	}

	// Fallback to generic chunking
	return genericChunking(content)
}

// structuredChunking splits content by sections (articles/clauses).
// It extracts titles from section headers and handles large sections
// by further splitting them.
func structuredChunking(content string, hasArticles, hasClauses bool) []Chunk {
	sections := splitBySections(content)
	var chunks []Chunk
	position := 0

	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section == "" {
			continue
		}

		title := extractTitle(section)

		// Check if section is too large and needs further splitting
		if len(section) > MaxChunkSize {
			parts := splitLargeSection(section, title)
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					chunks = append(chunks, Chunk{
						ID:       len(chunks),
						Text:     part,
						Title:    title,
						Position: position,
					})
					position++
				}
			}
		} else {
			chunks = append(chunks, Chunk{
				ID:       len(chunks),
				Text:     section,
				Title:    title,
				Position: position,
			})
			position++
		}
	}

	return chunks
}

// genericChunking is the fallback for unstructured text.
// It splits by paragraphs and further splits large paragraphs.
func genericChunking(content string) []Chunk {
	sections := splitBySections(content)
	var chunks []Chunk
	position := 0

	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section == "" {
			continue
		}

		if len(section) > MaxChunkSize {
			parts := splitLargeSection(section, "")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					chunks = append(chunks, Chunk{
						ID:       len(chunks),
						Text:     part,
						Title:    "",
						Position: position,
					})
					position++
				}
			}
		} else if len(section) >= MinChunkSize || len(sections) == 1 {
			chunks = append(chunks, Chunk{
				ID:       len(chunks),
				Text:     section,
				Title:    "",
				Position: position,
			})
			position++
		} else {
			// Small section - try to merge with next or keep as is
			chunks = append(chunks, Chunk{
				ID:       len(chunks),
				Text:     section,
				Title:    "",
				Position: position,
			})
			position++
		}
	}

	// If we have many small chunks, merge them
	if len(chunks) > 1 {
		chunks = mergeSmallChunks(chunks)
	}

	return chunks
}

// MergeChunksWithOverlap adds overlapping text between consecutive chunks.
// This helps preserve context when chunks are processed independently.
func MergeChunksWithOverlap(chunks []Chunk, overlap int) []Chunk {
	if len(chunks) <= 1 {
		return chunks
	}

	if overlap <= 0 {
		overlap = DefaultOverlap
	}

	result := make([]Chunk, len(chunks))
	result[0] = chunks[0]

	for i := 1; i < len(chunks); i++ {
		prevText := chunks[i-1].Text
		currText := chunks[i].Text

		// Extract overlap words from previous chunk
		words := strings.Fields(prevText)
		overlapWords := words
		if len(words) > overlap {
			overlapWords = words[len(words)-overlap:]
		}

		overlapText := strings.Join(overlapWords, " ")

		result[i] = Chunk{
			ID:       chunks[i].ID,
			Text:     overlapText + " " + currText,
			Title:    chunks[i].Title,
			Position: chunks[i].Position,
		}
	}

	return result
}

// splitBySections splits content by double newlines.
func splitBySections(content string) []string {
	// Split by double newline (\n\n or \r\n\r\n)
	re := regexp.MustCompile(`\r?\n\r?\n`)
	sections := re.Split(content, -1)

	var result []string
	for _, s := range sections {
		s = strings.TrimSpace(s)
		if s != "" {
			result = append(result, s)
		}
	}

	return result
}

// extractTitle extracts the article or clause title from a section.
// It looks for patterns like "Artículo X", "Cláusula X", etc.
func extractTitle(section string) string {
	lines := strings.SplitN(section, "\n", 2)
	firstLine := strings.TrimSpace(lines[0])

	// Match article or clause patterns (case-insensitive)
	re := regexp.MustCompile(`^(Artículo|ARTICULO|Articulo|artículo|Cláusula|CLAUSULA|Clausula|cláusula)\s+[^.]+`)
	match := re.FindString(firstLine)

	if match != "" {
		// Extract just the title part (e.g., "Artículo 1" without the description)
		titleRe := regexp.MustCompile(`^(Artículo|ARTICULO|Articulo|artículo|Cláusula|CLAUSULA|Clausula|cláusula)\s+[^.]+`)
		titleMatch := titleRe.FindString(firstLine)
		if titleMatch != "" {
			// Remove trailing period if present
			titleMatch = strings.TrimSuffix(titleMatch, ".")
			return strings.TrimSpace(titleMatch)
		}
	}

	return ""
}

// hasArticleMarkers checks if content contains article markers.
func hasArticleMarkers(content string) bool {
	re := regexp.MustCompile(`(?i)\bArtículo\s+\d+`)
	return re.MatchString(content)
}

// hasClauseMarkers checks if content contains clause markers.
func hasClauseMarkers(content string) bool {
	re := regexp.MustCompile(`(?i)\bCláusula\s+[^.]+`)
	return re.MatchString(content)
}

// splitIntoSentences splits Spanish text into sentences.
func splitIntoSentences(text string) []string {
	// Look for sentence terminators followed by whitespace
	re := regexp.MustCompile(`[.!?]+\s+`)
	parts := re.Split(text, -1)

	var sentences []string
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			sentences = append(sentences, part)
		}
	}

	return sentences
}

// splitLargeSection splits a section that exceeds MaxChunkSize.
// It tries to split at sentence boundaries first, then at word boundaries.
func splitLargeSection(section, title string) []string {
	var parts []string

	// Try splitting by sentences first
	sentences := splitIntoSentences(section)
	if len(sentences) > 1 {
		var currentPart strings.Builder
		for _, sentence := range sentences {
			if currentPart.Len() > 0 && currentPart.Len()+len(sentence)+1 > MaxChunkSize {
				parts = append(parts, currentPart.String())
				currentPart.Reset()
				currentPart.WriteString(title)
				if title != "" {
					currentPart.WriteString(". ")
				}
			} else if currentPart.Len() > 0 {
				currentPart.WriteString(" ")
			}
			currentPart.WriteString(sentence)
		}
		if currentPart.Len() > 0 {
			parts = append(parts, currentPart.String())
		}
	} else {
		// No sentence boundaries, split by words
		words := strings.Fields(section)
		var currentPart strings.Builder
		for _, word := range words {
			if currentPart.Len() > 0 && currentPart.Len()+len(word)+1 > MaxChunkSize {
				parts = append(parts, currentPart.String())
				currentPart.Reset()
				currentPart.WriteString(title)
				if title != "" {
					currentPart.WriteString(". ")
				}
			} else if currentPart.Len() > 0 {
				currentPart.WriteString(" ")
			}
			currentPart.WriteString(word)
		}
		if currentPart.Len() > 0 {
			parts = append(parts, currentPart.String())
		}
	}

	// If still too large, force split
	var finalParts []string
	for _, part := range parts {
		if len(part) > MaxChunkSize {
			finalParts = append(finalParts, forceSplit(part, MaxChunkSize)...)
		} else {
			finalParts = append(finalParts, part)
		}
	}

	return finalParts
}

// forceSplit splits text at character level when all else fails.
func forceSplit(text string, maxSize int) []string {
	var parts []string
	runes := []rune(text)

	for i := 0; i < len(runes); i += maxSize {
		end := i + maxSize
		if end > len(runes) {
			end = len(runes)
		}
		parts = append(parts, string(runes[i:end]))
	}

	return parts
}

// mergeSmallChunks merges chunks that are below MinChunkSize.
func mergeSmallChunks(chunks []Chunk) []Chunk {
	if len(chunks) <= 1 {
		return chunks
	}

	var merged []Chunk
	var current strings.Builder
	var currentTitle string
	currentPosition := chunks[0].Position

	for i, chunk := range chunks {
		if current.Len() == 0 {
			current.WriteString(chunk.Text)
			currentTitle = chunk.Title
			currentPosition = chunk.Position
		} else if current.Len()+len(chunk.Text)+1 < MaxChunkSize {
			current.WriteString(" ")
			current.WriteString(chunk.Text)
		} else {
			merged = append(merged, Chunk{
				ID:       len(merged),
				Text:     current.String(),
				Title:    currentTitle,
				Position: currentPosition,
			})
			current.Reset()
			current.WriteString(chunk.Text)
			currentTitle = chunk.Title
			currentPosition = chunk.Position
		}

		// Last chunk
		if i == len(chunks)-1 && current.Len() > 0 {
			merged = append(merged, Chunk{
				ID:       len(merged),
				Text:     current.String(),
				Title:    currentTitle,
				Position: currentPosition,
			})
		}
	}

	return merged
}
