export interface Source {
  title: string;
  document_type: string;
  chunk_title?: string;
  content_snippet?: string;
  relevance?: number;
  source?: string;
}

export const DOCUMENT_TYPES = [
  { value: "law", label: "Ley" },
  { value: "decree", label: "Decreto" },
  { value: "decree_law", label: "Decreto-Ley" },
  { value: "code", label: "Código" },
  { value: "contract_template", label: "Modelo de Contrato" },
  { value: "jurisprudence", label: "Jurisprudencia" },
  { value: "resolution", label: "Resolución" },
];

export function getDocTypeLabel(type: string): string {
  const found = DOCUMENT_TYPES.find(dt => dt.value === type);
  return found ? found.label : type;
}
