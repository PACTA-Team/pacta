"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { aiAPI, GenerateContractRequest } from "@/lib/ai-api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ContractAIFormProps {
  onClose: () => void;
  onSuccess: (generatedText: string) => void;
}

export function ContractAIForm({ onClose, onSuccess }: ContractAIFormProps) {
  const { t } = useTranslation('contracts');
  const [contractType, setContractType] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");

  const handleGenerate = async () => {
    if (!contractType || !amount || !startDate || !endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setGenerating(true);
    try {
      const req: GenerateContractRequest = {
        contract_type: contractType,
        amount: parseFloat(amount),
        start_date: startDate,
        end_date: endDate,
        client_id: parseInt(clientId) || 0,
        supplier_id: parseInt(supplierId) || 0,
        description,
      };

      const res = await aiAPI.generateContract(req);
      setGeneratedText(res.text);
      toast.success("Draft generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate contract");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Generate Contract with Themis AI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Contract Type *</Label>
            <Input value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="e.g., services, sales, NDA" />
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End Date *</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the contract purpose and terms..."
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {generating ? "Generating..." : "Generate Draft with AI"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>

        {generatedText && (
          <div className="space-y-2">
            <Label>Generated Contract</Label>
            <Textarea 
              value={generatedText} 
              onChange={(e) => setGeneratedText(e.target.value)}
              className="min-h-[300px]"
            />
            <Button onClick={() => onSuccess(generatedText)}>
              Accept and Create Contract
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
