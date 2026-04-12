# Eliminate localStorage Dependency — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove every remaining localStorage read/write from the frontend. All data must come from the Go backend API.

**Architecture:** Create API modules for audit logs and notification settings. Migrate notification generation from localStorage writes to POST API calls. Clean up unused storage functions.

**Tech Stack:** Go (net/http, database/sql), TypeScript, React, fetch API, Vitest

---

## Task 1: Create audit-api.ts frontend module

**Files:**
- Create: `pacta_appweb/src/lib/audit-api.ts`
- Test: `pacta_appweb/src/__tests__/audit-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/audit-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('auditAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of audit logs', async () => {
    const mockData = [{ id: 1, user_id: 1, action: 'create', entity_type: 'contract', entity_id: 1, created_at: '2026-01-01T00:00:00Z' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { auditAPI } = await import('@/lib/audit-api');
    const result = await auditAPI.list();
    expect(result).toEqual(mockData);
  });

  it('listByContract sends correct query params', async () => {
    const mockData = [{ id: 1, action: 'update', entity_type: 'contract', entity_id: 42 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { auditAPI } = await import('@/lib/audit-api');
    const result = await auditAPI.listByContract(42);
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('/api/audit-logs?entity_type=contract&entity_id=42', expect.any(Object));
  });

  it('listByEntityType sends correct query params', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const { auditAPI } = await import('@/lib/audit-api');
    await auditAPI.listByEntityType('supplement');
    expect(mockFetch).toHaveBeenCalledWith('/api/audit-logs?entity_type=supplement', expect.any(Object));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npm test -- src/__tests__/audit-api.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write minimal implementation**

Create `pacta_appweb/src/lib/audit-api.ts`:

```typescript
const BASE = '/api/audit-logs';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  previous_state: string | null;
  new_state: string | null;
  ip_address: string | null;
  created_at: string;
}

export const auditAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<AuditLogEntry[]>(BASE, { signal }),

  listByContract: (contractId: number, signal?: AbortSignal) =>
    fetchJSON<AuditLogEntry[]>(`${BASE}?entity_type=contract&entity_id=${contractId}`, { signal }),

  listByEntityType: (entityType: string, signal?: AbortSignal) =>
    fetchJSON<AuditLogEntry[]>(`${BASE}?entity_type=${entityType}`, { signal }),
};
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npm test -- src/__tests__/audit-api.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/audit-api.ts pacta_appweb/src/__tests__/audit-api.test.ts
git commit -m "feat: add audit-api module with tests"
```

---

## Task 2: Update AuditLog type and ContractDetailsPage

**Files:**
- Modify: `pacta_appweb/src/types/index.ts` (AuditLog interface)
- Modify: `pacta_appweb/src/pages/ContractDetailsPage.tsx` (lines ~20-60, ~260-290)
- Modify: `pacta_appweb/src/lib/audit.ts` (remove addAuditLog, update getContractAuditLogs)

**Step 1: Update AuditLog type**

In `pacta_appweb/src/types/index.ts`, replace the AuditLog interface:

```typescript
export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  previous_state: string | null;
  new_state: string | null;
  ip_address: string | null;
  created_at: string;
}
```

**Step 2: Update audit.ts**

Replace entire `pacta_appweb/src/lib/audit.ts`:

```typescript
import { auditAPI, AuditLogEntry } from '@/lib/audit-api';

export const getContractAuditLogs = async (contractId: number): Promise<AuditLogEntry[]> => {
  return auditAPI.listByContract(contractId);
};
```

**Step 3: Update ContractDetailsPage.tsx**

In `ContractDetailsPage.tsx`, update the audit log loading:

Change the `loadContract` function's audit log section from:
```typescript
const logs = getContractAuditLogs(id);
setAuditLogs(logs);
```

To:
```typescript
try {
  const logs = await getContractAuditLogs(contractId);
  setAuditLogs(logs);
} catch {
  setAuditLogs([]);
}
```

Change `useState<AuditLog[]>` to `useState<any[]>` for auditLogs state.

Update the audit log display in the JSX — change `log.userName` to `log.user_id ? 'User #' + log.user_id : 'System'`, `log.details` to `log.new_state || log.action`, and `log.timestamp` to `log.created_at`.

**Step 4: Run tests**

Run: `cd pacta_appweb && npm test -- --run`
Expected: All tests pass

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/types/index.ts pacta_appweb/src/lib/audit.ts pacta_appweb/src/pages/ContractDetailsPage.tsx
git commit -m "refactor: migrate audit logs from localStorage to API"
```

---

## Task 3: Create notification_settings backend migration

**Files:**
- Create: `internal/db/migrations/021_notification_settings.sql`
- Create: `internal/handlers/notification_settings.go`
- Modify: `internal/server/server.go` (add routes after line 74)

**Step 1: Create migration**

Create `internal/db/migrations/021_notification_settings.sql`:

```sql
-- Create notification_settings table
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
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_company ON notification_settings(company_id);

-- Down
DROP TABLE IF EXISTS notification_settings;
```

**Step 2: Create handler**

