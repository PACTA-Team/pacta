

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react';

interface ExportButtonsProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  disabled?: boolean;
}

export default function ExportButtons({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  disabled = false,
}: ExportButtonsProps) {
  const { t } = useTranslation('reports');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          {t('export.title')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportPDF}>
          <FileText className="mr-2 h-4 w-4 text-red-500" />
          {t('export.pdf')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4 text-green-500" />
          {t('export.excel')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCSV}>
          <File className="mr-2 h-4 w-4 text-blue-500" />
          {t('export.csv')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
