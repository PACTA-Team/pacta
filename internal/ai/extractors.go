package ai

import (
	"bytes"
	"io"
	"strings"
	"github.com/rsc/pdf"
)

// ExtractTextFromPDF extracts plain text from PDF bytes
func ExtractTextFromPDF(r io.Reader) (string, error) {
	// Read all bytes because rsc/pdf requires a seekable reader
	data, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}
	p, err := pdf.NewReader(bytes.NewReader(data), 0)
	if err != nil {
		return "", err
	}
	var text strings.Builder
	for i := 0; i < p.NumPage(); i++ {
		page, err := p.Page(i)
		if err != nil {
			// Skip pages that fail; log later
			continue
		}
		text.WriteString(page.Text)
		text.WriteByte('\n')
	}
	return text.String(), nil
}
