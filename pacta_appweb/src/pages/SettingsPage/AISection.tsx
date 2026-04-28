"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const LLM_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom Endpoint" },
];

export function AISection() {
  const { t } = useTranslation("settings");
  const [provider, setProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!provider || !apiKey) {
      toast.error(t('aiSettings.errors.provider_and_key_required'));
      return;
    }

    setLoading(true);
    try {
      const settings: SystemSetting[] = [
        { key: "ai_provider", value: provider, category: "ai" },
        { key: "ai_api_key", value: apiKey, category: "ai" },
        { key: "ai_model", value: model, category: "ai" },
      ];

      if (endpoint) {
        settings.push({ key: "ai_endpoint", value: endpoint, category: "ai" });
      }

      await settingsAPI.update(settings);
      toast.success(t('aiSettings.saveSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('aiSettings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey) {
      toast.error(t('aiSettings.errors.api_key_required'));
      return;
    }

    setTesting(true);
    try {
      const res = await api.post<{ status: string; message: string }>('/ai/test', {
        provider,
        api_key: apiKey,
        model,
        endpoint,
      });
      toast.success(res.message || t('aiSettings.connectionSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('aiSettings.connectionFailed'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('aiSettings.title')}
          <Badge variant="secondary" className="ml-2">{t('aiSettings.experimental')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('aiSettings.description')}
        </p>

        <div className="space-y-2">
          <Label>{t('aiSettings.providerLabel')}</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider..." />
            </SelectTrigger>
            <SelectContent>
              {LLM_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('aiSettings.apiKeyLabel')}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-... or gsk-..."
          />
        </div>

        <div className="space-y-2">
          <Label>{t('aiSettings.modelLabel')}</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o, llama3-70b-8192, etc."
          />
        </div>

        {provider === "custom" && (
          <div className="space-y-2">
            <Label>{t('aiSettings.endpointLabel')}</Label>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={testing || !apiKey}>
            {testing ? t('aiSettings.testing') : t('aiSettings.testConnection')}
          </Button>
          <Button onClick={handleSave} disabled={loading || !provider || !apiKey}>
            {loading ? t('aiSettings.saving') : t('aiSettings.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
