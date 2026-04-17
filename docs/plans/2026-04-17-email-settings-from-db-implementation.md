# Email Settings from Database - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admin to configure email settings (Brevo, SMTP) from UI, with toggle switches to enable/disable email features. Uses fallback to .env for backward compatibility.

**Architecture:** Add new settings to system_settings table, modify email services to check DB values with .env fallback, add UI toggles with tooltips.

**Tech Stack:** Go (backend), React/TypeScript (frontend), SQLite (database)

---

### Task 1: Create Database Migration

**Files:**
- Create: `internal/db/migrations/027_email_settings.sql`

**Step 1: Create migration file**

```sql
-- +goose Up
-- Migration: Email Settings from Database
-- Date: 2026-04-17

INSERT INTO system_settings (key, value, category) VALUES
('email_notifications_enabled', 'true', 'email'),
('email_contract_expiry_enabled', 'true', 'email'),
('smtp_enabled', 'true', 'email'),
('brevo_enabled', 'false', 'email'),
('brevo_api_key', '', 'email');

-- +goose Down
DELETE FROM system_settings WHERE category = 'email';
```

**Step 2: Run migration locally to test**

Run: `cd /home/mowgli/pacta && sqlite3 internal/db/pacta.db < internal/db/migrations/027_email_settings.sql`
Expected: Rows added to system_settings

**Step 3: Commit**

```bash
git add internal/db/migrations/027_email_settings.sql
git commit -m "feat: add email settings to system_settings table"
```

---

### Task 2: Add Settings Read Helper in Backend

**Files:**
- Modify: `internal/handlers/system_settings.go:1-67`

**Step 1: Add helper function to get single setting**

Add after existing code in handlers/system_settings.go:

```go
// GetSetting retrieves a single setting by key, returns defaultValue if not found
func (h *Handler) GetSetting(key string, defaultValue string) string {
    var value string
    err := h.DB.QueryRow("SELECT value FROM system_settings WHERE key = ?", key).Scan(&value)
    if err != nil || value == "" {
        // Fallback to environment variable
        if envValue := os.Getenv(strings.ToUpper(key)); envValue != "" {
            return envValue
        }
        return defaultValue
    }
    return value
}

// GetSettingBool retrieves a boolean setting
func (h *Handler) GetSettingBool(key string, defaultValue bool) bool {
    value := h.GetSetting(key, "")
    if value == "" {
        return defaultValue
    }
    return value == "true"
}
```

**Step 2: Verify compilation**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: Success

**Step 3: Commit**

```bash
git add internal/handlers/system_settings.go
git commit -m "feat: add GetSetting helper functions"
```

---

### Task 3: Modify sendmail.go for DB Settings

**Files:**
- Modify: `internal/email/sendmail.go:1-80`

**Step 1: Add DB check before sending**

Find the SendMail function and add check at the start:

```go
func SendMail(cfg *config.Service, to []string, subject, body string) error {
    // Check if SMTP is enabled
    if !cfg.GetBool("smtp_enabled", true) {
        fmt.Println("[email] SMTP disabled in settings, skipping")
        return nil
    }
    // ... rest of existing code
}
```

Note: This requires adding a config method or passing handler. Alternative: Read directly from DB using existing handler.

**Alternative approach (simpler):** Add DB query in sendmail.go:

```go
func SendMail(cfg *config.Service, to []string, subject, body string) error {
    // Check if SMTP is enabled - query database
    var smtpEnabled bool
    err := cfg.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'smtp_enabled'").Scan(&smtpEnabled)
    if err == nil && smtpEnabled == "false" {
        fmt.Println("[email] SMTP disabled in settings, skipping")
        return nil
    }
    // ... rest of code
}
```

**Step 2: Verify compilation**

Run: `cd /home/mowgli/pacta && go build ./internal/email/...`
Expected: Success

**Step 3: Commit**

```bash
git add internal/email/sendmail.go
git commit -m "feat: check smtp_enabled before sending emails"
```

---

### Task 4: Modify brevo.go for DB Settings

**Files:**
- Modify: `internal/email/brevo.go:1-120`

**Step 1: Add DB check and API key from DB**

Modify NewBrevoClient function:

