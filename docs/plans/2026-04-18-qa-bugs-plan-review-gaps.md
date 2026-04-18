# QA Bugs Fix — Plan Review & Gaps Identified

> Original plan: `docs/plans/2026-04-18-qa-bugs-implementation-plan.md`
> Reviewer: Systematic Debugging Analysis
> Date: 2026-04-18

## Critical Finding — Core Issue: Settings Not Persisting

### Root Cause Already Identified

**ERROR 1**: `email_verification_required` key **MISSING** from database migration 029_email_settings.sql

```sql
-- Current 029_email_settings.sql (lines 5-10)
INSERT INTO system_settings (key, value, category) VALUES
('email_notifications_enabled', 'true', 'email'),
('email_contract_expiry_enabled', 'true', 'email'),
('smtp_enabled', 'true', 'email'),
('brevo_enabled', 'false', 'email'),
('brevo_api_key', '', 'email');
-- MISSING: ('email_verification_required', 'false', 'email')
```

**Frontend code** (`EmailSettingsTab.tsx:12-19`) declares 6 keys including `email_verification_required`, but backend never creates it → UPDATE affects 0 rows → settings appear not to save.

**User-visible symptom**: "Changes on settings page don't persist" — specifically the email verification toggle.

---

### Additional Security/UX Gap

**ERROR 2**: Default values are overly permissive (`'true'` for email notifications, contract expiry, SMTP). According to user requirement: "should be disabled by default, only enabled if admin wants".

**Recommended**: Change defaults to `'false'` for least-privilege security.

---

## Systemmatic Debugging Result — 6 Issues Found

| # | Location | Severity | Issue | Current State | Required Fix |
|---|----------|----------|-------|---------------|--------------|
| 1 | `migrations/029_email_settings.sql` | **CRITICAL** | `email_verification_required` key missing | Not inserted | Add INSERT statement |
| 2 | `migrations/029_email_settings.sql` | **HIGH** | Defaults too permissive | `'true'` for email_notifications, expiry, smtp | Change to `'false'` |
| 3 | `handlers/auth.go` (HandleRegister) | **CRITICAL** | Backend ignores `email_verification_required` toggle | Uses `req.Mode` only | Read setting via `GetSettingBool` and apply logic |
| 4 | `handlers/auth.go` (HandleRegister) | **MEDIUM** | `registration_methods` setting not used | Never read | Optional: validate mode against allowed methods |
| 5 | Frontend `LoginForm.tsx` | **LOW** | Shows email verification option even if disabled | Hardcoded `registrationMode='email'` | Optionally hide if setting disabled (not in original plan) |
| 6 | `server/server.go` routing | **LOW** | `CompanyMiddleware` applied to system_settings unnecessarily | Global settings not company-scoped | Remove middleware for system_settings routes (cleaner architecture) |

---

## Gap Analysis vs Original Plan

**Original plan Task 6 only covers**:
- ✅ Frontend: Add toggle UI in EmailSettingsTab (already implemented)
- ✅ Frontend: Add translations (already implemented)
- ❌ **MISSING**: Database migration fix (the root cause)
- ❌ **MISSING**: Backend logic to respect the toggle
- ❌ **MISSING**: Tests for new behavior

**Original plan does NOT address**:
- Default values security hardening
- `registration_methods` validation (future work, not critical)
- CompanyMiddleware redundancy (architectural cleanup)

---

## Recommended Extended Scope

### Extension 1: New Migration for Existing Databases (CRITICAL)

Since migration 029 has already been applied in QA deployment, we need migration `030_email_settings_fix.sql`:

```sql
-- +goose Up
INSERT INTO system_settings (key, value, category)
VALUES ('email_verification_required', 'false', 'email')
ON CONFLICT(key) DO UPDATE SET value = 'false';

UPDATE system_settings SET value = 'false'
WHERE key IN ('email_notifications_enabled', 'email_contract_expiry_enabled', 'smtp_enabled')
AND value = 'true';

-- +goose Down
-- No rollback for safety — settings persist
```

**Why**: QA database already has 029 applied. Simply modifying 029 won't affect existing DB.

### Extension 2: Backend Toggle Logic (CRITICAL)

File: `internal/handlers/auth.go` — modify `HandleRegister`:

```go
// After line 73 (after checking existing email):
emailVerificationRequired := h.GetSettingBool("email_verification_required", false)

// Then modify status assignment (lines 74-84):
role := "viewer"
status := "active"
if userCount == 0 {
    role = "admin"
    status = "active"
} else {
    if emailVerificationRequired && req.Mode == "email" {
        status = "pending_email"
    } else if req.Mode == "approval" {
        status = "pending_approval"
    }
    // else: status stays "active" (no verification required)
}
```

### Extension 3: Unit Test (RECOMMENDED)

Create `internal/handlers/auth_test.go` with table-driven tests for `HandleRegister` scenarios:

- First user always active (no verification)
- Subsequent user with email_verification_required=false → active
- Subsequent user with email_verification_required=true + mode=email → pending_email
- Subsequent user with mode=approval → pending_approval

**Note**: Project already uses testing (41 tests passing per PROJECT_SUMMARY). Should follow existing test patterns.

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| New migration 030 | Low | Idempotent INSERT ON CONFLICT, safe for all environments |
| Backend toggle logic | Low | Clear conditional, follows existing pattern |
| Unit tests | Negligible | No production impact |
| Frontend changes (Tasks 1-5) | Very Low | Cosmetic/UX only, no data changes |

---

## Verifications Required (ADD TO PLAN)

Beyond plan's checklist (which is UI-focused), add **backend verification**:

1. ✅ **Database**: After migration, `SELECT key FROM system_settings WHERE key='email_verification_required'` returns row
2. ✅ **Backend GET**: `GET /api/system-settings` includes `email_verification_required` in JSON
3. ✅ **Backend PUT**: Updating the toggle returns 200 and persists in DB
4. ✅ **Registration logic**: 
   - With toggle ON + mode=email → returns 201 status=pending_email
   - With toggle OFF + mode=email → returns 201 status=active
5. ✅ **End-to-end**: Toggle UI in EmailSettingsTab controls behavior (not just stored, but enforced)

---

## Conclusion & Recommendation

**PLAN IS 80% COMPLETE** — Missing critical database and backend pieces.

**RECOMMENDATION**: Execute the plan **with extensions**:

1. Keep Tasks 1-5 as-is (frontend/UX fixes)
2. **Replace/extend Task 6** with:
   - Subtask 6a: Create migration 030_email_settings_fix.sql
   - Subtask 6b: Modify HandleRegister to read and apply setting
   - Subtask 6c: Add unit tests for registration flow with toggle
   - Subtask 6d: Verify all 3 settings (GET, PUT, registration behavior)
3. Add Task 7: Run full test suite (`npm test` or `go test ./...`)

**Estimated additional time**: 30-45 minutes (migration: 5min, backend logic: 15min, tests: 15min, verification: 10min).

Ready to proceed with extended implementation using TDD approach.