Create `internal/handlers/notification_settings.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

type NotificationSettings struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	CompanyID  int       `json:"company_id"`
	Enabled    bool      `json:"enabled"`
	Thresholds string    `json:"thresholds"`
	Recipients string    `json:"recipients"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (h *Handler) HandleNotificationSettings(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	switch r.Method {
	case http.MethodGet:
		h.getNotificationSettings(w, r, userID, companyID)
	case http.MethodPut:
		h.updateNotificationSettings(w, r, userID, companyID)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getNotificationSettings(w http.ResponseWriter, r *http.Request, userID, companyID int) {
	var s NotificationSettings
	err := h.DB.QueryRow(`
		SELECT id, user_id, company_id, enabled, thresholds, recipients, created_at, updated_at
		FROM notification_settings WHERE user_id = ? AND company_id = ?
	`, userID, companyID).Scan(&s.ID, &s.UserID, &s.CompanyID, &s.Enabled, &s.Thresholds, &s.Recipients, &s.CreatedAt, &s.UpdatedAt)

	if err != nil {
		// Return defaults if no settings exist
		h.JSON(w, http.StatusOK, map[string]interface{}{
			"enabled":    true,
			"thresholds": []int{7, 14, 30},
			"recipients": []string{},
		})
		return
	}

	h.JSON(w, http.StatusOK, s)
}

type updateSettingsRequest struct {
	Enabled    *bool      `json:"enabled"`
	Thresholds *[]int     `json:"thresholds"`
	Recipients *[]string  `json:"recipients"`
}

func (h *Handler) updateNotificationSettings(w http.ResponseWriter, r *http.Request, userID, companyID int) {
	var req updateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	thresholds := "[7,14,30]"
	if req.Thresholds != nil {
		b, _ := json.Marshal(req.Thresholds)
		thresholds = string(b)
	}

	recipients := "[]"
	if req.Recipients != nil {
		b, _ := json.Marshal(req.Recipients)
		recipients = string(b)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	_, err := h.DB.Exec(`
		INSERT INTO notification_settings (user_id, company_id, enabled, thresholds, recipients)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id, company_id) DO UPDATE SET
			enabled = excluded.enabled,
			thresholds = excluded.thresholds,
			recipients = excluded.recipients,
			updated_at = CURRENT_TIMESTAMP
	`, userID, companyID, enabled, thresholds, recipients)

	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update settings")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
```

**Step 3: Register routes**

In `internal/server/server.go`, after line 74 (after notification routes), add:

```go
r.Get("/api/notification-settings", h.HandleNotificationSettings)
r.Put("/api/notification-settings", h.HandleNotificationSettings)
```

**Step 4: Verify Go build via CI**

```bash
cd /home/mowgli/pacta
git add internal/db/migrations/021_notification_settings.sql internal/handlers/notification_settings.go internal/server/server.go
git commit -m "feat: add notification settings API endpoints"
git push
```

Then check GitHub Actions for build pass.

---

## Task 4: Create notification-settings-api.ts frontend module

**Files:**
- Create: `pacta_appweb/src/lib/notification-settings-api.ts`
- Test: `pacta_appweb/src/__tests__/notification-settings-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/notification-settings-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('notificationSettingsAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('get returns settings', async () => {
    const mockData = { enabled: true, thresholds: [7, 14, 30], recipients: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { notificationSettingsAPI } = await import('@/lib/notification-settings-api');
    const result = await notificationSettingsAPI.get();
    expect(result).toEqual(mockData);
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { notificationSettingsAPI } = await import('@/lib/notification-settings-api');
    const result = await notificationSettingsAPI.update({ enabled: false, thresholds: [3, 7] });
    expect(result).toEqual({ status: 'updated' });
    expect(mockFetch).toHaveBeenCalledWith('/api/notification-settings', expect.objectContaining({ method: 'PUT' }));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npm test -- src/__tests__/notification-settings-api.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write minimal implementation**

Create `pacta_appweb/src/lib/notification-settings-api.ts`:

```typescript
const BASE = '/api/notification-settings';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface NotificationSettings {
  enabled: boolean;
  thresholds: number[];
  recipients: string[];
}

export const notificationSettingsAPI = {
  get: (signal?: AbortSignal) =>
    fetchJSON<NotificationSettings>(BASE, { signal }),

  update: (data: Partial<NotificationSettings>, signal?: AbortSignal) =>
    fetchJSON<{ status: string }>(BASE, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),
};
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npm test -- src/__tests__/notification-settings-api.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/notification-settings-api.ts pacta_appweb/src/__tests__/notification-settings-api.test.ts
git commit -m "feat: add notification-settings-api module with tests"
```

---

## Task 5: Migrate notifications.ts from localStorage to API

**Files:**
- Modify: `pacta_appweb/src/lib/notifications.ts` (entire file)

**Step 1: Write the test**

No new test needed — existing behavior should be preserved. The change is internal (localStorage → API).

**Step 2: Replace entire notifications.ts**

```typescript
import { notificationsAPI } from '@/lib/notifications-api';
import { notificationSettingsAPI } from '@/lib/notification-settings-api';

const DEFAULT_THRESHOLDS = [7, 14, 30];

export const generateNotifications = async (contracts: any[]): Promise<void> => {
  let settings: { enabled: boolean; thresholds: number[] };
  try {
    const s = await notificationSettingsAPI.get();
    settings = {
      enabled: s.enabled,
      thresholds: typeof s.thresholds === 'string' ? JSON.parse(s.thresholds) : s.thresholds,
    };
  } catch {
    settings = { enabled: true, thresholds: DEFAULT_THRESHOLDS };
  }

  if (!settings.enabled) return;

  const now = new Date();

  for (const contract of contracts) {
    if (contract.status !== 'active') continue;

    const endDate = new Date(contract.end_date || contract.endDate);
    const daysUntilExpiration = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    for (const threshold of settings.thresholds) {
      if (daysUntilExpiration === threshold) {
        try {
          await notificationsAPI.create({
            type: `expiration_${threshold}`,
            title: `Contract Expiring: ${contract.title}`,
            message: `Contract "${contract.title}" (${contract.contract_number || contract.contractNumber}) will expire in ${threshold} days`,
            entity_id: contract.id,
            entity_type: 'contract',
          });
        } catch {
          // Silently skip duplicate or failed notification
        }
      }
    }
  }
};

export const markNotificationAsRead = async (notificationId: number): Promise<void> => {
  await notificationsAPI.markRead(notificationId);
};

export const markNotificationAsAcknowledged = async (notificationId: number): Promise<void> => {
  await notificationsAPI.markRead(notificationId);
};
```

**Step 3: Update notifications-api.ts to add create method**

Add to `pacta_appweb/src/lib/notifications-api.ts`:

```typescript
  create: (data: { type: string; title: string; message?: string; entity_id?: number; entity_type?: string }, signal?: AbortSignal) =>
    fetchJSON(`${BASE}`, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),
```

**Step 4: Update GlobalClientEffects.tsx**

Change from synchronous to async:

```typescript
import { useEffect } from 'react';
import { contractsAPI } from '@/lib/contracts-api';
import { generateNotifications } from '@/lib/notifications';

export default function GlobalClientEffects() {
  useEffect(() => {
    const generate = async () => {
      try {
        const contracts = await contractsAPI.list();
        await generateNotifications(contracts);
      } catch {
        // Silently fail - notifications are non-critical
      }
    };
    generate();

    const interval = setInterval(generate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
```

**Step 5: Run tests**

Run: `cd pacta_appweb && npm test -- --run`
Expected: All tests pass

**Step 6: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/notifications.ts pacta_appweb/src/lib/notifications-api.ts pacta_appweb/src/components/GlobalClientEffects.tsx
git commit -m "refactor: migrate notification generation from localStorage to API"
```

---

## Task 6: Clean up storage.ts — remove unused functions

**Files:**
- Modify: `pacta_appweb/src/lib/storage.ts` (remove functions and STORAGE_KEYS)

**Step 1: Remove unused exports from storage.ts**

Remove these exports from `storage.ts`:
- `getNotifications`, `setNotifications`
- `getAuditLogs`, `setAuditLogs`
- `getNotificationSettings`, `setNotificationSettings`

Remove from `STORAGE_KEYS`:
- `NOTIFICATIONS: 'pacta_notifications'`
- `AUDIT_LOGS: 'pacta_audit_logs'`
- `NOTIFICATION_SETTINGS: 'pacta_notification_settings'`

**Step 2: Verify no remaining imports**

Run: `grep -r "getAuditLogs\|setAuditLogs\|getNotifications\|setNotifications\|getNotificationSettings\|setNotificationSettings" pacta_appweb/src/`
Expected: No matches (except in storage.ts itself)

**Step 3: Run tests**

Run: `cd pacta_appweb && npm test -- --run`
Expected: All tests pass

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/storage.ts
git commit -m "refactor: remove unused localStorage functions for audit, notifications, settings"
```

---

## Task 7: Full verification — tests + build

**Step 1: Run all frontend tests**

```bash
cd pacta_appweb && npm test -- --run
```
Expected: All tests pass

**Step 2: Run TypeScript build**

```bash
cd pacta_appweb && npm run build
```
Expected: No TypeScript errors

**Step 3: Verify Go build via CI**

```bash
cd /home/mowgli/pacta
git push
```
Check GitHub Actions for Go build pass.

**Step 4: Final commit**

```bash
cd /home/mowgli/pacta
git add .
git commit -m "chore: verify full build and test suite after localStorage elimination"
```

---

## Summary

| Task | Scope | Files | Tests |
|------|-------|-------|-------|
| 1 | audit-api.ts + test | 2 new | 3 tests |
| 2 | Migrate audit usage | 3 modified | existing |
| 3 | Backend notification settings | 3 new + 1 mod | CI build |
| 4 | notification-settings-api.ts + test | 2 new | 2 tests |
| 5 | Migrate notifications | 3 modified | existing |
| 6 | Clean up storage.ts | 1 modified | existing |
| 7 | Full verification | - | all + build |

**Total:** ~14 files changed, ~10 new tests
