# Fix All TypeScript Errors — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all 24 remaining TypeScript errors to achieve a clean `tsc --noEmit` build.

**Architecture:** Fix errors in four categories: motion-dom variant typing, number/string mismatches in reports, unknown type casts, and small misc fixes. Each fix is minimal and targeted.

**Tech Stack:** TypeScript, React, framer-motion (Variants type)

---

## Task 1: Fix motion-dom Variants in ForbiddenPage.tsx (5 errors)

**Files:**
- Modify: `pacta_appweb/src/pages/ForbiddenPage.tsx` (lines ~55-105)

**Step 1: Read the file to find all variant definitions**

Run: `grep -n "Variants\|const.*Variants\|hidden:\|visible:" pacta_appweb/src/pages/ForbiddenPage.tsx`

**Step 2: Add Variants import and type all variant objects**

At the top of the file, add `type Variants` to the framer-motion import:
```typescript
import { motion, type Variants } from 'framer-motion';
```

Find all variant definition blocks and add `: Variants` type annotation plus `as const` on transition properties. The pattern for each:

```typescript
const containerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, rotate: -5 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 200, damping: 15, delay: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeInOut' as const },
  },
};
```

Apply this to all 5 variant objects in the file.

**Step 3: Verify no errors remain**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "ForbiddenPage"`
Expected: No output (zero errors)

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/ForbiddenPage.tsx
git commit -m "fix: type motion variants with Variants type in ForbiddenPage"
```

---

## Task 2: Fix motion-dom Variants in NotFoundPage.tsx (6 errors)

**Files:**
- Modify: `pacta_appweb/src/pages/NotFoundPage.tsx` (lines ~100-190)

**Step 1: Read the file to find all variant definitions**

Run: `grep -n "Variants\|const.*Variants\|hidden:\|visible:" pacta_appweb/src/pages/NotFoundPage.tsx`

**Step 2: Add Variants import and type all variant objects**

Same pattern as Task 1. Add `type Variants` to framer-motion import and type all 6 variant objects:

```typescript
import { motion, type Variants } from 'framer-motion';
```

Type each variant object with `: Variants` and add `as const` on `type` and `ease` literals within transition objects.

**Step 3: Verify no errors remain**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "NotFoundPage"`
Expected: No output (zero errors)

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/NotFoundPage.tsx
git commit -m "fix: type motion variants with Variants type in NotFoundPage"
```

---

## Task 3: Fix number vs string mismatches in ModificationsReport.tsx (2 errors)

**Files:**
- Modify: `pacta_appweb/src/components/reports/ModificationsReport.tsx` (lines ~68, ~84, ~263)

**Step 1: Read the getContractInfo function**

Run: `sed -n '65,72p' pacta_appweb/src/components/reports/ModificationsReport.tsx`

**Step 2: Change getContractInfo signature to accept number | string**

Change:
```typescript
const getContractInfo = (contractId: string) => {
```
To:
```typescript
const getContractInfo = (contractId: number | string) => {
```

And update the find to handle both types:
```typescript
const contract = contracts.find((c: any) => c.id === contractId || c.id === Number(contractId));
```

**Step 3: Verify no errors remain**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "ModificationsReport"`
Expected: No output (zero errors)

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/reports/ModificationsReport.tsx
git commit -m "fix: accept number | string in getContractInfo for ModificationsReport"
```

---

## Task 4: Fix number vs string mismatches in SupplementsReport.tsx (5 errors)

**Files:**
- Modify: `pacta_appweb/src/components/reports/SupplementsReport.tsx` (lines ~64, ~69, ~135, ~306, ~308, ~360)

**Step 1: Read the getContractInfo function and contractData map**

Run: `sed -n '100,115p' pacta_appweb/src/components/reports/SupplementsReport.tsx`
Run: `sed -n '300,315p' pacta_appweb/src/components/reports/SupplementsReport.tsx`

**Step 2: Fix getContractInfo to accept number | string**

Same pattern as Task 3:
```typescript
const getContractInfo = (contractId: number | string) => {
  const contract = contracts.find((c: any) => c.id === contractId || c.id === Number(contractId));
  return contract ? `${contract.contract_number || contract.contractNumber} - ${contract.title}` : 'Unknown Contract';
};
```

**Step 3: Fix contract_id vs contractId on lines 306/308**

In the JSX where rendering supplements by contract, change `c.contract_id` to `c.contractId` (the mapped object uses `contractId` as the key).

