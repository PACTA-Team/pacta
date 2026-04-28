"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
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
      toast.error("Provider and API Key are required");
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
      toast.success("AI settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey) {
      toast.error("API Key is required for testing");
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey, model, endpoint }),
      });

      if (res.ok) {
        toast.success("Connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Connection failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Themis AI
          <Badge variant="secondary" className="ml-2">Experimental</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure the LLM provider for AI-assisted contract generation and review.
          Your API key will be encrypted before storage.
        </p>

        <div className="space-y-2">
          <Label>LLM Provider</Label>
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
          <Label>API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-... or gsk-..."
          />
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o, llama3-70b-8192, etc."
          />
        </div>

        {provider === "custom" && (
          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={testing || !apiKey}>
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={handleSave} disabled={loading || !provider || !apiKey}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
