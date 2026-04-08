
// Export utilities for PDF, Excel, and CSV formats

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

// CSV Export
export const exportToCSV = (data: Record<string, any>[], columns: ExportColumn[], filename: string): void => {
  const headers = columns.map(col => col.header).join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',')
  );
  
  const csvContent = [headers, ...rows].join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

// Excel Export (using CSV format with Excel-compatible encoding)
export const exportToExcel = (data: Record<string, any>[], columns: ExportColumn[], filename: string): void => {
  const headers = columns.map(col => col.header).join('\t');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return value ?? '';
    }).join('\t')
  );
  
  const excelContent = [headers, ...rows].join('\n');
  // Add BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF';
  downloadFile(BOM + excelContent, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
};

// PDF Export (generates HTML that can be printed as PDF)
export const exportToPDF = (
  title: string,
  data: Record<string, any>[],
  columns: ExportColumn[],
  summary?: { label: string; value: string | number }[],
  chartImageBase64?: string
): void => {
  const htmlContent = generatePDFHTML(title, data, columns, summary, chartImageBase64);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

const generatePDFHTML = (
  title: string,
  data: Record<string, any>[],
  columns: ExportColumn[],
  summary?: { label: string; value: string | number }[],
  chartImageBase64?: string
): string => {
  const tableRows = data.map(row => `
    <tr>
      ${columns.map(col => `<td>${row[col.key] ?? ''}</td>`).join('')}
    </tr>
  `).join('');

  const summarySection = summary ? `
    <div class="summary">
      <h3>Summary</h3>
      <div class="summary-grid">
        ${summary.map(item => `
          <div class="summary-item">
            <span class="label">${item.label}:</span>
            <span class="value">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const chartSection = chartImageBase64 ? `
    <div class="chart-section">
      <h3>Chart</h3>
      <img src="${chartImageBase64}" alt="Report Chart" style="max-width: 100%; height: auto;" />
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        h1 {
          color: #2563eb;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
        }
        h3 {
          color: #374151;
          margin-top: 20px;
        }
        .report-info {
          margin-bottom: 20px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #2563eb;
          color: white;
        }
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .summary {
          margin-top: 30px;
          padding: 20px;
          background-color: #f3f4f6;
          border-radius: 8px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          background: white;
          border-radius: 4px;
        }
        .summary-item .label {
          font-weight: 500;
        }
        .summary-item .value {
          font-weight: bold;
          color: #2563eb;
        }
        .chart-section {
          margin-top: 30px;
          page-break-inside: avoid;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="report-info">
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Total Records: ${data.length}</p>
      </div>
      ${chartSection}
      ${summarySection}
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th>${col.header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Format helpers for reports
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};
