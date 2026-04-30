"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LegalDocumentList } from "@/components/legal/LegalDocumentList";
import { LegalDocumentUpload } from "@/components/legal/LegalDocumentUpload";
import { LegalStats } from "@/components/legal/LegalStats";
import { settingsAPI } from "@/lib/settings-api";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function LegalSection() {
  const { t } = useTranslation(["settings", "legal"]);
  const [enabled, setEnabled] = useState(false);
  const [integration, setIntegration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await settingsAPI.getAll();
      setEnabled(settings.ai_legal_enabled === 'true');
      setIntegration(settings.ai_legal_integration === 'true');
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.loadError'));
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    setEnabled(checked);
    setLoading(true);
    try {
      await settingsAPI.update([
        { key: "ai_legal_enabled", value: checked ? "true" : "false" }
      ]);
      toast.success(t('legalSettings.toggleSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.saveError'));
      setEnabled(!checked); // Revert
    } finally {
      setLoading(false);
    }
  };

  const handleToggleIntegration = async (checked: boolean) => {
    setIntegration(checked);
    setLoading(true);
    try {
      await settingsAPI.update([
        { key: "ai_legal_integration", value: checked ? "true" : "false" }
      ]);
      toast.success(t('legalSettings.toggleSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('legalSettings.saveError'));
      setIntegration(!checked); // Revert
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    toast.success(t('legalSettings.uploadSuccess'));
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('legalSettings.title')}
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? t('legalSettings.enabled') : t('legalSettings.disabled')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('legalSettings.description')}
          </p>

          {/* Toggle: Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('legalSettings.enableLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('legalSettings.enableDescription')}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={loading}
            />
          </div>

          {/* Toggle: Integration in forms */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('legalSettings.integrationLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('legalSettings.integrationDescription')}
              </p>
            </div>
            <Switch
              checked={integration}
              onCheckedChange={handleToggleIntegration}
              disabled={loading || !enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <LegalStats />

      {/* Document Management Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('legalSettings.documentManagement')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t('legalSettings.documentsDescription')}
            </p>
            <Dialog open={showUpload} onOpenChange={setShowUpload}>
              <DialogTrigger asChild>
                <Button size="sm">
                  {t('legalSettings.uploadDocument')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('legalSettings.uploadDocument')}</DialogTitle>
                </DialogHeader>
                <LegalDocumentUpload onSuccess={handleUploadSuccess} />
              </DialogContent>
            </Dialog>
          </div>

          <LegalDocumentList />
        </CardContent>
      </Card>
    </div>
  );
}