```go
func NewBrevoClient(db *sql.DB) (*BrevoClient, error) {
    // Check if Brevo is enabled
    var brevoEnabled string
    err := db.QueryRow("SELECT value FROM system_settings WHERE key = 'brevo_enabled'").Scan(&brevoEnabled)
    if err != nil || brevoEnabled == "false" {
        return nil, fmt.Errorf("brevo disabled in settings")
    }
    
    // Get API key from DB or fallback to .env
    apiKey := os.Getenv("BREVO_API_KEY")
    var dbKey string
    err = db.QueryRow("SELECT value FROM system_settings WHERE key = 'brevo_api_key'").Scan(&dbKey)
    if err == nil && dbKey != "" {
        apiKey = dbKey
    }
    
    if apiKey == "" {
        return nil, fmt.Errorf("BREVO_API_KEY not set")
    }
    // ... rest of existing code
}
```

**Step 2: Pass DB to constructor in server.go**

Modify server.go line 168:

```go
brevoClient, err := email.NewBrevoClient(h.DB)
```

**Step 3: Verify compilation**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: Success

**Step 4: Commit**

```bash
git add internal/email/brevo.go internal/server/server.go
git commit -m "feat: read Brevo config from database with fallback"
```

---

### Task 5: Modify contract_expiry.go for Email Toggles

**Files:**
- Modify: `internal/worker/contract_expiry.go:1-250`

**Step 1: Add global and contract expiry checks**

Find the notification sending logic and add checks:

```go
func (w *ContractExpiryWorker) checkEmailEnabled() bool {
    var enabled string
    err := w.cfg.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'email_notifications_enabled'").Scan(&enabled)
    if err != nil || enabled == "false" {
        w.logger.Printf("[worker] email_notifications disabled in settings")
        return false
    }
    return true
}

func (w *ContractExpiryWorker) checkContractExpiryEnabled() bool {
    var enabled string
    err := w.cfg.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'email_contract_expiry_enabled'").Scan(&enabled)
    if err != nil || enabled == "false" {
        w.logger.Printf("[worker] contract_expiry notifications disabled in settings")
        return false
    }
    return true
}
```

**Step 2: Use checks in processNotifications**

In processNotifications or worker loop:

```go
func (w *ContractExpiryWorker) processNotifications() {
    if !w.checkEmailEnabled() {
        return // skip entirely
    }
    // ... existing code
    
    // Before sending contract expiry:
    if !w.checkContractExpiryEnabled() {
        w.logger.Printf("[worker] skipping contract expiry notifications (disabled)")
        return
    }
}
```

**Step 3: Pass DB to worker**

Modify worker creation in server.go:

```go
expiryWorker := worker.NewContractExpiryWorker(svc, brevoClient)
```

Add DB to config struct or pass separately.

**Step 4: Verify compilation**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: Success

**Step 5: Commit**

```bash
git add internal/worker/contract_expiry.go internal/server/server.go
git commit -m "feat: add email toggle checks to contract expiry worker"
```

---

### Task 6: Add Tooltips to Translations

**Files:**
- Modify: `pacta_appweb/public/locales/en/settings.json`
- Modify: `pacta_appweb/public/locales/es/settings.json`

**Step 1: Add tooltip strings**

Add to en/settings.json:

```json
{
  "email_notifications_enabled": "Enable/disable all email notifications",
  "email_contract_expiry_enabled": "Send contract expiry warnings to owners and admins",
  "smtp_enabled": "Use standard SMTP server for email delivery",
  "brevo_enabled": "Use Brevo transactional API (requires API key)",
  "brevo_api_key": "Get from: Dashboard → SMTP & APIs → API → Brevo API",
  "smtp_host": "SMTP server hostname",
  "smtp_user": "SMTP authentication username",
  "smtp_pass": "SMTP authentication password",
  "email_from": "Sender email address"
}
```

**Step 2: Add to es/settings.json (Spanish)**

```json
{
  "email_notifications_enabled": "Activar/desactivar todas las notificaciones por email",
  "email_contract_expiry_enabled": "Enviar alertas de vencimiento de contratos",
  "smtp_enabled": "Usar servidor SMTP estándar",
  "brevo_enabled": "Usar API transaccional de Brevo",
  "brevo_api_key": "Obtener en: Dashboard → SMTP & APIs → API"
}
```

