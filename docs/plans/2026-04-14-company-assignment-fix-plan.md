# Company Assignment Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add company selection to registration form and company assignment to user edit form.

**Architecture:** Frontend-only changes. Registration form fetches companies and shows dropdown + "Other" text input. Users page edit form adds company dropdown and calls assignCompany API on submit. Backend already supports all required endpoints.

**Tech Stack:** React + TypeScript, shadcn/ui Select/Input components, fetch API

---

### Task 1: Registration Form — Company Dropdown

**Files:**
- Modify: `pacta_appweb/src/components/auth/LoginForm.tsx`

**Step 1: Read the full file**

Read `/home/mowgli/pacta/pacta_appweb/src/components/auth/LoginForm.tsx` completely.

**Step 2: Add state and fetch companies**

Add these state variables after existing ones:
```tsx
const [companies, setCompanies] = useState<{id: number, name: string}[]>([]);
const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
```

Add useEffect after the existing state declarations:
```tsx
useEffect(() => {
  if (showRegister) {
    fetch('/api/companies', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]));
  }
}, [showRegister]);
```

Add `useEffect` to imports at top:
```tsx
import { useState, useEffect } from 'react';
```

**Step 3: Replace the conditional company field**

Replace this block:
```tsx
{registrationMode === 'approval' && (
  <div className="space-y-2">
    <Label htmlFor="company">Company Name</Label>
    <Input
      id="company"
      placeholder="Your company name"
      value={companyName}
      onChange={(e) => setCompanyName(e.target.value)}
      required
    />
  </div>
)}
```

With:
```tsx
<div className="space-y-2">
  <Label htmlFor="company">Company</Label>
  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
    <SelectTrigger>
      <SelectValue placeholder="Select your company" />
    </SelectTrigger>
    <SelectContent>
      {companies.map(c => (
        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
      ))}
      <SelectItem value="other">Other (new company)</SelectItem>
    </SelectContent>
  </Select>
  {selectedCompanyId === 'other' && (
    <Input
      id="companyName"
      placeholder="Enter new company name"
      value={companyName}
      onChange={(e) => setCompanyName(e.target.value)}
    />
  )}
</div>
```

Add Select imports at top:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```

**Step 4: Update handleRegister submit logic**

Replace the `handleRegister` function with:
```tsx
const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const companyParam = selectedCompanyId === 'other' ? companyName : undefined;
    const data = await registrationAPI.register(name, email, password, registrationMode, companyParam);
    if (data.status === 'pending_email') {
      setVerificationEmail(email);
      setShowVerification(true);
      toast.info('Verification code sent to your email');
    } else if (data.status === 'pending_approval') {
      toast.success('Registration submitted. An admin will review your request.');
      setShowRegister(false);
      setName('');
      setEmail('');
      setPassword('');
      setCompanyName('');
      setSelectedCompanyId('');
    } else {
      toast.success(t('registerSuccess'));
      setShowRegister(false);
      setName('');
      setEmail('');
      setPassword('');
      setCompanyName('');
      setSelectedCompanyId('');
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('registerError'));
  }
};
```

**Step 5: Reset state when toggling register form**

In the "Back to Login" button onClick, add reset:
```tsx
onClick={() => {
  setShowRegister(false);
  setCompanyName('');
  setSelectedCompanyId('');
}}
```

**Step 6: Commit**

```bash
cd /home/mowgli/pacta/pacta_appweb
git add src/components/auth/LoginForm.tsx
git commit -m "feat: add company dropdown to registration form with existing/new option"
```

---

### Task 2: Users Page — Company Assignment in Edit Form

**Files:**
- Modify: `pacta_appweb/src/pages/UsersPage.tsx`
- Modify: `pacta_appweb/src/lib/users-api.ts` (add assignCompany if not present)

**Step 1: Read the files**

Read `/home/mowgli/pacta/pacta_appweb/src/pages/UsersPage.tsx` and `/home/mowgli/pacta/pacta_appweb/src/lib/users-api.ts` completely.

**Step 2: Add assignCompany to users-api.ts if missing**

Check if `usersCompanyAPI` or `assignCompany` exists in `users-api.ts`. If not, add:
```typescript
export const usersCompanyAPI = {
  assignCompany: (userId: number, companyId: number) =>
    fetchJSON(`/api/users/${userId}/company`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
    }),
};
```

**Step 3: Add state and fetch companies in UsersPage**

Add state after existing states:
```tsx
const [companies, setCompanies] = useState<{id: number, name: string}[]>([]);
const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
```

Add useEffect to fetch companies:
```tsx
useEffect(() => {
  fetch('/api/companies', { credentials: 'include' })
    .then(r => r.json())
    .then(data => setCompanies(Array.isArray(data) ? data : []))
    .catch(() => {});
}, []);
```

**Step 4: Update handleEdit to load user's company**

In `handleEdit`, after setting formData, add:
```tsx
// Fetch user's current company
fetch(`/api/users/me/companies`, { credentials: 'include' })
  .then(r => r.json())
  .then(data => {
    if (Array.isArray(data) && data.length > 0) {
      setSelectedCompanyId(data[0].company_id);
    }
  })
  .catch(() => {});
```

**Step 5: Update handleSubmit to assign company**

In `handleSubmit`, after the existing update/create logic, add:
```tsx
if (editingUser && selectedCompanyId) {
  try {
    await usersCompanyAPI.assignCompany(editingUser.id, selectedCompanyId);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to assign company');
  }
}
```

**Step 6: Update resetForm**

Add to `resetForm`:
```tsx
setSelectedCompanyId(null);
```

**Step 7: Add company dropdown to edit form**

In the edit form, between the role Select and status Select (inside the `grid grid-cols-2 gap-4` div), add a third column or place below:

```tsx
<div className="space-y-2">
  <Label htmlFor="company">Company</Label>
  <Select
    value={selectedCompanyId?.toString() || ''}
    onValueChange={(v) => setSelectedCompanyId(parseInt(v))}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select company" />
    </SelectTrigger>
    <SelectContent>
      {companies.map(c => (
        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 8: Add Company column to user table**

Add "Company" header after Status:
```tsx
<TableHead>Company</TableHead>
```

Add company cell in the row mapping:
```tsx
<TableCell>{getUserCompany(user.id)}</TableCell>
```

Add helper function before getRoleBadge:
```tsx
const getUserCompany = (userId: number): string => {
  // For now, show "—" since we need a separate API call per user
  // This can be optimized later with a batch endpoint
  return '—';
};
```

**Step 9: Commit**

```bash
cd /home/mowgli/pacta/pacta_appweb
git add src/pages/UsersPage.tsx src/lib/users-api.ts
git commit -m "feat: add company assignment to user edit form"
```

---

## Summary

**Total Tasks**: 2
**Files Modified**: 3 (`LoginForm.tsx`, `UsersPage.tsx`, `users-api.ts`)
**Backend Changes**: None needed

**Testing**: Manual testing via browser:
1. Register new user → see company dropdown → select existing or type new → verify company assigned
2. Admin edits user → see company dropdown → change company → verify user can login
