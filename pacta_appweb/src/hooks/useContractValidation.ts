import { useState } from "react";
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

  const validate = async (contractText: string, contractType?: string) => {
    if (!contractText.trim()) {
      toast.error("El texto del contrato es requerido");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await api.post<ValidationResult>('/api/ai/legal/validate', {
        contract_text: contractText,
        contract_type: contractType,
      });

      setResult(res);
    } catch (err: any) {
      toast.error(err.message || "Error en la validación");
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setResult(null);
  };

  return {
    result,
    loading,
    validate,
    clearResult,
  };
}
