"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { toast } from "sonner";

const EMAIL_SETTINGS_KEYS = [
  "smtp_host",
  "smtp_user",
  "smtp_pass",
  "email_from",
  "smtp_enabled",
  "brevo_enabled",
  "brevo_api_key",
  "brevo_list_id",
];

export function EmailSection() {
  const { t } = useTranslation("settings");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    settingsAPI
      .getAll()
      .then((data) => {
        const obj: Record<string, string> = {};
        data.forEach((s: SystemSetting) => {
          if (EMAIL_SETTINGS_KEYS.includes(s.key)) {
            obj[s.key] = s.value || "";
          }
        });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load email settings");
        setLoading(false);
      });
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleToggle = async (key: string, checked: boolean) => {
    const newValue = checked ? "true" : "false";
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    setHasChanges(true);

    try {
      await settingsAPI.update([{ key, value: newValue }]);
      toast.success(t("saveSuccess"));
      setHasChanges(false);
    } catch {
      toast.error(t("saveError"));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings)
        .filter(([key]) => EMAIL_SETTINGS_KEYS.includes(key))
        .map(([key, value]) => ({ key, value }));
      await settingsAPI.update(updates);
      toast.success(t("saveSuccess"));
      setHasChanges(false);
    } catch {
      toast.error(t("saveError"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("smtpTitle")}</CardTitle>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? t("saving") : t("save")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label>SMTP</Label>
          <Switch
            checked={settings.smtp_enabled === "true"}
            onCheckedChange={(checked) => handleToggle("smtp_enabled", checked)}
          />
        </div>

        {settings.smtp_enabled === "true" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={settings.smtp_host || ""}
                onChange={(e) => handleChange("smtp_host", e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP User</Label>
              <Input
                value={settings.smtp_user || ""}
                onChange={(e) => handleChange("smtp_user", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password</Label>
              <Input
                type="password"
                value={settings.smtp_pass || ""}
                onChange={(e) => handleChange("smtp_pass", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email From</Label>
              <Input
                value={settings.email_from || ""}
                onChange={(e) => handleChange("email_from", e.target.value)}
                placeholder="noreply@example.com"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <Label>Brevo</Label>
          <Switch
            checked={settings.brevo_enabled === "true"}
            onCheckedChange={(checked) => handleToggle("brevo_enabled", checked)}
          />
        </div>

        {settings.brevo_enabled === "true" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Brevo API Key</Label>
              <Input
                type="password"
                value={settings.brevo_api_key || ""}
                onChange={(e) => handleChange("brevo_api_key", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Brevo List ID</Label>
              <Input
                value={settings.brevo_list_id || ""}
                onChange={(e) => handleChange("brevo_list_id", e.target.value)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}