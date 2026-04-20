# Code Quality Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar mejoras de code quality en el frontend - arreglar empty catch, actualizar tipos a snake_case, crear validation schemas y hooks reutilizables

**Architecture:** Cada task es independiente y entregable. Vertical slicing.

**Tech Stack:** React, TypeScript, Zod, Vitest

---

## Task 1: Fix Empty Catch Block in AuthContext

**Files:**
- Modify: `pacta_appweb/src/contexts/AuthContext.tsx:60-65`

**Step 1: Find the empty catch**

Run: `grep -n "catch {}" pacta_appweb/src/contexts/AuthContext.tsx`

Expected: Line 63

**Step 2: Replace empty catch with error handling**

```typescript
// REEMPLAZAR línea 63:
} catch {}

// CON:
} catch (error) {
  console.warn('Logout API failed:', error);
}
```

**Step 3: Verify**

Run: `grep -n "catch (error)" pacta_appweb/src/contexts/AuthContext.tsx`

Expected: Line with catch (error)

**Step 4: Commit**

```bash
git add pacta_appweb/src/contexts/AuthContext.tsx
git commit -m "fix: add error handling to logout catch block"
```

---

## Task 2: Update Contract Type to snake_case

**Files:**
- Modify: `pacta_appweb/src/types/index.ts:102-128`

**Step 1: Find current Contract type**

Run: `grep -n "export interface Contract" -A 30 pacta_appweb/src/types/index.ts`

**Step 2: Replace Contract interface with snake_case version**

```typescript
// REEMPLAZAR todo el Contract interface (líneas ~102-128) CON:
export interface Contract {
  id: number;
  company_id: number;
  internal_id: string;
  contract_number: string;
  title?: string;
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type: string;
  status: string;
  description?: string;
  object?: string;
  fulfillment_place?: string;
  dispute_resolution?: string;
  has_confidentiality?: boolean;
  guarantees?: string;
  renewal_type?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Verify TypeScript**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | head -20`

Expected: No Contract-related errors

**Step 4: Commit**

```bash
git add pacta_appweb/src/types/index.ts
git commit -m "fix: update Contract type to snake_case matching backend"
```

---

## Task 3: Update Client and Supplier Types to snake_case

**Files:**
- Modify: `pacta_appweb/src/types/index.ts`

**Step 1: Find Client and Supplier interfaces**

Run: `grep -n "export interface Client\|export interface Supplier" -A 15 pacta_appweb/src/types/index.ts`

**Step 2: Replace with snake_case versions**

```typescript
// REEMPLAZAR Client interface CON:
export interface Client {
  id: number;
  company_id: number;
  name: string;
  address?: string;
  reu_code?: string;
  contacts?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// REEMPLAZAR Supplier interface CON:
export interface Supplier {
  id: number;
  company_id: number;
  name: string;
  address?: string;
  reu_code?: string;
  contacts?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/types/index.ts
git commit -m "fix: update Client and Supplier types to snake_case"
```

---

## Task 4: Replace any[] in ContractsPage with Contract Type

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx`

**Step 1: Find all any[] usages**

Run: `grep -n "any\[\]" pacta_appweb/src/pages/ContractsPage.tsx`

Expected: Multiple lines (useState, find operations)

**Step 2: Replace any[] with Contract**

```typescript
// AÑADIR import si no existe:
import type { Contract, Client, Supplier } from '@/types';

// REEMPLAZAR:
// useState<any[]> → useState<Contract[]>
// useState<any[]>([]) → useState<Contract[]>([])
```

**Step 3: Verify TypeScript**

Run: `cd pacta_appweb && npx tsc --noEmit 2>&1 | grep -i contract`

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/ContractsPage.tsx
git commit -m "fix: replace any[] with Contract type in ContractsPage"
```

---

## Task 5: Replace any[] in DashboardPage

**Files:**
- Modify: `pacta_appweb/src/pages/DashboardPage.tsx`

**Step 1: Find any[] usages**

Run: `grep -n "any\[\]" pacta_appweb/src/pages/DashboardPage.tsx`

**Step 2: Replace with proper types**

```typescript
import type { Contract, Client, Supplier } from '@/types';
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/DashboardPage.tsx
git commit -m "fix: replace any[] with proper types in DashboardPage"
```

