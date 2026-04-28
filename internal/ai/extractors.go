package ai

import (
	"bytes"
	"fmt"
	"io"

	"github.com/ledongthuc/pdf"
)

// ExtractTextFromPDF extracts plain text from PDF bytes
func ExtractTextFromPDF(r io.Reader) (string, error) {
	const maxPDFSize = 10 << 20 // 10 MB
	limited := io.LimitReader(r, maxPDFSize)
	data, err := io.ReadAll(limited)
	if err != nil {
		return "", err
	}
	if int64(len(data)) >= maxPDFSize {
		return "", fmt.Errorf("PDF exceeds 10 MB limit")
	}

	// Create PDF reader from bytes
	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}

	// Extract plain text from entire document
	textReader, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	_, err = buf.ReadFrom(textReader)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}
