# First-Run Setup Flow Security — Design

## Problem

1. **Bug**: `HomePage.tsx` reads `data.firstRun` but API returns `data.needs_setup` — fresh installs don't redirect to `/setup`
2. **Security gap**: `/setup` route is accessible even after setup is completed
3. **No forbidden page**: No `/403` page exists for denied access attempts

## Solution

### Backend — No changes needed
- `GET /api/setup/status` already returns `{"needs_setup": true/false}` correctly
- `POST /api/setup` already returns 403 if setup completed

### Frontend — 3 files modified, 1 created

| File | Change |
|------|--------|
| `src/pages/HomePage.tsx` | Fix `data.firstRun` → `data.needs_setup` |
| `src/pages/SetupPage.tsx` | Add guard: if `needs_setup === false`, redirect to `/403` |
| `src/pages/ForbiddenPage.tsx` | New: simple 403 page with "Setup already completed" |
| `src/App.tsx` | Add `/403` route pointing to ForbiddenPage |

### Flow

```
Fresh install:
  GET / → HomePage → GET /api/setup/status → needs_setup: true → navigate('/setup')
  SetupPage → needs_setup: true → render SetupWizard ✓

After setup (normal visit):
  GET / → HomePage → GET /api/setup/status → needs_setup: false → render LandingPage ✓

After setup (attempt /setup):
  GET /setup → SetupPage → GET /api/setup/status → needs_setup: false → navigate('/403') ✓
  POST /api/setup → backend → 403 "setup has already been completed" ✓

Not authenticated (returning user):
  GET /api/auth/me → 401 → user = null → HomePage renders landing (correct)
  AuthContext: 401 → res.ok=false → data=null → no setUser → no redirect to /setup ✓
```
