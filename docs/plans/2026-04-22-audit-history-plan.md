# Historial de Auditoría - Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Agregar sistema de auditoría completo que registra todas las acciones del usuario en la plataforma, con resumen de últimos 10 logs en perfil y historial completo en página dedicada.

**Architecture:** Reutilizar tabla `audit_logs` existente, crear función helper `InsertAuditLog` en backend, agregar registro en cada handler de creación, crear API wrapper en frontend, agregar bloque en perfil y nueva página de historial completo.

**Tech Stack:** Go (chi router), React, TypeScript, SQLite

---

## Fase 1: Backend

### Task 1: Crear función InsertAuditLog

**Files:**
- Modify: `internal/handlers/audit_logs.go:1-77`

**Step 1: Agregar función InsertAuditLog al archivo audit_logs.go**

```go
func (h *Handler) InsertAuditLog(userID int, action, entityType string, entityID *int, prevState, newState *string, r *http.Request) {
    ip := ""
    if r != nil {
        ip = r.RemoteAddr
    }
    _, err := h.DB.Exec(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `, userID, action, entityType, entityID, prevState, newState, ip, h.companyID)
    if err != nil {
        log.Printf("[audit] ERROR inserting log: %v", err)
    }
}
```

**Step 2: Agregar método InsertAuditLog con acceso a company_id**

Necesito modificar para que InsertAuditLog pueda recibir company_id o usarlo del handler.

**Step 3: Commit**

```bash
git add internal/handlers/audit_logs.go
git commit -m "feat(audit): add InsertAuditLog helper function"
```

---

### Task 2: Registrar LOGIN en HandleLogin

**Files:**
- Modify: `internal/handlers/auth.go:253-268`

**Step 1: Agregar registro de auditoría después de CreateSession**

Localizar en `internal/handlers/auth.go` la línea después de:
```go
session, err := auth.CreateSession(h.DB, user.ID, companyID)
```

Agregar:
```go
// Registrar login en auditoría
h.InsertAuditLog(user.ID, "LOGIN", "session", nil, nil, nil, r)
```

**Step 2: Commit**

```bash
git add internal/handlers/auth.go
git commit -m "feat(audit): log LOGIN action on user login"
```

---

### Task 3: Registrar CREATE usuario

**Files:**
- Modify: `internal/handlers/users.go`

**Step 1: Encontrar HandleCreateUser y agregar InsertAuditLog después de crear usuario**

Buscar función HandleCreateUser en `internal/handlers/users.go` y agregar después de INSERT exitoso.

**Step 2: Encontrar HandleUpdateUser y agregar InsertAuditLog después de actualizar**

**Step 3: Commit**

```bash
git add internal/handlers/users.go
git commit -m "feat(audit): log CREATE/UPDATE user actions"
```

---

### Task 4: Registrar CREATE empresa

**Files:**
- Modify: `internal/handlers/companies.go`

**Step 1: Agregar InsertAuditLog en handleCreateCompany después de INSERT exitoso**

**Step 2: Commit**

```bash
git add internal/handlers/companies.go
git commit -m "feat(audit): log CREATE company action"
```

---

### Task 5: Registrar CREATE cliente, proveedor, contrato, suplemento

**Files:**
- Modify: `internal/handlers/clients.go`
- Modify: `internal/handlers/suppliers.go`
- Modify: `internal/handlers/contracts.go`
- Modify: `internal/handlers/supplements.go`

**Step 1: Agregar InsertAuditLog en cada handler después de creación exitosa**

**Step 2: Commit**

```bash
git add internal/handlers/clients.go internal/handlers/suppliers.go internal/handlers/contracts.go internal/handlers/supplements.go
git commit -m "feat(audit): log CREATE actions for clients, suppliers, contracts, supplements"
```

---

## Fase 2: Frontend

### Task 6: Crear API wrapper audit-api.ts

**Files:**
- Create: `pacta_appweb/src/lib/audit-api.ts`

**Step 1: Crear archivo con función getAuditLogs**

```typescript
export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  previous_state: string | null;
  new_state: string | null;
  ip_address: string | null;
  created_at: string;
}

