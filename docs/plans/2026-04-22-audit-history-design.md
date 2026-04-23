# Diseño: Historial de Auditoría en Perfil de Usuario

**Fecha**: 2026-04-22
**Proyecto**: Pacta
**Estado**: Aprobado

---

## Objetivo

Agregar un sistema de auditoría completo en el perfil del usuario que registre todas las acciones realizadas en la plataforma, con dos vistas: resumen de últimos 10 logs en el perfil, y historial completo en página dedicada.

---

## 1. Estructura de Datos

### Tabla: `audit_logs`

La tabla ya existe en `internal/db/migrations/009_audit_logs.sql`:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    previous_state TEXT,
    new_state TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    company_id INTEGER
);
```

### Función Helper (Backend)

Crear función para insertar logs de auditoría:

```go
func (h *Handler) InsertAuditLog(userID int, action, entityType string, entityID *int, prevState, newState *string, r *http.Request)
```

---

## 2. API Endpoints

### GET /api/audit-logs (existente)

Ya existe en `internal/handlers/audit_logs.go`. Se reutiliza con filtro por `user_id`:

**Parámetros**:
- `user_id` (requerido): ID del usuario
- `limit` (opcional, default 100): cantidad de registros
- `offset` (opcional): para paginación
- `entity_type` (opcional): filtrar por tipo de entidad
- `action` (opcional): filtrar por acción

**Respuesta**:
```json
[
  {
    "id": 1,
    "user_id": 5,
    "action": "CREATE",
    "entity_type": "user",
    "entity_id": 10,
    "previous_state": null,
    "new_state": "{\"name\":\"Juan\"}",
    "ip_address": "192.168.1.1",
    "created_at": "2026-04-22T10:30:00Z"
  }
]
```

---

## 3. Acciones a Registrar

### Handler: HandleLogin (`auth.go`)

**Ubicación**: `internal/handlers/auth.go:212`

Agregar después de login exitoso (línea 268):

```go
// Registrar login en auditoría
ip := r.RemoteAddr
h.InsertAuditLog(user.ID, "LOGIN", "session", nil, nil, nil, &ip)
```

### Handler: HandleCreateUser (`users.go`)

**Ubicación**: `internal/handlers/users.go`

Agregar después de crear usuario exitoso.

### Handler: HandleUpdateUser (`users.go`)

**Ubicación**: `internal/handlers/users.go`

Agregar después de actualizar usuario, capturando estado anterior y nuevo.

### Handler: handleCreateCompany (`companies.go`)

**Ubicación**: `internal/handlers/companies.go:131`

Agregar después de crear empresa.

### Handler: HandleCreateClient (`clients.go`)

**Ubicación**: `internal/handlers/clients.go`

Agregar después de crear cliente.

### Handler: HandleCreateSupplier (`suppliers.go`)

**Ubicación**: `internal/handlers/suppliers.go`

Agregar después de crear proveedor.

### Handler: HandleCreateContract (`contracts.go`)

**Ubicación**: `internal/handlers/contracts.go`

Agregar después de crear contrato.

### Handler: HandleCreateSupplement (`supplements.go`)

**Ubicación**: `internal/handlers/supplements.go`

Agregar después de crear suplemento.

---

## 4. Frontend - Bloque en Perfil

### Ubicación

`pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx`

Agregar nuevo bloque después de "Account Info" (línea 112):

```tsx
<div className="border-t pt-4">
  <h3 className="text-sm font-medium mb-3">{t("activityLog")}</h3>
  <div className="space-y-2">
    {/* Últimos 10 logs */}
    {activityLogs.slice(0, 10).map((log) => (
      <div key={log.id} className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {getActionIcon(log.action)} {getActionLabel(log.action, log.entity_type)}
        </span>
        <span className="text-xs">{formatDateTime(log.created_at)}</span>
      </div>
    ))}
  </div>
  <Button 
    variant="link" 
    className="mt-2" 
    onClick={() => navigate("/profile/history")}
  >
    {t("viewFullHistory")}
  </Button>
</div>
```

---

## 5. Nueva Página - Historial Completo

### Ruta

`/profile/history`

### Archivo

`pacta_appweb/src/pages/HistoryPage/HistoryPage.tsx`

### Componentes

- **Tabla de logs** con columnas: Fecha, Acción, Entidad, Detalle
- **Filtros**: por entidad, por acción, por rango de fechas
- **Paginación**: 20 registros por página

### API

```typescript
// pacta_appweb/src/lib/audit-api.ts
export async function getAuditLogs(userId: number, params?: { limit?: number; offset?: number; entityType?: string; action?: string }) {
  const searchParams = new URLSearchParams();
  searchParams.set("user_id", userId.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  // ...
  return fetch(`/api/audit-logs?${searchParams}`).then(r => r.json());
}
```

---

## 6. Formato de Visualización

| action | entity_type | Texto Mostrado |
|--------|-----------|-------------|
| LOGIN | session | Inició sesión |
| CREATE | user | Creó usuario: {nombre} |
| CREATE | company | Creó empresa: {nombre} |
| CREATE | client | Creó cliente: {nombre} |
| CREATE | supplier | Creó proveedor: {nombre} |
| CREATE | contract | Creó contrato: #{id} |
| CREATE | supplement | Creó suplemento: {nombre} |
| UPDATE | * | Actualizó {entity_type}: {nombre} |

---

## 7. Traducciones

Agregar en `pacta_appweb/src/locales/es/profile.json`:

```json
{
  "activityLog": "Historial de Actividad",
  "viewFullHistory": "Ver historial completo",
  "action": {
    "LOGIN": "Inició sesión",
    "CREATE": "Creó",
    "UPDATE": "Actualizó",
    "DELETE": "Eliminó"
  },
  "entityType": {
    "user": "usuario",
    "company": "empresa",
    "client": "cliente",
    "supplier": "proveedor",
    "contract": "contrato",
    "supplement": "suplemento"
  }
}
```

---

## 8. Implementación por Fases

### Fase 1: Backend
1. Crear función `InsertAuditLog` en `audit_logs.go`
2. Agregar registro de LOGIN en `HandleLogin`
3. Agregar registro en handlers de creación (usuarios, empresas, clientes, proveedores, contratos, suplementos)

### Fase 2: Frontend
1. Crear API wrapper `audit-api.ts`
2. Agregar bloque de historial en `ProfileSection.tsx`
3. Crear página `/profile/history`
4. Agregar traducciones

---

## 9. Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `internal/handlers/audit_logs.go` | Agregar función InsertAuditLog |
| `internal/handlers/auth.go` | Registrar LOGIN |
| `internal/handlers/users.go` | Registrar CREATE/UPDATE usuario |
| `internal/handlers/companies.go` | Registrar CREATE empresa |
| `internal/handlers/clients.go` | Registrar CREATE cliente |
| `internal/handlers/suppliers.go` | Registrar CREATE proveedor |
| `internal/handlers/contracts.go` | Registrar CREATE contrato |
| `internal/handlers/supplements.go` | Registrar CREATE suplemento |
| `pacta_appweb/src/lib/audit-api.ts` | Nuevo archivo - API wrapper |
| `pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx` | Agregar bloque historial |
| `pacta_appweb/src/pages/HistoryPage/HistoryPage.tsx` | Nueva página |
| `pacta_appweb/src/App.tsx` | Agregar ruta /profile/history |
| `pacta_appweb/src/locales/es/profile.json` | Agregar traducciones |