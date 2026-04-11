# First-Run Setup Wizard Design

> **Date:** 2026-04-11
> **Status:** Approved
> **Version Target:** v0.5.0

---

## Problem

PACTA currently ships with a hardcoded default admin user in migration `001_users.sql` with a known bcrypt hash. This is a security risk:
- The hash is a well-known fake test value, not matching `admin123`
- Every installation has the same default credentials
- Users have no way to set their own admin password on first run

## Solution

Replace the hardcoded default admin with a first-run setup wizard that collects admin credentials + seed data (first client + first supplier) through a multi-step web form.

---

## Architecture

### Backend

**New endpoint:** `POST /api/setup`

- Unauthenticated (no auth middleware)
- Protected by first-run check: `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`
- If users exist, returns 403 "Setup has already been completed"
- Accepts JSON: `{ admin, client, supplier }`
- Runs in single SQLite transaction (atomic: all or nothing)
- After success, endpoint is permanently locked

**New endpoint:** `GET /api/setup/status`

- Lightweight check: returns `{ needs_setup: true/false }`
- Used by frontend to decide whether to redirect to wizard

**New files:**
- `internal/handlers/setup.go` -- Setup handler + request/response types

**Modified files:**
- `internal/db/001_users.sql` -- Remove `INSERT OR IGNORE` default admin line
- `internal/db/012_remove_default_admin.sql` -- Migration to clean up existing DBs (optional, for upgrades)
- `internal/server/server.go` -- Add setup routes

### Frontend

**Wizard page:** `/setup`

5 steps:
1. **Welcome** -- Introduction screen
2. **Admin Account** -- name, email, password, confirm password
3. **First Client** -- name (required), address, REU code, contacts
4. **First Supplier** -- name (required), address, REU code, contacts
5. **Review & Complete** -- Summary table + submit button

**Auto-redirect logic:**
- On app load, `AuthContext` calls `GET /api/auth/me`
- If 401, calls `GET /api/setup/status`
- If `needs_setup: true`, redirect to `/setup`
- If `needs_setup: false`, redirect to `/login`
- After successful setup, auto-login and redirect to `/dashboard`

**New files:**
- `pacta_appweb/src/app/setup.tsx` -- Wizard page
- `pacta_appweb/src/components/setup-wizard.tsx` -- Multi-step wizard component
- `pacta_appweb/src/lib/setup-api.ts` -- Setup API client
- `pacta_appweb/src/lib/setup-validation.ts` -- Zod validation schemas

**Modified files:**
- `pacta_appweb/src/app/app.tsx` -- Add `/setup` route
- `pacta_appweb/src/contexts/auth-context.tsx` -- Add setup status check

---

## Data Flow

```
Browser: First visit → GET / → React app loads
AuthContext: GET /api/auth/me → 401 (no session)
AuthContext: GET /api/setup/status → { needs_setup: true }
Router: Redirect to /setup

User fills wizard → clicks "Complete Setup"
Browser: POST /api/setup { admin, client, supplier }
Backend: BEGIN TRANSACTION
  → bcrypt hash password
  → INSERT INTO users (admin)
  → INSERT INTO clients (first client)
  → INSERT INTO suppliers (first supplier)
Backend: COMMIT
Backend: Auto-login (create session cookie)
Backend: Return { status: "setup_complete", admin_id, client_id, supplier_id }
Browser: Redirect to /dashboard
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| Admin email | Valid format, unique |
| Admin password | Min 8 chars, 1 uppercase, 1 number, 1 special char |
| Client name | Required, 2-200 chars, unique |
| Supplier name | Required, 2-200 chars, unique |
| Address/REU/Contacts | Optional, sanitized |

---

## Error Handling

| Scenario | HTTP Status | Message |
|----------|------------|---------|
| Setup already completed | 403 | "Setup has already been completed" |
| Invalid email | 400 | "Please enter a valid email address" |
| Weak password | 400 | "Password must be at least 8 characters with uppercase, number, and special character" |
| Duplicate client name | 409 | "A client with this name already exists" |
| Duplicate supplier name | 409 | "A supplier with this name already exists" |
| DB error | 500 | "Setup failed. Please restart the application" |

**Transaction safety:** Single `BEGIN/COMMIT` wrapping all 3 inserts. Any error triggers full rollback. No partial state possible.

---

## Security

- Setup endpoint is the ONLY unauthenticated POST besides login
- First-run check is the only gate -- no separate feature flag
- Password hashed with bcrypt (cost 10) before storage
- All SQL queries use parameterized statements
- Input sanitized server-side (no HTML/script injection)
- Error messages don't expose internal details
- After setup, endpoint returns 403 permanently

---

## Accessibility

- All form fields with proper `<label>` elements
- Keyboard navigation between steps
- ARIA live regions for validation errors
- Focus management on step transitions
- Skip navigation link available
- Color contrast meets WCAG AA 4.5:1

---

## Migration Path

**For new installations:**
- Migration `001_users.sql` no longer inserts default admin
- First run triggers wizard automatically

**For existing installations (upgrade from < v0.5.0):**
- Migration `012_remove_default_admin.sql` removes the hardcoded admin if it still exists
- Existing admin users are unaffected (they already have real accounts)
- Setup endpoint detects existing users and returns 403

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `internal/handlers/setup.go` | Setup endpoint handler |
| Create | `internal/db/012_remove_default_admin.sql` | Cleanup migration |
| Create | `pacta_appweb/src/app/setup.tsx` | Wizard page |
| Create | `pacta_appweb/src/components/setup-wizard.tsx` | Multi-step wizard component |
| Create | `pacta_appweb/src/lib/setup-api.ts` | Setup API client |
| Create | `pacta_appweb/src/lib/setup-validation.ts` | Zod validation schemas |
| Modify | `internal/db/001_users.sql` | Remove default admin INSERT |
| Modify | `internal/server/server.go` | Add setup routes |
| Modify | `pacta_appweb/src/app/app.tsx` | Add `/setup` route |
| Modify | `pacta_appweb/src/contexts/auth-context.tsx` | Add setup status check |
