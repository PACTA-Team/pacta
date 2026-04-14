# Hybrid Registration System Design

**Date**: 2026-04-14
**Status**: Approved
**Author**: Brainstorming Session

## Problem Statement

1. **Login fails after registration**: Newly registered users have no company assigned in `user_companies`, causing login to fail with "no company assigned"
2. **No email verification**: Registration is instant with no verification step
3. **No admin approval workflow**: Admins cannot review/approve new registrations
4. **Admin user management lacks company assignment**: Cannot assign users to companies from the Users page
5. **404 errors on back button and F5 refresh**: SPA routes not handled by server fallback

## Solution Overview

Implement a hybrid registration system supporting two modes:
- **Email Code Verification** (via Resend): User receives 6-digit code, 5-minute window to verify
- **Admin Approval**: User types company name, admins review and approve with company assignment

Fix SPA routing to serve `index.html` for all non-API routes.

## Architecture

### Backend Changes

#### New Dependencies
- `github.com/resend/resend-go/v3` - Resend email SDK

#### New Database Tables (Migration 023)

```sql
-- Registration codes for email verification
CREATE TABLE registration_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pending approvals for admin review
CREATE TABLE pending_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_name TEXT NOT NULL,
    company_id INTEGER REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Extend users table with new statuses
-- (No schema change needed - status CHECK already allows extensible values via migration)
ALTER TABLE users ADD COLUMN verification_code TEXT; -- temporary, for email mode
```

#### New User Statuses
- `pending_email` - Awaiting email code verification
- `pending_approval` - Awaiting admin approval

#### New Files

```
internal/email/
  resend.go          - Resend client wrapper, env var loading
  templates.go       - Email template rendering (Go strings, Phase 1)
internal/handlers/
  registration.go    - Code generation, validation, timeout handling
  approvals.go       - Admin approval workflow (list, approve, reject)
internal/db/migrations/
  023_registration.sql
```

#### New API Endpoints

```
POST /api/auth/register          - Modified: accepts registration_mode, company_name
POST /api/auth/verify-code       - New: validate email code
GET  /api/approvals/pending      - Admin: list pending approvals
POST /api/approvals/{id}/approve - Admin: approve with company assignment
POST /api/approvals/{id}/reject  - Admin: reject with optional notes
PATCH /api/users/{id}/company    - Admin: assign user to company
```

#### Registration Flow

**Email Code Mode**:
1. POST `/api/auth/register` with `{ mode: "email", name, email, password }`
2. Backend creates user with `status='pending_email'`
3. Generate 6-digit code, bcrypt hash, store in `registration_codes` with `expires_at = NOW() + 5min`
4. Send email via Resend to user with code
5. User enters code → POST `/api/auth/verify-code` with `{ email, code }`
6. Backend validates code, updates user to `status='active'`
7. Auto-assign to first company (or create company if user provided company_name)
8. Auto-login: create session, set cookie

**Admin Approval Mode**:
1. POST `/api/auth/register` with `{ mode: "approval", name, email, password, company_name }`
2. Backend creates user with `status='pending_approval'`
3. Create `pending_approvals` record
4. Send email to all admins (query `users WHERE role='admin'`) with registration details
5. Create in-app notification for admins
6. Admin reviews via UsersPage → "Pending Users" tab
7. Admin approves → assigns to existing or new company → user status becomes `active`
8. Admin rejects → user status becomes `inactive`, optional notes stored

#### Login Bug Fix

**Root Cause**: Registration creates session with `companyID=0` but doesn't insert into `user_companies`.

**Fix**:
- `HandleRegister`: After creating user, insert into `user_companies` with first company (or newly created company from `company_name`)
- `HandleLogin`: If user has `status='pending_email'` or `status='pending_approval'`, return clear error message
- `HandleMe`: Return user's company info in response

#### Admin User Edit Enhancement

Add company selector to `UsersPage.tsx` edit form:
- Fetch all companies via `/api/companies`
- Dropdown to assign/change user's company
- On submit: insert/update `user_companies` record

#### SPA Routing Fix

