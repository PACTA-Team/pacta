"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Trash2, RefreshCw, Eye } from "lucide-react";
import { getDocTypeLabel } from "@/lib/legal-utils";

interface LegalDocument {
  id: number;
  title: string;
  document_type: string;
  jurisdiction: string;
  chunk_count: number;
  indexed_at: string | null;
  created_at: string;
}

export function LegalDocumentList() {
  const { t } = useTranslation("settings");
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      const res = await api.get<{ documents: LegalDocument[]; count: number }>('/api/ai/legal/documents');
      setDocuments(res.documents || []);
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t('legalSettings.confirmDelete') || '')) return;
    
    try {
      await api.delete(`/api/ai/legal/documents/${id}`);
      toast.success(t('legalSettings.deleteSuccess'));
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.deleteError'));
    }
  };

  const handleReindex = async (id: number) => {
    try {
      await api.post(`/api/ai/legal/documents/${id}/reindex`);
      toast.success(t('legalSettings.reindexSuccess'));
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.reindexError'));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES');
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('legalSettings.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-2">{t('legalSettings.table.title')}</th>
              <th className="p-2">{t('legalSettings.table.type')}</th>
              <th className="p-2">{t('legalSettings.table.chunks')}</th>
              <th className="p-2">{t('legalSettings.table.indexed')}</th>
              <th className="p-2">{t('legalSettings.table.created')}</th>
              <th className="p-2 text-right">{t('legalSettings.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b hover:bg-muted/50">
                <td className="p-2 font-medium">{doc.title}</td>
                <td className="p-2">
                  <Badge variant="outline">{getDocTypeLabel(doc.document_type)}</Badge>
                </td>
                <td className="p-2 text-muted-foreground">
                  {doc.chunk_count || 0}
                </td>
                <td className="p-2">
                  {doc.indexed_at ? (
                    <Badge variant="default" className="bg-emerald-500">
                      {t('legalSettings.indexed')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {t('legalSettings.pending')}
                    </Badge>
                  )}
                </td>
                <td className="p-2 text-muted-foreground text-xs">
                  {formatDate(doc.created_at)}
                </td>
                <td className="p-2">
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReindex(doc.id)}
                      title={t('legalSettings.reindex')}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`/api/ai/legal/documents/${doc.id}/preview`, '_blank')}
                      title={t('legalSettings.preview')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                      title={t('legalSettings.delete')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {documents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t('legalSettings.noDocuments')}
          </div>
        )}
      </div>
    </div>
  );
}
