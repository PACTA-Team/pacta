"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ExternalLink } from "lucide-react";

interface SourceCitationProps {
  sources?: Array<{
    document_id: number;
    title: string;
    document_type: string;
    relevance: number;
  }>;
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [showAll, setShowAll] = useState(false);

  if (!sources || sources.length === 0) return null;

  const displaySources = showAll ? sources : sources.slice(0, 3);

  const getDocTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'law': 'Ley',
      'decree': 'Decreto',
      'decree_law': 'Decreto-Ley',
      'code': 'Código',
      'contract_template': 'Modelo',
      'jurisprudence': 'Jurisprudencia',
      'resolution': 'Resolución'
    };
    return types[type] || type;
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.8) return "bg-emerald-500";
    if (relevance >= 0.6) return "bg-yellow-500";
    return "bg-gray-400";
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Fuentes consultadas:
      </p>
      <div className="space-y-2">
        {displaySources.map((source, idx) => (
          <Card key={idx} className="border-slate-200/50">
            <CardContent className="p-3 flex items-start justify-between">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getDocTypeLabel(source.document_type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Relevancia: {(source.relevance * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm font-medium">{source.title}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(`/api/ai/legal/documents/${source.document_id}/preview`, '_blank')}
                  title="Ver documento"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
            {/* Relevance bar */}
            <div className="h-1 bg-slate-100">
              <div 
                className={`h-full ${getRelevanceColor(source.relevance)}`}
                style={{ width: `${source.relevance * 100}%` }}
              />
            </div>
          </Card>
        ))}
      </div>

      {sources.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs"
        >
          {showAll ? "Ver menos" : `Ver todas las fuentes (${sources.length})`}
        </Button>
      )}
    </div>
  );
}