**Root Cause**: `http.FileServer` returns 404 for routes that don't exist as files.

**Fix**: Replace catch-all with custom handler:
```go
r.Handle("/*", spaHandler(staticFS, "dist/index.html"))

func spaHandler(fsys fs.FS, indexPath string) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Try to serve file
        path := strings.TrimPrefix(r.URL.Path, "/")
        f, err := fsys.Open(path)
        if err != nil || f == nil {
            // Fallback to index.html for SPA routes
            http.ServeFile(w, r, "dist/index.html")
            return
        }
        // Serve static file
        http.FileServer(http.FS(fsys)).ServeHTTP(w, r)
    })
}
```

### Frontend Changes

#### New Dependencies
- `@react-email/components` - For branded email templates (Phase 2, optional)

#### New Pages

```
src/pages/
  VerifyEmailPage.tsx       - Code entry form with 5-min countdown timer
  RegistrationExpiredPage.tsx - Expired code message + support contact
```

#### Modified Pages

```
src/pages/LoginForm.tsx          - Add company_name field, registration mode selector
src/pages/UsersPage.tsx          - Add "Pending Users" tab, company assignment in edit form
src/pages/PendingApprovalPage.tsx - Enhanced with real-time status check
src/contexts/AuthContext.tsx     - Handle pending statuses
src/components/admin/
  PendingUsersTable.tsx          - Admin approval UI (approve/reject, company assignment)
src/lib/
  registration-api.ts            - API client for registration endpoints
```

#### Registration Form Changes

```tsx
// Registration mode selector
<RadioGroup value={mode} onValueChange={setMode}>
  <RadioGroupItem value="email" label="Verify via email code" />
  <RadioGroupItem value="approval" label="Request admin approval" />
</RadioGroup>

// Conditional fields
{mode === 'email' && (
  <Input name="email" type="email" required />
)}

{mode === 'approval' && (
  <>
    <Input name="email" type="email" required />
    <Input name="company_name" placeholder="Your company name" required />
  </>
)}
```

#### Verify Email Page

- 6-digit code input (auto-focus, auto-submit on 6th digit)
- Countdown timer (5:00 → 0:00)
- On timeout: redirect to `/registration-expired`
- On success: redirect to `/dashboard`

#### Admin Pending Users Table

- Tab in UsersPage: "Pending Approvals"
- Shows: name, email, company_name, registered_at
- Actions: Approve (opens company selector), Reject (opens notes field)
- Real-time refresh via polling or WebSocket (Phase 2)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Resend API failure | Log warning, fallback to admin approval mode |
| Code validation fails (wrong code) | Increment attempts, show error, max 5 attempts |
| Code expires (5 min) | Redirect to `/registration-expired`, show support message |
| Admin approval timeout | None - approval stays pending until action |
| Company creation during approval | Admin selects existing or creates new |
| SPA route not found | Serve `index.html`, React Router shows 404 page |

## Security

- Registration codes: bcrypt-hashed, not stored in plaintext
- Rate limiting: 5 code attempts per code, lock after max attempts
- Resend API key: Environment variable only (`RESEND_API_KEY`), never in DB or client
- Admin approval: Only `role='admin'` users can access pending approvals endpoint
- CSRF: Existing httpOnly, SameSite=Strict cookie protection applies
- Company assignment: Only admins can assign users to companies

## Migration Plan

1. Add `RESEND_API_KEY` to `.env.example` and config
2. Run migration 023 (create tables)
3. Deploy backend with new endpoints
4. Deploy frontend with new pages
5. Test email code flow with test Resend account
6. Test admin approval flow
7. Verify login works after registration
8. Verify SPA routing (back button, F5)

## Rollback

- Migration 023 Down: Drop `registration_codes`, `pending_approvals` tables
- Feature flag: If `RESEND_API_KEY` not set, default to admin approval mode only
- Frontend: Old registration form still works (no breaking changes to existing login)

## Future Enhancements (Out of Scope)

- React Email templates for branded emails (Phase 2)
- Resend webhooks for email open/click tracking
- Bulk admin approval actions
- Custom email templates per company
- SMS verification as alternative to email
