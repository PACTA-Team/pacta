package reports

import (
	"bytes"
	"fmt"
	"time"

	"github.com/phpdave11/gofpdf"
)

type Contract struct {
	ContractNumber string
	ClientName    string
	Status         string
	ExpiryDate    time.Time
}

// GenerateContractsPDF generates a PDF with contract data
// Returns []byte containing the PDF data
func GenerateContractsPDF(contracts []Contract) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(190, 10, "Reporte de Contratos")
	pdf.Ln(10)

	// Date
	pdf.SetFont("Arial", "I", 10)
	pdf.Cell(190, 10, fmt.Sprintf("Fecha: %s", time.Now().Format("2006-01-02 15:04")))
	pdf.Ln(15)

	// Table header
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(40, 7, "Número", "1", 0, "C", false, 0, "")
	pdf.CellFormat(60, 7, "Cliente", "1", 0, "C", false, 0, "")
	pdf.CellFormat(30, 7, "Estado", "1", 0, "C", false, 0, "")
	pdf.CellFormat(30, 7, "Vencimiento", "1", 0, "C", false, 0, "")
	pdf.Ln(-1)

	// Table rows
	pdf.SetFont("Arial", "", 9)
	for _, c := range contracts {
		pdf.CellFormat(40, 7, c.ContractNumber, "1", 0, "L", false, 0, "")
		pdf.CellFormat(60, 7, c.ClientName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(30, 7, c.Status, "1", 0, "L", false, 0, "")
		pdf.CellFormat(30, 7, c.ExpiryDate.Format("2006-01-02"), "1", 0, "L", false, 0, "")
		pdf.Ln(-1)
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}
	return buf.Bytes(), nil
}
