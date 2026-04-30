package minirag

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

// PDFParser handles PDF document parsing
type PDFParser struct {
	Endpoint string // Optional: external Tika endpoint
	client   *http.Client
}

// NewPDFParser creates a new PDF parser
func NewPDFParser() *PDFParser {
	return &PDFParser{
		Endpoint: "", // No external Tika by default
		client:   &http.Client{Timeout: 60 * time.Second},
	}
}

// ParsePDF extracts text from a PDF file
type ParsePDF struct {
	Endpoint string // Optional: external Tika endpoint
	client   *http.Client
}

// NewParsePDF creates a new PDF parser
func NewParsePDF() *ParsePDF {
	return &ParsePDF{
		Endpoint: "",
		client:   &http.Client{Timeout: 60 * time.Second},
	}
}

// Parse extracts text from PDF bytes
// Note: This is a simplified version. In production, use a proper PDF library
func (p *ParsePDF) Parse(pdfBytes []byte) (string, error) {
	// If external Tika endpoint is configured, use it
	if p.Endpoint != "" {
		return p.parseWithTika(pdfBytes)
	}

	// Otherwise, attempt basic extraction
	// This is a simplified fallback - in production, integrate pdfcpu or similar
	return p.basicExtract(pdfBytes)
}

// ParseFromReader extracts text from a PDF reader
func (p *ParsePDF) ParseFromReader(reader io.Reader) (string, error) {
	pdfBytes, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to read PDF: %w", err)
	}
	return p.Parse(pdfBytes)
}

// ParseFile extracts text from a PDF file
func (p *ParsePDF) ParseFile(filePath string) (string, error) {
	// This would use actual PDF parsing library
	// For now, return placeholder
	return "", fmt.Errorf("PDF parsing not fully implemented - integrate pdfcpu or similar library")
}

// parseWithTika uses Apache Tika REST API for extraction
func (p *ParsePDF) parseWithTika(pdfBytes []byte) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "PUT",
		p.Endpoint+"/rmeta/text",
		bytes.NewReader(pdfBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/pdf")

	resp, err := p.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Tika returns HTML with content in <div> tags
	return extractTextFromHTML(string(body)), nil
}

// basicExtract attempts basic text extraction from PDF
// WARNING: This is very basic and will not work for most PDFs
func (p *ParsePDF) basicExtract(pdfBytes []byte) (string, error) {
	// Simple text extraction attempt - look for text between parentheses
	// This is just a placeholder. Real implementation needs proper PDF library.
	content := string(pdfBytes)

	// Look for actual text content patterns (very naive)
	var extracted strings.Builder
	inText := false
	var textBuffer strings.Builder

	for i := 0; i < len(content)-1; i++ {
		if i+1 < len(content) && content[i] == '(' && content[i+1] == ')' {
			// Skip empty parentheses
			i++
			continue
		}
		// Look for BT (begin text) and ET (end text) operators
		if i+2 < len(content) && content[i] == 'B' && content[i+1] == 'T' {
			inText = true
			i += 2
			continue
		}
		if i+2 < len(content) && content[i] == 'E' && content[i+1] == 'T' {
			inText = false
			if textBuffer.Len() > 0 {
				extracted.WriteString(textBuffer.String())
				extracted.WriteString(" ")
				textBuffer.Reset()
			}
			i += 2
			continue
		}
		if inText {
			textBuffer.WriteByte(content[i])
		}
	}

	result := extracted.String()
	if result == "" {
		return "", fmt.Errorf("basic extraction failed - need proper PDF library")
	}

	return result, nil
}

// extractTextFromHTML extracts text content from HTML
func extractTextFromHTML(html string) string {
	var result strings.Builder
	inTag := false
	inScript := false
	inStyle := false

	for i := 0; i < len(html); i++ {
		if i+7 < len(html) && strings.ToLower(html[i:i+7]) == "<script" {
			inScript = true
		}
		if i+8 < len(html) && strings.ToLower(html[i:i+8]) == "</script>" {
			inScript = false
			i += 7
			continue
		}
		if i+6 < len(html) && strings.ToLower(html[i:i+6]) == "<style" {
			inStyle = true
		}
		if i+7 < len(html) && strings.ToLower(html[i:i+7]) == "</style>" {
			inStyle = false
			i += 6
			continue
		}

		if inScript || inStyle {
			continue
		}

		if html[i] == '<' {
			inTag = true
			// Add space for block elements
			if i+1 < len(html) {
				nextTag := html[i+1]
				if nextTag == 'p' || nextTag == 'd' || nextTag == 'h' || nextTag == 'b' || nextTag == 'b' || nextTag == 'l' {
					if result.Len() > 0 && result.String()[result.Len()-1] != ' ' && result.String()[result.Len()-1] != '\n' {
						result.WriteString(" ")
					}
				}
			}
			continue
		}
		if html[i] == '>' {
			inTag = false
			continue
		}
		if !inTag {
			result.WriteByte(html[i])
		}
	}

	return cleanWhitespace(result.String())
}

// cleanWhitespace cleans up whitespace in extracted text
func cleanWhitespace(text string) string {
	lines := strings.Split(text, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	return strings.Join(cleaned, " \n ")
}

// ParseWord extracts text from a Word document (.docx)
func (p *ParsePDF) ParseWord(docxBytes []byte) (string, error) {
	if p.Endpoint != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		req, err := http.NewRequestWithContext(ctx, "PUT",
			p.Endpoint+"/rmeta/text",
			bytes.NewReader(docxBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document")

		resp, err := p.client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", err
		}

		return extractTextFromHTML(string(body)), nil
	}

	return "", fmt.Errorf("Word parsing requires Tika endpoint")
}
