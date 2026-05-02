"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Check } from "lucide-react";

interface ValidationResult {
  contract_type?: string;
  analysis?: string;
  status?: string;
  risks?: Array<{
    clause: string;
    risk: "high" | "medium" | "low";
    suggestion: string;
  }>;
  missing_clauses?: string[];
  overall_risk?: string;
}

interface ValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result?: ValidationResult | null;
  loading?: boolean;
  onApplySuggestion?: (suggestion: string, clause: string) => void;
  onApplyAll?: () => void;
}

export function ValidationModal({ 
  open, 
  onOpenChange, 
  result, 
  loading, 
  onApplySuggestion, 
  onApplyAll 
}: ValidationModalProps) {
  const { t } = useTranslation("legal");

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "high": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "low": return <Info className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('validation.title') || "Validación Legal"}
          </DialogTitle>
          <DialogDescription>
            {t('validation.description') || "Análisis de riesgos bajo la ley cubana"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">
                {t('validation.analyzing') || "Analizando contrato..."}
              </p>
            </div>
          )}

          {!loading && result && (
            <>
              {/* Overall Risk */}
              {result.overall_risk && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      result.overall_risk === 'high' ? "bg-red-100" :
                      result.overall_risk === 'medium' ? "bg-yellow-100" : "bg-green-100"
                    }`}>
                      {getRiskIcon(result.overall_risk)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {t('validation.overallRisk') || "Riesgo General"}: {' '}
                        <Badge variant={getRiskColor(result.overall_risk)}>
                          {result.overall_risk?.toUpperCase()}
                        </Badge>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Risks */}
              {result.risks && result.risks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {t('validation.risksDetected') || "Riesgos Detectados"}
                  </h4>
                  {result.risks.map((risk, idx) => (
                    <Card key={idx} className={`border-l-4 ${
                      risk.risk === 'high' ? "border-l-red-500" :
                      risk.risk === 'medium' ? "border-l-yellow-500" : "border-l-blue-500"
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {getRiskIcon(risk.risk)}
                              <Badge variant={getRiskColor(risk.risk)}>
                                {risk.risk?.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium">{risk.clause}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {risk.suggestion}
                            </p>
                          </div>
                          {onApplySuggestion && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onApplySuggestion(risk.suggestion, risk.clause)}
                            >
                              {t('validation.apply') || "Aplicar"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Missing Clauses */}
              {result.missing_clauses && result.missing_clauses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {t('validation.missingClauses') || "Cláusulas Faltantes"}
                  </h4>
                  <Card>
                    <CardContent className="p-4">
                      <ul className="space-y-1">
                        {result.missing_clauses.map((clause, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <Check className="h-3 w-3 text-green-500" />
                            {clause}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Analysis Text */}
              {result.analysis && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2">
                      {t('validation.fullAnalysis') || "Análisis Completo"}
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {result.analysis}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {onApplyAll && (
                  <Button onClick={onApplyAll}>
                    {t('validation.applyAll') || "Aplicar Todas"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t('validation.close') || "Cerrar"}
                </Button>
              </div>
            </>
          )}

          {!loading && !result && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('validation.noResults') || "No hay resultados de validación"}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
