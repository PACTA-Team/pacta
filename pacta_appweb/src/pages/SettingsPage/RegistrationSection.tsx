"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { toast } from "sonner";

const REGISTRATION_SETTINGS_KEYS = ["registration_methods"];

export function RegistrationSection() {
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
          if (REGISTRATION_SETTINGS_KEYS.includes(s.key)) {
            obj[s.key] = s.value || "";
          }
        });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load registration settings");
        setLoading(false);
      });
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings)
        .filter(([key]) => REGISTRATION_SETTINGS_KEYS.includes(key))
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
        <CardTitle>{t("registrationTitle")}</CardTitle>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? t("saving") : t("save")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Registration Methods</Label>
          <Input
            value={settings.registration_methods || ""}
            onChange={(e) => handleChange("registration_methods", e.target.value)}
            placeholder="email_verification, admin_approval"
          />
          <p className="text-xs text-muted-foreground">
            {t("registrationHelp")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}