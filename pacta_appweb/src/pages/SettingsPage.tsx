"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { toast } from "sonner";
import { NotificationsTab } from "./SettingsPage/NotificationsTab";
import { EmailSettingsTab } from "./SettingsPage/EmailSettingsTab";

const SETTINGS_BY_CATEGORY: Record<string, string[]> = {
  smtp: ["smtp_host", "smtp_user", "smtp_pass", "email_from"],
  company: ["company_name", "company_email", "company_address"],
  registration: ["registration_methods"],
  general: ["default_language", "timezone"],
};

const LABELS: Record<string, Record<string, string>> = {
  smtp: {
    smtp_host: "SMTP Host",
    smtp_user: "SMTP User",
    smtp_pass: "SMTP Password",
    email_from: "Email From",
  },
  company: {
    company_name: "Company Name",
    company_email: "Company Email",
    company_address: "Company Address",
  },
  registration: {
    registration_methods: "Registration Methods",
  },
  general: {
    default_language: "Default Language",
    timezone: "Timezone",
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation("settings");

  useEffect(() => {
    settingsAPI
      .getAll()
      .then((data) => {
        const obj: Record<string, string> = {};
        data.forEach((s: SystemSetting) => {
          obj[s.key] = s.value || "";
        });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load settings");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
      }));
      await settingsAPI.update(updates);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    }
    setSaving(false);
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

       <Tabs defaultValue="smtp">
<TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="smtp">{t("tabs.smtp")}</TabsTrigger>
            <TabsTrigger value="company">{t("tabs.company")}</TabsTrigger>
            <TabsTrigger value="registration">{t("tabs.registration")}</TabsTrigger>
            <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
            <TabsTrigger value="notifications">{t("tabs.notifications")}</TabsTrigger>
            <TabsTrigger value="email">{t("tabs.email")}</TabsTrigger>
          </TabsList>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle>{t("smtpTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SETTINGS_BY_CATEGORY.smtp.map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{LABELS.smtp[key]}</Label>
                  <Input
                    id={key}
                    type={key === "smtp_pass" ? "password" : "text"}
                    value={settings[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={LABELS.smtp[key]}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>{t("companyTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SETTINGS_BY_CATEGORY.company.map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{LABELS.company[key]}</Label>
                  <Input
                    id={key}
                    type="text"
                    value={settings[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={LABELS.company[key]}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registration">
          <Card>
            <CardHeader>
              <CardTitle>{t("registrationTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="registration_methods">
                  {LABELS.registration.registration_methods}
                </Label>
                <Input
                  id="registration_methods"
                  type="text"
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
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t("generalTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SETTINGS_BY_CATEGORY.general.map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{LABELS.general[key]}</Label>
                  <Input
                    id={key}
                    type="text"
                    value={settings[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={LABELS.general[key]}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
         </TabsContent>

<TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="email">
            <EmailSettingsTab />
          </TabsContent>
        </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}