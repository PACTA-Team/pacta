# Settings Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rediseñar la página de configuración para que cada sesión sea una página completa con tabs horizontales y botón guardar por sesión.

**Architecture:** Crear componentes independientes por sección, cada uno manejando su propio estado y guardado. Mantener tabs horizontales en la parte superior y añadir un botón de guardar dedicado por cada sección.

**Tech Stack:** React, TypeScript, shadcn/ui components, i18next

---

## Task 1: Crear componente EmailSection

**Files:**
- Create: `pacta_appweb/src/pages/SettingsPage/EmailSection.tsx`

**Step 1: Crear componente EmailSection con su propio estado y guardado**

```tsx
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
        {/* SMTP Toggle */}
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

        {/* Brevo Toggle */}
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
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage/EmailSection.tsx
git commit -m "feat(settings): add EmailSection component with own save button"
```

---

## Task 2: Crear componente CompanySection

**Files:**
- Create: `pacta_appweb/src/pages/SettingsPage/CompanySection.tsx`

**Step 1: Crear componente CompanySection**

```tsx
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
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage/CompanySection.tsx
git commit -m "feat(settings): add CompanySection component"
```

---

## Task 3: Crear componente RegistrationSection

**Files:**
- Create: `pacta_appweb/src/pages/SettingsPage/RegistrationSection.tsx`

**Step 1: Crear componente RegistrationSection**

```tsx
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
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage/RegistrationSection.tsx
git commit -m "feat(settings): add RegistrationSection component"
```

---

## Task 4: Crear componente GeneralSection

**Files:**
- Create: `pacta_appweb/src/pages/SettingsPage/GeneralSection.tsx`

**Step 1: Crear componente GeneralSection**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { settingsAPI, SystemSetting } from "@/lib/settings-api";
import { toast } from "sonner";

const GENERAL_SETTINGS_KEYS = ["default_language", "timezone"];

export function GeneralSection() {
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
          if (GENERAL_SETTINGS_KEYS.includes(s.key)) {
            obj[s.key] = s.value || "";
          }
        });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load general settings");
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
        .filter(([key]) => GENERAL_SETTINGS_KEYS.includes(key))
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
        <CardTitle>{t("generalTitle")}</CardTitle>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? t("saving") : t("save")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Language</Label>
            <Input
              value={settings.default_language || ""}
              onChange={(e) => handleChange("default_language", e.target.value)}
              placeholder="en"
            />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input
              value={settings.timezone || ""}
              onChange={(e) => handleChange("timezone", e.target.value)}
              placeholder="UTC"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage/GeneralSection.tsx
git commit -m "feat(settings): add GeneralSection component"
```

---

## Task 5: Actualizar SettingsPage.tsx para usar los nuevos componentes

**Files:**
- Modify: `pacta_appweb/src/pages/SettingsPage.tsx`

**Step 1: Reemplazar el contenido del archivo**

```tsx
"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailSection } from "./SettingsPage/EmailSection";
import { CompanySection } from "./SettingsPage/CompanySection";
import { RegistrationSection } from "./SettingsPage/RegistrationSection";
import { GeneralSection } from "./SettingsPage/GeneralSection";
import { NotificationsTab } from "./SettingsPage/NotificationsTab";
import { EmailSettingsTab } from "./SettingsPage/EmailSettingsTab";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const [activeTab, setActiveTab] = useState("email");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto gap-1">
          <TabsTrigger value="email" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.email")}
          </TabsTrigger>
          <TabsTrigger value="company" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.company")}
          </TabsTrigger>
          <TabsTrigger value="registration" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.registration")}
          </TabsTrigger>
          <TabsTrigger value="general" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.general")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.notifications")}
          </TabsTrigger>
          <TabsTrigger value="emailSettings" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.email")}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="email">
            <EmailSection />
          </TabsContent>

          <TabsContent value="company">
            <CompanySection />
          </TabsContent>

          <TabsContent value="registration">
            <RegistrationSection />
          </TabsContent>

          <TabsContent value="general">
            <GeneralSection />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="emailSettings">
            <EmailSettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage.tsx
git commit -m "refactor(settings): update SettingsPage to use new section components"
```

---

## Task 6: Verificar en CI que compila

**Step 1: Push y verificar CI**

```bash
git push origin HEAD
```

Expected: GitHub Actions ejecuta `go build` y `npm run build` exitosamente.

---

## Plan complete

**Dos opciones de ejecución:**

**1. Subagent-Driven (esta sesión)** - Dispatches un subagent fresco por tarea, revisa entre tareas

**2. Parallel Session (sesión separada)** - Abrir nueva sesión con executing-plans

¿Cuál prefieres?