"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { toast } from "sonner";

const COMPANY_SETTINGS_KEYS = ["company_name", "company_email", "company_address"];

export function CompanySection() {
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
          if (COMPANY_SETTINGS_KEYS.includes(s.key)) {
            obj[s.key] = s.value || "";
          }
        });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load company settings");
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
        .filter(([key]) => COMPANY_SETTINGS_KEYS.includes(key))
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
        <CardTitle>{t("companyTitle")}</CardTitle>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? t("saving") : t("save")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input
              value={settings.company_name || ""}
              onChange={(e) => handleChange("company_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Company Email</Label>
            <Input
              type="email"
              value={settings.company_email || ""}
              onChange={(e) => handleChange("company_email", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Company Address</Label>
          <Input
            value={settings.company_address || ""}
            onChange={(e) => handleChange("company_address", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}