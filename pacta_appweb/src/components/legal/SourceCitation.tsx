"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Source } from "@/lib/legal-utils";

interface SourceCitationProps {
  sources?: Source[];
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
      <div className="flex flex-wrap gap-2">
        {displaySources.map((source, idx) => (
          <HoverCard key={idx} openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-slate-100 px-2 py-1 text-xs"
              >
                {source.title} ({((source.relevance ?? 0) * 100).toFixed(0)}%)
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {getDocTypeLabel(source.document_type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Relevancia: {((source.relevance ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <h4 className="text-sm font-medium leading-tight">
                  {source.chunk_title || source.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-8">
                  {source.content_snippet || "No hay snippet disponible."}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
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
