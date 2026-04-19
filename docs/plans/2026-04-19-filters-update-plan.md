# Filters Update Implementation Plan - Contract & Supplement Types

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update frontend filters to match backend taxonomy (Decreto 310) for contracts and supplements, plus filters by client/supplier type.

**Architecture:** Update TypeScript types and React components to match Go backend enum values. Add party type filter (client/supplier).

**Tech Stack:** React, TypeScript, TailwindCSS

---

## Context

### Backend Contract Types (Decreto 310 - 16 types)
- `compraventa` - Compraventa
- `suministro` - Suministro
- `permuta` - Permuta
- `donacion` - Donación
- `deposito` - Depósito
- `prestacion_servicios` - Prestación de Servicios
- `agencia` - Agencia
- `comision` - Comisión
- `consignacion` - Consignación
- `comodato` - Comodato
- `arrendamiento` - Arrendamiento
- `leasing` - Leasing
- `cooperacion` - Cooperación
- `administracion` - Administración
- `transporte` - Transporte
- `otro` - Otro

### Backend Supplement Types
- `modificacion` - Modificación
- `prorroga` - Prórroga
- `concrecion` - Concreción

### Filter Requirements
1. Filter contracts by type (Decreto 310 taxonomy)
2. Filter contracts by party type (client contracts vs supplier contracts)
3. Filter supplements by modification type

---

## Task 1: Update Contract Type Filter in ContractsPage (16 types)

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx`
- Modify: `pacta_appweb/src/types/index.ts`
- Modify: `pacta_appweb/src/lib/contracts-api.ts` (Go backend)

**Step 1: Update TypeScript types (16 types)**

Add to types/index.ts:
```typescript
export type ContractType =
  | 'compraventa'
  | 'suministro'
  | 'permuta'
  | 'donacion'
  | 'deposito'
  | 'prestacion_servicios'
  | 'agencia'
  | 'comision'
  | 'consignacion'
  | 'comodato'
  | 'arrendamiento'
  | 'leasing'
  | 'cooperacion'
  | 'administracion'
  | 'transporte'
  | 'otro';
```

**Step 2: Update filter UI options**

Current incorrect options:
```tsx
<SelectItem value="service">Service</SelectItem>
<SelectItem value="purchase">Purchase</SelectItem>
```

Update to (all 16):
```tsx
<SelectContent>
  <SelectItem value="all">All</SelectItem>
  <SelectItem value="compraventa">Compraventa</SelectItem>
  <SelectItem value="suministro">Suministro</SelectItem>
  <SelectItem value="permuta">Permuta</SelectItem>
  <SelectItem value="donacion">Donación</SelectItem>
  <SelectItem value="deposito">Depósito</SelectItem>
  <SelectItem value="prestacion_servicios">Prestación de Servicios</SelectItem>
  <SelectItem value="agencia">Agencia</SelectItem>
  <SelectItem value="comision">Comisión</SelectItem>
  <SelectItem value="consignacion">Consignación</SelectItem>
  <SelectItem value="comodato">Comodato</SelectItem>
  <SelectItem value="arrendamiento">Arrendamiento</SelectItem>
  <SelectItem value="leasing">Leasing</SelectItem>
  <SelectItem value="cooperacion">Cooperación</SelectItem>
  <SelectItem value="administracion">Administración</SelectItem>
  <SelectItem value="transporte">Transporte</SelectItem>
  <SelectItem value="otro">Otro</SelectItem>
</SelectContent>
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/ContractsPage.tsx
git commit -m "feat: Update contract type filters to match Decree 310 taxonomy"
```

---

## Task 2: Add Party Type Filter (Client vs Supplier Contracts)

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx`

**Step 1: Add party filter state**

Add after existing filters:
```tsx
const [partyFilter, setPartyFilter] = useState<string>('all');
```

**Step 2: Add party filter Select dropdown**

Add to the filter section:
```tsx
<Select value={partyFilter} onValueChange={setPartyFilter}>
  <SelectTrigger className="w-full sm:w-40">
    <SelectValue placeholder="Party" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Parties</SelectItem>
    <SelectItem value="client">Client Contracts</SelectItem>
    <SelectItem value="supplier">Supplier Contracts</SelectItem>
  </SelectContent>
</Select>
```

**Step 3: Update filter logic**

