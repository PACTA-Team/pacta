# Design: Fix All Remaining TypeScript Errors

> **Goal:** Eliminate all 24 remaining TypeScript errors to achieve a clean `tsc --noEmit` build.

---

## Section 1: motion-dom Variants — Proper typing (11 errors)

**Problem:** Animation variants in `ForbiddenPage.tsx` and `NotFoundPage.tsx` use `ease: string` and `type: string` which are incompatible with motion-dom v12's `Variants` type that expects `Easing` and `AnimationGeneratorType` literal types.

**Solution:** Import `Variants` from `framer-motion` and type each variant object explicitly. Use `as const` on literal values within the typed objects so TypeScript infers the correct literal types.

```typescript
import { type Variants } from 'framer-motion';

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.5, ease: 'easeInOut' as const } 
  },
};
```

**Files:** `ForbiddenPage.tsx` (5 variants), `NotFoundPage.tsx` (6 variants)

---

## Section 2: number vs string mismatches in Reports (7 errors)

**Problem:** `getContractInfo()` expects `string` but receives `number` (contract_id). `SupplementsReport.tsx` accesses `contract_id` on a mapped object that has `contractId`.

**Solution:**
- Change `getContractInfo` signature to accept `number | string`
- Fix `SupplementsReport.tsx` lines 306/308: change `c.contract_id` to `c.contractId`

**Files:** `ModificationsReport.tsx` (2 fixes), `SupplementsReport.tsx` (5 fixes)

---

## Section 3: unknown type in API calls (2 errors)

**Problem:** `contractsAPI.list()` returns `unknown` in contexts where TypeScript can't infer the generic type.

**Solution:** Add explicit type casts where the API result is consumed.

**Files:** `DocumentsPage.tsx` (1 fix), `SupplementsPage.tsx` (1 fix)

---

## Section 4: Other errors (4 errors)

**SupplementForm.tsx (32):** Use `e.currentTarget` instead of `e.target` for form submit handler.

**UsersPage.tsx (345, 362):** Change `disabled={currentUser && ...}` to `disabled={currentUser ? ... : false}` to avoid `null` return.

---

## Summary

| Category | Errors | Files | Fix Type |
|----------|--------|-------|----------|
| motion-dom Variants | 11 | 2 | Type annotations |
| number vs string | 7 | 2 | Signature + property name |
| unknown type | 2 | 2 | Type casts |
| Other | 4 | 2 | Small fixes |
| **Total** | **24** | **8** | — |
