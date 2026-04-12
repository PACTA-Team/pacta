# Design: Eliminate All localStorage Dependency from Frontend

> **Goal:** Remove every remaining localStorage read/write from the frontend. All data must come from the Go backend API.

---

## Section 1: Audit Logs — Read-only migration to API

**Problem:** `audit.ts` writes and reads audit logs from localStorage. The backend already auto-writes audit logs on every CRUD operation via `h.auditLog()`.

**Solution:**
- **Delete** `addAuditLog()` — backend already captures everything automatically
- **Replace** `getContractAuditLogs(contractId)` with `GET /api/audit-logs?entity_type=contract&entity_id={id}`
- **Create** `pacta_appweb/src/lib/audit-api.ts` module following the established API pattern
- **Update** `ContractDetailsPage.tsx` to use the new API module
- **Update** `AuditLog` type in `types/index.ts` to match backend format (snake_case: `user_id`, `entity_type`, `action`, `created_at`)

**Backend endpoint:** Already exists — `GET /api/audit-logs` with query params `entity_type`, `entity_id`, `user_id`, `action`

**Files changed:** 4 modified, 1 new

---

## Section 2: Notification Settings — New backend API + frontend migration

**Problem:** `getNotificationSettings/setNotificationSettings` stores preferences in localStorage. No backend endpoint exists.

### Backend

**New migration** `021_notification_settings.sql`:
```sql
CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    enabled BOOLEAN DEFAULT 1,
    thresholds TEXT DEFAULT '[7,14,30]',
    recipients TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);
CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX idx_notification_settings_company ON notification_settings(company_id);
```

**New handler** `handlers/notification_settings.go`:
- `GET /api/notification-settings` — returns settings for current user+company, or defaults if none exist
- `PUT /api/notification-settings` — upsert settings (INSERT OR REPLACE)

**Register in** `server.go`:
```go
r.Get("/api/notification-settings", h.HandleNotificationSettings)
r.Put("/api/notification-settings", h.HandleNotificationSettings)
```

### Frontend

- **Create** `pacta_appweb/src/lib/notification-settings-api.ts` module
- **Replace** `getNotificationSettings/setNotificationSettings` calls in `notifications.ts` with API calls
- **Fallback:** If GET returns 404 or fails, use defaults and POST to create

**Files changed:** Backend: 3 new + 1 modified. Frontend: 1 new + 1 modified.

---

## Section 3: Notifications — Migrate auto-generation to API

**Problem:** `generateNotifications()` creates expiration alerts and stores them in localStorage. Backend has `POST /api/notifications`.

**Solution:**
- **Replace** `setNotifications(notifications)` with `POST /api/notifications` for each new notification
- **Eliminate** `getNotifications()` as data source — use only `notificationsAPI.list()`
- **Update** `markNotificationAsRead` and `markNotificationAsAcknowledged` to call `PATCH /api/notifications/{id}/read` instead of localStorage
- **GlobalClientEffects** already uses `contractsAPI.list()` — just needs to pass contracts to the function that now POSTs instead of writing to localStorage

**Files changed:** 1 modified (`notifications.ts`)

---

## Section 4: Cleanup

- **Remove** from `storage.ts`: `getAuditLogs`, `setAuditLogs`, `getNotificationSettings`, `setNotificationSettings`, `getNotifications`, `setNotifications`
- **Remove** corresponding `STORAGE_KEYS` entries
- **Remove** `addAuditLog` export from `audit.ts`
- **Verify** no remaining imports of deleted functions
- **Run** full test suite and build to confirm zero regressions

---

## Summary

| Phase | Scope | Files | Risk |
|-------|-------|-------|------|
| 1. Audit Logs API module | Frontend only | 5 | Low |
| 2. Notification Settings | Backend + Frontend | 8 | Medium |
| 3. Notifications generation | Frontend only | 1 | Low |
| 4. Cleanup | Frontend only | 2 | Low |

**Total:** ~16 files changed across backend and frontend