---

## Task 6: Create Zod Validation Schemas

**Files:**
- Create: `pacta_appweb/src/lib/validation-schemas.ts`

**Step 1: Create validation-schemas.ts**

```typescript
// pacta_appweb/src/lib/validation-schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email requerido').email('Email inválido'),
  password: z.string().min(1, 'Password requerido').min(8, 'Mínimo 8 caracteres'),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').min(2, 'Mínimo 2 caracteres'),
  email: z.string().min(1, 'Email requerido').email('Email inválido'),
  password: z.string().min(1, 'Password requerido').min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords no coinciden",
  path: ['confirmPassword'],
});

export const contractSchema = z.object({
  client_id: z.number().positive('Cliente requerido'),
  supplier_id: z.number().positive('Proveedor requerido'),
  contract_number: z.string().min(1, 'Número requerido'),
  start_date: z.string().min(1, 'Fecha inicio requerida'),
  end_date: z.string().min(1, 'Fecha fin requerida'),
  amount: z.number().nonnegative(),
  type: z.enum(['compraventa', 'suministro', 'prestacion_servicios', 'arrendamiento', 'otro']),
  status: z.enum(['draft', 'pending', 'active', 'expired', 'cancelled']),
});
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/validation-schemas.ts
git commit -m "feat: add Zod validation schemas"
```

---

## Task 7: Create useListFilter Hook

**Files:**
- Create: `pacta_appweb/src/hooks/use-list-filter.ts`

**Step 1: Create the hook**

```typescript
// pacta_appweb/src/hooks/use-list-filter.ts
import { useMemo } from 'react';

export interface FilterConfig<T> {
  search?: { term: string; fields: (keyof T)[] };
  filters?: Record<string, string | null>;
}

export function useListFilter<T>(items: T[], config: FilterConfig<T>): T[] {
  return useMemo(() => {
    let result = [...items];
    
    if (config.search?.term) {
      const term = config.search.term.toLowerCase();
      result = result.filter(item =>
        config.search!.fields.some(field => {
          const value = item[field];
          return String(value).toLowerCase().includes(term);
        })
      );
    }
    
    if (config.filters) {
      Object.entries(config.filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          result = result.filter(item => 
            String(item[key as keyof T]) === value
          );
        }
      });
    }
    
    return result;
  }, [items, config]);
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/hooks/use-list-filter.ts
git commit -m "feat: add useListFilter hook"
```

---

## Task 8: Create Constants File

**Files:**
- Create: `pacta_appweb/src/lib/constants.ts`

**Step 1: Create constants.ts**

```typescript
// pacta_appweb/src/lib/constants.ts
export const APP_CONFIG = {
  TOAST: { LIMIT: 1, REMOVE_DELAY_MS: 1000000 },
  BREAKPOINTS: { MOBILE: 768, TABLET: 1024, DESKTOP: 1280 },
  PAGINATION: { DEFAULT_PAGE_SIZE: 25, MAX_PAGE_SIZE: 100 },
} as const;

export const CONTRACT_STATUSES = ['draft', 'pending', 'active', 'expired', 'cancelled'] as const;
export const CONTRACT_TYPES = ['compraventa', 'suministro', 'prestacion_servicios', 'arrendamiento', 'otro'] as const;
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/constants.ts
git commit -m "feat: add constants file"
```

---

## Task 9: Add useMemo to filterContracts

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx`

**Step 1: Find filter function**

Run: `grep -n "filtered" pacta_appweb/src/pages/ContractsPage.tsx | head -10`

**Step 2: Wrap with useMemo**

```typescript
import { useMemo } from 'react';

// REEMPLAZAR la lógica de filtering con:
const filteredContracts = useMemo(() => {
  let result = [...contracts];
  // ... existing filtering logic
  return result;
}, [contracts, searchTerm, statusFilter, typeFilter, partyFilter, user?.company_id]);
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/ContractsPage.tsx
git commit -m "perf: add useMemo to filterContracts"
```

---

## Checkpoint: Tasks 1-9 Complete

- [ ] Tasks committed
- [ ] Run build: `cd pacta_appweb && npm run build`
- [ ] No TypeScript errors
- [ ] All types use snake_case matching backend
