"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { BarChart3, Database, Clock, FileText } from "lucide-react";

interface LegalStats {
  enabled: boolean;
  integration: boolean;
  document_count: number;
  embedding_model: string;
  status: string;
  last_update?: string;
}

export function LegalStats() {
  const { t } = useTranslation("settings");
  const [stats, setStats] = useState<LegalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get<LegalStats>('/api/ai/legal/status');
      setStats(res);
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('legalSettings.loading')}
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('legalSettings.statistics')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('legalSettings.systemStatus')}</span>
          </div>
          <Badge variant={stats.status === 'operational' ? "default" : "destructive"}>
            {stats.status}
          </Badge>
        </div>

        {/* Document Count */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('legalSettings.indexedDocuments')}</span>
          </div>
          <Badge variant="secondary">
            {stats.document_count || 0}
          </Badge>
        </div>

        {/* Embedding Model */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('legalSettings.embeddingModel')}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {stats.embedding_model || 'all-minilm-l6-v2'}
          </span>
        </div>

        {/* Last Update - Placeholder */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('legalSettings.lastUpdate')}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {stats.last_update ? new Date(stats.last_update).toLocaleDateString('es-ES') : '-'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