export async function getAuditLogs(userId: number, params?: {
  limit?: number;
  offset?: number;
  entityType?: string;
  action?: string;
}): Promise<AuditLog[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("user_id", userId.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.entityType) searchParams.set("entity_type", params.entityType);
  if (params?.action) searchParams.set("action", params.action);
  
  const res = await fetch(`/api/audit-logs?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/audit-api.ts
git commit -m "feat(audit): add audit-api TypeScript wrapper"
```

---

### Task 7: Agregar bloque de historial en ProfileSection

**Files:**
- Modify: `pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx`

**Step 1: Importar getAuditLogs en ProfileSection.tsx**

```typescript
import { getAuditLogs } from "@/lib/audit-api";
```

**Step 2: Agregar estado para activityLogs**

```typescript
const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
```

**Step 3: Cargar logs en useEffect**

```typescript
useEffect(() => {
  profileAPI.getProfile().then((data) => {
    setProfile(data);
    setName(data.name);
    setEmail(data.email);
    setLoading(false);
    // Cargar últimos 10 logs del usuario
    getAuditLogs(data.id, { limit: 10 })
      .then(setActivityLogs)
      .catch(() => setActivityLogs([]));
  }).catch(() => {
    toast.error(t("loadError"));
    setLoading(false);
  });
}, [t]);
```

**Step 4: Agregar helper para formatear acción**

```typescript
const formatAction = (action: string, entityType: string) => {
  const labels: Record<string, Record<string, string>> = {
    LOGIN: { session: "Inició sesión" },
    CREATE: { user: "Creó usuario", company: "Creó empresa", client: "Creó cliente", supplier: "Creó proveedor", contract: "Creó contrato", supplement: "Creó suplemento" },
    UPDATE: { user: "Actualizó usuario", company: "Actualizó empresa", client: "Actualizó cliente" },
  };
  return labels[action]?.[entityType] || `${action} ${entityType}`;
};
```

**Step 5: Agregar bloque UI después de accountInfo**

```tsx
<div className="border-t pt-4">
  <h3 className="text-sm font-medium mb-3">{t("activityLog")}</h3>
  {activityLogs.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
  ) : (
    <div className="space-y-2">
      {activityLogs.slice(0, 10).map((log) => (
        <div key={log.id} className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            {formatAction(log.action, log.entity_type)}
          </span>
          <span className="text-xs">{new Date(log.created_at).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  )}
  <Button 
    variant="link" 
    className="mt-2 p-0 h-auto" 
    onClick={() => window.location.href = "/profile/history"}
  >
    {t("viewFullHistory")}
  </Button>
</div>
```

**Step 6: Commit**

```bash
git add pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx
git commit -m "feat(audit): add activity log block to profile"
```

---

### Task 8: Crear página de historial completo

**Files:**
- Create: `pacta_appweb/src/pages/HistoryPage/HistoryPage.tsx`
- Modify: `pacta_appweb/src/App.tsx`

**Step 1: Crear componente HistoryPage**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAuditLogs, AuditLog } from "@/lib/audit-api";
import { profileAPI } from "@/lib/users-api";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export function HistoryPage() {
  const { t } = useTranslation("profile");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    profileAPI.getProfile().then((profile) => {
      setUserId(profile.id);
      loadLogs(profile.id, 0);
    });
  }, []);

  const loadLogs = (uid: number, offset: number) => {
    getAuditLogs(uid, { limit: PAGE_SIZE, offset })
      .then((data) => {
        if (offset === 0) {
          setLogs(data);
        } else {
          setLogs((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => {
        toast.error(t("loadError"));
        setLoading(false);
      });
  };

  const loadMore = () => {
    if (!userId || !hasMore) return;
    setLoading(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadLogs(userId, nextPage * PAGE_SIZE);
  };

  const formatAction = (action: string, entityType: string) => {
    const labels: Record<string, Record<string, string>> = {
      LOGIN: { session: "Inició sesión" },
      CREATE: { user: "Creó usuario", company: "Creó empresa", client: "Creó cliente", supplier: "Creó proveedor", contract: "Creó contrato", supplement: "Creó suplemento" },
      UPDATE: { user: "Actualizó usuario", company: "Actualizó empresa", client: "Actualizó cliente" },
    };
    return labels[action]?.[entityType] || `${action} ${entityType}`;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("fullHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground">{t("noActivity")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("entity")}</TableHead>
                    <TableHead>{t("details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="capitalize">{log.entity_type}</TableCell>
                      <TableCell>{formatAction(log.action, log.entity_type)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={loadMore} disabled={loading}>
                    {loading ? t("loading") : t("loadMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Agregar ruta en App.tsx**

Buscar rutas existentes en `pacta_appweb/src/App.tsx` y agregar:

```tsx
import { HistoryPage } from "@/pages/HistoryPage/HistoryPage";

// En la definición de rutas:
<Route path="/profile/history" element={<HistoryPage />} />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/HistoryPage/HistoryPage.tsx pacta_appweb/src/App.tsx
git commit -m "feat(audit): add full history page"
```

---

### Task 9: Agregar traducciones

**Files:**
- Modify: `pacta_appweb/src/locales/es/profile.json`

**Step 1: Agregar nuevas traducciones**

```json
{
  "activityLog": "Historial de Actividad",
  "noActivity": "No hay actividad registrada",
  "viewFullHistory": "Ver historial completo",
  "fullHistory": "Historial Completo",
  "date": "Fecha",
  "action": "Acción",
  "entity": "Entidad",
  "details": "Detalles",
  "loadMore": "Cargar más"
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/locales/es/profile.json
git commit -m "feat(audit): add activity log translations"
```

---

## Resumen de Tareas

| # | Tarea | Archivos |
|---|------|---------|
| 1 | InsertAuditLog helper | `internal/handlers/audit_logs.go` |
| 2 | LOGIN audit | `internal/handlers/auth.go` |
| 3 | USER audit | `internal/handlers/users.go` |
| 4 | COMPANY audit | `internal/handlers/companies.go` |
| 5 | CLIENT/SUPPLIER/CONTRACT/SUPPLEMENT audit | handlers/*.go |
| 6 | audit-api.ts | `pacta_appweb/src/lib/audit-api.ts` |
| 7 | ProfileSection block | `pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx` |
| 8 | HistoryPage | `pacta_appweb/src/pages/HistoryPage/HistoryPage.tsx`, `App.tsx` |
| 9 | Traducciones | `pacta_appweb/src/locales/es/profile.json` |