**Step 4: Verify no errors remain**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "SupplementsReport"`
Expected: No output (zero errors)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/reports/SupplementsReport.tsx
git commit -m "fix: fix number/string mismatches and contract_id vs contractId in SupplementsReport"
```

---

## Task 5: Fix unknown type in DocumentsPage.tsx (1 error)

**Files:**
- Modify: `pacta_appweb/src/pages/DocumentsPage.tsx` (line ~46)

**Step 1: Read the line**

Run: `sed -n '44,50p' pacta_appweb/src/pages/DocumentsPage.tsx`

**Step 2: Add type cast**

Change:
```typescript
const contracts = await contractsAPI.list();
```
To:
```typescript
const contracts = await contractsAPI.list() as any[];
```

**Step 3: Verify**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "DocumentsPage"`
Expected: No output

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/DocumentsPage.tsx
git commit -m "fix: add type cast for contractsAPI.list() in DocumentsPage"
```

---

## Task 6: Fix unknown type in SupplementsPage.tsx (1 error)

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx` (line ~53)

**Step 1: Read the line**

Run: `sed -n '50,56p' pacta_appweb/src/pages/SupplementsPage.tsx`

**Step 2: Add type cast**

Change:
```typescript
setContracts(contrs);
```
To:
```typescript
setContracts(contrs as any[]);
```

**Step 3: Verify**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "SupplementsPage"`
Expected: No output

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/SupplementsPage.tsx
git commit -m "fix: add type cast for contractsAPI.list() in SupplementsPage"
```

---

## Task 7: Fix SupplementForm.tsx event target (1 error)

**Files:**
- Modify: `pacta_appweb/src/components/supplements/SupplementForm.tsx` (line ~32)

**Step 1: Read the line**

Run: `sed -n '28,36p' pacta_appweb/src/components/supplements/SupplementForm.tsx`

**Step 2: Change e.target to e.currentTarget**

Change:
```typescript
onSubmit={(e) => handleSubmit(e.target as HTMLFormElement)}
```
To:
```typescript
onSubmit={(e) => handleSubmit(e.currentTarget)}
```

Note: `e.currentTarget` is already typed as `HTMLFormElement` when the handler is on a `<form>` element, so no cast needed.

**Step 3: Verify**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "SupplementForm"`
Expected: No output

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/supplements/SupplementForm.tsx
git commit -m "fix: use e.currentTarget instead of e.target in SupplementForm"
```

---

## Task 8: Fix UsersPage.tsx disabled prop (2 errors)

**Files:**
- Modify: `pacta_appweb/src/pages/UsersPage.tsx` (lines ~345, ~362)

**Step 1: Read the lines**

Run: `sed -n '343,348p' pacta_appweb/src/pages/UsersPage.tsx`
Run: `sed -n '360,365p' pacta_appweb/src/pages/UsersPage.tsx`

**Step 2: Fix the disabled expressions**

Change both occurrences from:
```typescript
disabled={currentUser && parseInt(currentUser.id) === user.id}
```
To:
```typescript
disabled={currentUser ? parseInt(currentUser.id) === user.id : false}
```

This ensures the expression always returns `boolean` instead of `boolean | null`.

**Step 3: Verify**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep "UsersPage"`
Expected: No output

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/UsersPage.tsx
git commit -m "fix: fix disabled prop type in UsersPage buttons"
```

---

## Task 9: Full verification — zero errors

**Step 1: Run TypeScript check**

```bash
cd pacta_appweb && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `0`

**Step 2: Run all tests**

```bash
cd pacta_appweb && npm test -- --run
```
Expected: All 41 tests pass

**Step 3: Final commit**

```bash
cd /home/mowgli/pacta
git add .
git commit -m "chore: verify zero TS errors after all fixes"
```

---

## Summary

| Task | Category | Errors Fixed | Files |
|------|----------|-------------|-------|
| 1 | motion-dom ForbiddenPage | 5 | 1 |
| 2 | motion-dom NotFoundPage | 6 | 1 |
| 3 | number/string ModificationsReport | 2 | 1 |
| 4 | number/string SupplementsReport | 5 | 1 |
| 5 | unknown DocumentsPage | 1 | 1 |
| 6 | unknown SupplementsPage | 1 | 1 |
| 7 | event target SupplementForm | 1 | 1 |
| 8 | disabled prop UsersPage | 2 | 1 |
| 9 | Verification | — | — |
| **Total** | | **24** | **8** |
