# Company Assignment Fix Design

**Date**: 2026-04-14
**Status**: Approved

## Problem

1. **Registration form**: Company field only shows for admin approval mode. Email verification mode has no company input, so users registered via email get no company assigned.
2. **Users page edit form**: No company selector. Admins cannot assign or change a user's company from the edit form.

## Root Causes

- `LoginForm.tsx`: Company input wrapped in `{registrationMode === 'approval' && (...)}` — conditional rendering hides it for email mode
- `UsersPage.tsx`: Edit form has no company dropdown, no companies fetch, no `usersCompanyAPI.assignCompany()` call

## Design

### Section 1: Registration Form (`LoginForm.tsx`)

**Approach**: Dropdown with existing companies + "Other" option for new company name.

**Changes**:
1. Add `useEffect` to fetch `GET /api/companies` on mount when `showRegister` is true
2. Replace conditional company field with:
   - `<Select>` with existing companies + "Other (new company)" option
   - When "Other" selected → show `<Input>` for new company name
3. State: `selectedCompanyId` (`number | 'other'`), `companyName` (string)
4. Submit logic:
   - If number → send `company_id` to backend (existing company)
   - If 'other' + text → send `company_name` to backend (new company)

**Backend**: Already handles both cases via `company_name` field in register request.

### Section 2: Users Page Edit Form (`UsersPage.tsx`)

**Changes**:
1. Add `useEffect` to fetch `GET /api/companies`
2. Add company dropdown to edit form (between role and status selects)
3. On submit: After `usersAPI.update()`, call `usersCompanyAPI.assignCompany(userId, companyId)` if company selected
4. Add "Company" column to user table showing user's assigned company

**API**: Uses existing `usersCompanyAPI.assignCompany()` from `registration-api.ts`.

### Section 3: Backend

No changes needed. All endpoints already support the required operations:
- `GET /api/companies` — list companies
- `PATCH /api/users/{id}/company` — assign company to user

## Files Modified

- `pacta_appweb/src/components/auth/LoginForm.tsx` — company dropdown + fetch
- `pacta_appweb/src/pages/UsersPage.tsx` — company dropdown in edit form + table column

## Files Used (no changes)

- `pacta_appweb/src/lib/registration-api.ts` — `usersCompanyAPI.assignCompany()` already exists
- `internal/handlers/approvals.go` — `HandleUserCompany` already implemented
- `internal/handlers/companies.go` — `HandleCompanies` GET already implemented
