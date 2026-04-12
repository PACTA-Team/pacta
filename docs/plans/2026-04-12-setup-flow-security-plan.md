# Setup Flow Security Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the `data.firstRun` bug so fresh installs redirect to `/setup`, and protect `/setup` route from access after setup completion by redirecting to `/403`.

**Architecture:** Backend requires no changes (API already returns correct `needs_setup` field and blocks POST with 403). Frontend needs 3 files modified and 1 created: fix the property name bug in HomePage, add a guard in SetupPage, create a ForbiddenPage, and wire it in App.tsx.

**Tech Stack:** React 19, TypeScript, react-router-dom, fetch API

---

### Task 1: Fix HomePage.tsx `data.firstRun` → `data.needs_setup` bug

**Files:**
- Modify: `pacta_appweb/src/pages/HomePage.tsx:21-27`

**Step 1: Read current file to understand context**

Read `pacta_appweb/src/pages/HomePage.tsx` — the bug is on line 23 where it reads `data.firstRun` but the API returns `data.needs_setup`.

**Step 2: Fix the property name**

Change line 23 from:
```tsx
if (data.firstRun) {
```
to:
```tsx
if (data.needs_setup) {
```

**Step 3: Verify the fix**

The fetch block should now read:
```tsx
fetch('/api/setup/status')
  .then((r) => r.json())
  .then((data) => {
    if (data.needs_setup) {
      navigate('/setup', { replace: true });
    } else {
      setIsSetup(true);
    }
  })
  .catch(() => setIsSetup(true));
```

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/HomePage.tsx
git commit -m "fix: read correct API field 'needs_setup' instead of 'firstRun' in HomePage"
```

---

### Task 2: Create ForbiddenPage.tsx (403 page)

**Files:**
- Create: `pacta_appweb/src/pages/ForbiddenPage.tsx`

**Step 1: Create the ForbiddenPage component**

```tsx
"use client";

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600">403</h1>
        <h2 className="mt-4 text-2xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">
          Setup has already been completed. This page is no longer accessible.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button onClick={() => navigate('/')}>Go to Home</Button>
          <Button variant="outline" onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/ForbiddenPage.tsx
git commit -m "feat: add ForbiddenPage (403) for denied setup access"
```

---

### Task 3: Wire ForbiddenPage in App.tsx

**Files:**
- Modify: `pacta_appweb/src/App.tsx`

**Step 1: Read current App.tsx**

Read `pacta_appweb/src/App.tsx` to find the routes section and import area.

**Step 2: Add import and route**

Add import at top:
```tsx
import ForbiddenPage from './pages/ForbiddenPage';
```

Add route in the Routes section (after `/setup` route):
```tsx
<Route path="/403" element={<ForbiddenPage />} />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/App.tsx
git commit -m "feat: add /403 route for forbidden access"
```

---

### Task 4: Add setup guard to SetupPage.tsx

**Files:**
- Modify: `pacta_appweb/src/pages/SetupPage.tsx`

**Step 1: Read current file**

Read `pacta_appweb/src/pages/SetupPage.tsx` — currently it just renders `<SetupWizard />`.

**Step 2: Add setup status guard**

Replace the entire file content with:

```tsx
"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SetupWizard from '@/components/setup/SetupWizard';

export default function SetupPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        if (!data.needs_setup) {
          navigate('/403', { replace: true });
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [navigate]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">Checking setup status...</p>
        </div>
      </div>
    );
  }

  return <SetupWizard />;
}
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/SetupPage.tsx
git commit -m "feat: guard /setup route — redirect to /403 if setup already completed"
```

---

### Task 5: Verify and push

**Step 1: Verify all changes compile**

```bash
cd /home/mowgli/pacta/pacta_appweb
npx tsc --noEmit 2>&1 | head -20
```

Expected: No type errors (or only pre-existing ones unrelated to our changes).

**Step 2: Commit all changes together if not already committed per task**

**Step 3: Push to remote**

```bash
cd /home/mowgli/pacta
git push origin main
```

Note: If branch protection blocks direct push, create a feature branch, PR, and merge.

---

## Summary

| Task | Action | Files |
|------|--------|-------|
| 1 | Fix `data.firstRun` → `data.needs_setup` bug | `HomePage.tsx` |
| 2 | Create ForbiddenPage component | `ForbiddenPage.tsx` (new) |
| 3 | Add `/403` route | `App.tsx` |
| 4 | Add setup guard to SetupPage | `SetupPage.tsx` |
| 5 | Verify and push | CI/CD |
