import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

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

interface UseContractValidationReturn {
  result: ValidationResult | null;
  loading: boolean;
  validate: (contractText: string, contractType?: string) => Promise<void>;
  clearResult: () => void;
}

export function useContractValidation(): UseContractValidationReturn {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastRequest = useRef<AbortController | null>(null);

  const validate = useCallback((contractText: string, contractType?: string) => {
    // Clear previous debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    return new Promise<void>((resolve) => {
      debounceTimer.current = setTimeout(async () => {
        if (!contractText.trim()) {
          toast.error("El texto del contrato es requerido");
          resolve();
          return;
        }

        setLoading(true);
        setResult(null);

        // Cancel previous request
        if (lastRequest.current) {
          lastRequest.current.abort();
        }

        const controller = new AbortController();
        lastRequest.current = controller;

        try {
          const res = await api.post<ValidationResult>('/api/ai/legal/validate', {
            contract_text: contractText,
            contract_type: contractType,
          }, {
            headers: {
              signal: controller.signal,
            } as any,
          });

          if (!controller.signal.aborted) {
            setResult(res);
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            toast.error(err.message || "Error en la validación");
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
        resolve();
      }, 500); // 500ms debounce
    });
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    // Cancel any pending request
    if (lastRequest.current) {
      lastRequest.current.abort();
    }
  }, []);

  return {
    result,
    loading,
    validate,
    clearResult,
  };
}
