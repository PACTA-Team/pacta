package ai

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"github.com/rsc/pdf"
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
	p, err := pdf.NewReader(bytes.NewReader(data), 0)
	if err != nil {
		return "", err
	}
	var text strings.Builder
	for i := 0; i < p.NumPage(); i++ {
		page := p.Page(i)
		text.WriteString(page.Text)
		text.WriteByte('\n')
	}
	return text.String(), nil
}