**Step 3: Commit**

```bash
git add pacta_appweb/public/locales/en/settings.json pacta_appweb/public/locales/es/settings.json
git commit -m "i18n: add email settings tooltips"
```

---

### Task 7: Add Toggle Switches to SettingsPage UI

**Files:**
- Modify: `pacta_appweb/src/pages/SettingsPage.tsx:1-210`

**Step 1: Check existing UI component library for Switch**

Check if Switch component exists:

```bash
ls pacta_appweb/src/components/ui/switch* 2>/dev/null || echo "No switch found"
```

If no Switch, create it or use existing Checkbox with custom styling.

**Step 2: Add EmailSettingsTab component**

Create new file: `pacta_appweb/src/pages/SettingsPage/EmailSettingsTab.tsx`

```tsx
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
];

export function EmailSettingsTab() {
  const { t } = useTranslation("settings");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI.getAll()
      .then((data: SystemSetting[]) => {
        const filtered = data.filter(s => EMAIL_SETTINGS.includes(s.key));
        const obj: Record<string, string> = {};
        filtered.forEach(s => { obj[s.key] = s.value || ""; });
        setSettings(obj);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, checked: boolean) => {
    setSettings(prev => ({ ...prev, [key]: checked ? "true" : "false" }));
    setSaving(true);
    try {
      await settingsAPI.update([{ key, value: checked ? "true" : "false" }]);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    }
    setSaving(false);
  };

  const handleChange = async (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaving(true);
    try {
      await settingsAPI.update([{ key, value }]);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    }
    setSaving(false);
  };

  if (loading) return <div className="animate-spin h-8 w-8">...</div>;

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
              <p className="text-xs text-muted-foreground">{t("email_notifications_enabledTooltip")}</p>
            </div>
            <Switch
              checked={settings.email_notifications_enabled === "true"}
              onCheckedChange={(c) => handleToggle("email_notifications_enabled", c)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("email_contract_expiry_enabled")}</Label>
              <p className="text-xs text-muted-foreground">{t("email_contract_expiry_enabledTooltip")}</p>
            </div>
            <Switch
              checked={settings.email_contract_expiry_enabled === "true"}
              onCheckedChange={(c) => handleToggle("email_contract_expiry_enabled", c)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("smtp_enabled")}</Label>
              <p className="text-xs text-muted-foreground">{t("smtp_enabledTooltip")}</p>
            </div>
            <Switch
              checked={settings.smtp_enabled === "true"}
              onCheckedChange={(c) => handleToggle("smtp_enabled", c)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("brevo_enabled")}</Label>
              <p className="text-xs text-muted-foreground">{t("brevo_enabledTooltip")}</p>
            </div>
            <Switch
              checked={settings.brevo_enabled === "true"}
              onCheckedChange={(c) => handleToggle("brevo_enabled", c)}
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
            <p className="text-xs text-muted-foreground">{t("brevo_api_keyTooltip")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 3: Add EmailSettingsTab to SettingsPage.tsx**

Modify SettingsPage.tsx:

```tsx
import { EmailSettingsTab } from "./SettingsPage/EmailSettingsTab";

// In TabsList add:
<TabsTrigger value="email">{t("tabs.email")}</TabsTrigger>

// In TabsContent add:
<TabsContent value="email">
  <EmailSettingsTab />
</TabsContent>
```

**Step 4: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Success

**Step 5: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage/EmailSettingsTab.tsx pacta_appweb/src/pages/SettingsPage.tsx
git commit -m "feat: add email settings tab with toggles"
```

---

### Task 8: Integration Testing

**Step 1: Test all toggles work**

1. Start server with migration
2. Open Settings page
3. Toggle "Enable Email Notifications" to OFF
4. Trigger contract expiry notification
5. Verify no email sent
6. Toggle back ON
7. Verify email sent

**Step 2: Test fallback**

1. Set empty brevo_api_key in UI
2. Set BREVO_API_KEY in .env
3. Toggle Brevo ON
4. Verify uses .env value

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-04-17-email-settings-from-db-implementation.md`. Three execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

3. **Plan-to-Issues** - Convert plan tasks to GitHub issues for team distribution

**Which approach?**