Add to filterContracts function:
```tsx
if (partyFilter === 'client') {
  filtered = filtered.filter(c => c.client_id === currentUserCompanyId);
} else if (partyFilter === 'supplier') {
  filtered = filtered.filter(c => c.supplier_id === currentUserCompanyId);
}
```

Note: Need to get current user's company ID from auth context. Add:
```tsx
const { user } = useAuth();
const currentCompanyId = user?.company_id;
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/ContractsPage.tsx
git commit -m "feat: Add party type filter (client/supplier contracts)"
```

---

## Task 3: Add Supplement Type Filter

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx`

**Step 1: Add modification type filter state**

Add after existing filters:
```tsx
const [modificationTypeFilter, setModificationTypeFilter] = useState<string>('all');
```

**Step 2: Add filter option in UI**

Add Select dropdown for modification_type:
```tsx
<Select value={modificationTypeFilter} onValueChange={setModificationTypeFilter}>
  <SelectTrigger className="w-full sm:w-40">
    <SelectValue placeholder="Type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Types</SelectItem>
    <SelectItem value="modificacion">Modificación</SelectItem>
    <SelectItem value="prorroga">Prórroga</SelectItem>
    <SelectItem value="concrecion">Concreción</SelectItem>
  </SelectContent>
</Select>
```

**Step 3: Add filter logic**

Add to filteredSupplements useMemo:
```tsx
if (modificationTypeFilter !== 'all') {
  filtered = filtered.filter(s => s.modification_type === modificationTypeFilter);
}
```

**Step 4: Ensure API fetches modification_type**

Verify supplementsAPI.list() includes modification_type field in response.

**Step 5: Commit**

```bash
git add pacta_appweb/src/pages/SupplementsPage.tsx
git commit -m "feat: Add supplement type filter"
```

---

## Task 4: Add Party Type Filter to SupplementsPage

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx`

**Step 1: Add party filter to supplements**

Add supplement party filter (client supplements vs supplier supplements):
```tsx
const [supplementPartyFilter, setSupplementPartyFilter] = useState<string>('all');
```

**Step 2: Add filter UI**

Add to the filters section:
```tsx
<Select value={supplementPartyFilter} onValueChange={setSupplementPartyFilter}>
  <SelectTrigger className="w-full sm:w-40">
    <SelectValue placeholder="Party" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Parties</SelectItem>
    <SelectItem value="client">Client Supplements</SelectItem>
    <SelectItem value="supplier">Supplier Supplements</SelectItem>
  </SelectContent>
</Select>
```

**Step 3: Add filter logic**

The supplements already have contract_id - we need to check the contract's client_id vs supplier_id:
```tsx
if (supplementPartyFilter === 'client') {
  filtered = filtered.filter(s => {
    const contract = contracts.find(c => c.id === s.contract_id);
    return contract?.client_id === currentCompanyId;
  });
} else if (supplementPartyFilter === 'supplier') {
  filtered = filtered.filter(s => {
    const contract = contracts.find(c => c.id === s.contract_id);
    return contract?.supplier_id === currentCompanyId;
  });
}
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/SupplementsPage.tsx
git commit -m "feat: Add party type filter to supplements"
```

---

## Task 5: Update TypeScript Types

**Files:**
- Modify: `pacta_appweb/src/types/index.ts`
- Modify: `pacta_appweb/src/lib/contracts-api.ts`
- Modify: `pacta_appweb/src/lib/supplements-api.ts`

**Step 1: Add contract type enum**

```typescript
export type ContractType =
  | 'prestacion_servicios'
  | 'compraventa'
  | 'arrendamiento'
  | 'cooperacion'
  | 'otro';

export type ContractStatus = 'draft' | 'pending' | 'active' | 'expired' | 'cancelled';
```

**Step 2: Add supplement type enum**

```typescript
export type SupplementModificationType =
  | 'modificacion'
  | 'prorroga'
  | 'concrecion';
```

**Step 3: Update API interfaces**

Add modification_type to Supplement interface in supplements-api.ts and types.

**Step 4: Commit**

```bash
git add pacta_appweb/src/types/index.ts pacta_appweb/src/lib/contracts-api.ts pacta_appweb/src/lib/supplements-api.ts
git commit -m "types: Add contract and supplement type enums matching Decree 310"
```

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-04-19-filters-update-plan.md`. Three execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**3. Plan-to-Issues (team workflow)** - Convert plan tasks to GitHub issues for team distribution

**Which approach?**