# System Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Agregar página de configuración del sistema en la UI para admins.

**Architecture:** Nueva tabla system_settings en BD, API endpoints, nueva página React con tabs.

**Tech Stack:** Go (backend), React + TypeScript (frontend), SQLite, go-mail

---

### Task 1: Database Migration for system_settings

**Files:**
- Create: `internal/db/migrations/026_system_settings.sql`

**Step 1: Create migration**

```sql
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    category TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value, category) VALUES
('smtp_host', '', 'smtp'),
('smtp_user', '', 'smtp'),
('smtp_pass', '', 'smtp'),
('email_from', 'PACTA <noreply@pacta.duckdns.org>', 'smtp'),
('company_name', '', 'company'),
('company_email', '', 'company'),
('company_address', '', 'company'),
('registration_methods', 'email_verification', 'registration'),
('default_language', 'en', 'general'),
('timezone', 'UTC', 'general');
```

**Step 2: Commit**

```bash
git add internal/db/migrations/026_system_settings.sql
git commit -m "db: add system_settings table"
```

---

### Task 2: Model and Handler for System Settings

**Files:**
- Modify: `internal/models/models.go`
- Create: `internal/handlers/system_settings.go`

**Step 1: Add model to models.go**

```go
type SystemSetting struct {
    ID         int        `json:"id"`
    Key        string     `json:"key"`
    Value      *string    `json:"value,omitempty"`
    Category   string     `json:"category"`
    UpdatedBy  *int       `json:"updated_by,omitempty"`
    UpdatedAt time.Time  `json:"updated_at"`
}
```

**Step 2: Create handler**

```go
package handlers

func (h *Handler) GetSystemSettings(w http.ResponseWriter, r *http.Request) {
    // Query all settings from system_settings table
    // Return JSON array
}

func (h *Handler) UpdateSystemSettings(w http.ResponseWriter, r *http.Request) {
    // Parse JSON body with settings
    // Update in database
    // Return updated settings
}
```

**Step 3: Register routes in server.go**

```go
r.HandleFunc("GET /api/system-settings", h.GetSystemSettings)
r.HandleFunc("PUT /api/system-settings", h.UpdateSystemSettings)
```

**Step 4: Commit**

```bash
git add internal/models/models.go internal/handlers/system_settings.go internal/server/server.go
git commit -m "feat: add system settings API endpoints"
```

---

### Task 3: Frontend API Client

**Files:**
- Create: `pacta_appweb/src/lib/settings-api.ts`
- Modify: `pacta_appweb/src/types/index.ts`

**Step 1: Add types**

```typescript
export interface SystemSetting {
  id: number;
  key: string;
  value?: string;
  category: string;
}
```

**Step 2: Create API client**

```typescript
import { authFetch } from './auth-fetch';

export const settingsAPI = {
  async getAll(): Promise<SystemSetting[]> {
    const res = await authFetch('/api/system-settings');
    return res.json();
  },
  async update(settings: Partial<SystemSetting>[]): Promise<SystemSetting[]> {
    const res = await authFetch('/api/system-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return res.json();
  },
};
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/lib/settings-api.ts pacta_appweb/src/types/index.ts
git commit -m "feat: add settings API client"
```

---

### Task 4: Settings Page Component

**Files:**
- Create: `pacta_appweb/src/pages/SettingsPage.tsx`

**Step 1: Create page with tabs**

```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { settingsAPI } from '@/lib/settings-api';
import { toast } from 'sonner';

const CATEGORIES = ['smtp', 'company', 'registration', 'general'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI.getAll().then(data => {
      const obj: Record<string, string> = {};
      data.forEach((s: any) => { obj[s.key] = s.value || ''; });
      setSettings(obj);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await settingsAPI.update(updates);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1>System Settings</h1>
      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="registration">Registro</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        
        <TabsContent value="smtp">
          <Card>
            <CardHeader><CardTitle>Configuración SMTP</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="SMTP Host" value={settings.smtp_host} onChange={e => setSettings({...settings, smtp_host: e.target.value})} />
              <Input label="SMTP User" value={settings.smtp_user} onChange={e => setSettings({...settings, smtp_user: e.target.value})} />
              <Input label="SMTP Password" type="password" value={settings.smtp_pass} onChange={e => setSettings({...settings, smtp_pass: e.target.value})} />
              <Input label="Email From" value={settings.email_from} onChange={e => setSettings({...settings, email_from: e.target.value})} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>Datos de la Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Company Name" value={settings.company_name} onChange={e => setSettings({...settings, company_name: e.target.value})} />
              <Input label="Company Email" value={settings.company_email} onChange={e => setSettings({...settings, company_email: e.target.value})} />
              <Input label="Company Address" value={settings.company_address} onChange={e => setSettings({...settings, company_address: e.target.value})} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registration">
          <Card>
            <CardHeader><CardTitle>Opciones de Registro</CardTitle></CardHeader>
            <CardContent>
              <Input label="Registration Methods" value={settings.registration_methods} onChange={e => setSettings({...settings, registration_methods: e.target.value})} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>Configuración General</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Default Language" value={settings.default_language} onChange={e => setSettings({...settings, default_language: e.target.value})} />
              <Input label="Timezone" value={settings.timezone} onChange={e => setSettings({...settings, timezone: e.target.value})} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/SettingsPage.tsx
git commit -m "feat: add system settings page"
```

---

### Task 5: Add to Navigation

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx`

**Step 1: Add settings to navigation array**

```tsx
import { Settings } from 'lucide-react';

const navigation = [
  // ... existing items
  { nameKey: 'settings', href: '/settings', icon: Settings, roles: ['admin'] as UserRole[] },
];
```

**Step 2: Add label translation**

```tsx
const navLabels = {
  // ...
  settings: tSettings('title'),
};
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/layout/AppSidebar.tsx
git commit -m "feat: add settings to admin navigation"
```

---

### Task 6: Add Routes

**Files:**
- Modify: `pacta_appweb/src/App.tsx`

**Step 1: Add route**

```tsx
import SettingsPage from './pages/SettingsPage';

<Route path="/settings" element={<SettingsPage />} />
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/App.tsx
git commit -m "feat: add settings route"
```

---

### Task 7: Add Translations

**Files:**
- Modify: `pacta_appweb/src/locales/en/translation.json`

**Step 1: Add keys**

```json
{
  "settings": {
    "title": "Settings"
  }
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/locales/en/translation.json
git commit -m "i18n: add settings translations"
```

---

## Summary

**7 tasks** to implement complete system settings feature.

**Execution Option: Subagent-Driven (this session)**

 REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development