"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { toast } from "sonner";

const EMAIL_SETTINGS = [
  "email_notifications_enabled",
  "email_contract_expiry_enabled",
  "smtp_enabled",
  "brevo_enabled",
  "brevo_api_key",
  "email_verification_required",
];

export function EmailSettingsTab() {
  const { t } = useTranslation("settings");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI
      .getAll()
      .then((data: SystemSetting[]) => {
        const filtered = data.filter((s) => EMAIL_SETTINGS.includes(s.key));
        const obj: Record<string, string> = {};
        filtered.forEach((s) => {
          obj[s.key] = s.value || "";
        });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleToggle = async (key: string, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: checked ? "true" : "false" }));
    setSaving(true);
    try {
      await settingsAPI.update([{ key, value: checked ? "true" : "false" }]);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
      // Revert on error
      setSettings((prev) => ({
        ...prev,
        [key]: settings[key] || "false",
      }));
    }
    setSaving(false);
  };

  const handleChange = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaving(true);
    try {
      await settingsAPI.update([{ key, value }]);
      toast.success(t("saveSuccess"));
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
      <CardHeader>
        <CardTitle>{t("emailServicesTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("email_notifications_enabled")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("email_notifications_enabledTooltip")}
              </p>
            </div>
            <Switch
              checked={settings.email_notifications_enabled === "true"}
              onCheckedChange={(checked) =>
                handleToggle("email_notifications_enabled", checked)
              }
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("email_contract_expiry_enabled")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("email_contract_expiry_enabledTooltip")}
              </p>
            </div>
            <Switch
              checked={settings.email_contract_expiry_enabled === "true"}
              onCheckedChange={(checked) =>
                handleToggle("email_contract_expiry_enabled", checked)
              }
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("smtp_enabled")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("smtp_enabledTooltip")}
              </p>
            </div>
            <Switch
              checked={settings.smtp_enabled === "true"}
              onCheckedChange={(checked) => handleToggle("smtp_enabled", checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("brevo_enabled")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("brevo_enabledTooltip")}
              </p>
            </div>
            <Switch
              checked={settings.brevo_enabled === "true"}
              onCheckedChange={(checked) => handleToggle("brevo_enabled", checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("email_verification_required")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("email_verification_requiredTooltip")}
              </p>
            </div>
            <Switch
              checked={settings.email_verification_required === "true"}
              onCheckedChange={(checked) =>
                handleToggle("email_verification_required", checked)
              }
              disabled={saving}
            />
          </div>
        </div>

        {/* Brevo API Key Field */}
        {settings.brevo_enabled === "true" && (
          <div className="space-y-2">
            <Label>{t("brevo_api_key")}</Label>
            <Input
              type="password"
              value={settings.brevo_api_key || ""}
              onChange={(e) => handleChange("brevo_api_key", e.target.value)}
              placeholder={t("brevo_api_keyPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("brevo_api_keyTooltip")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}