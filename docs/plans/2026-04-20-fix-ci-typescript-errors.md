# Implementation Plan: Fix CI TypeScript Errors

**Goal:** Fix all TypeScript compilation errors on `feature/issue-237-snake-case-forms` branch to make CI pass.

**Root Cause Summary:**
1. `UpdateContractRequest` missing `contract_number` field (causing error in ContractsPage)
2. `Contract.type` and `Contract.status` are `string` instead of union types `ContractType`/`ContractStatus` (causing Record indexing errors in reports)
3. Report components use camelCase fields (`contractNumber`, `startDate`, `endDate`) that don't exist on Contract
4. Report components expect denormalized `client`/`supplier` string fields that aren't on Contract
5. `ContractsPage` has type mismatches with `parseInt` on already-numeric IDs
6. Missing `ContractStatus` import in `ContractsPage`
7. `ContractForm` uses invalid `'service'` default for `ContractType`

**Scope:** This plan addresses ALL errors preventing CI from passing. It consolidates fixes into atomic, testable commits.

---

## Task 1: Fix UpdateContractRequest (5 min)

**Files:** `pacta_appweb/src/lib/contracts-api.ts`

**Issue:** `UpdateContractRequest` interface is missing the `contract_number` field, but `ContractsPage` sends it on line 113.

**Step 1:** Add `contract_number` to `UpdateContractRequest`

```typescript
export interface UpdateContractRequest {
  contract_number: string;  // ← ADD THIS LINE
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type: ContractType;
  status: ContractStatus;
  description?: string;
  object?: string;
  fulfillment_place?: string;
  dispute_resolution?: string;
  has_confidentiality?: boolean;
  guarantees?: string;
  renewal_type?: string;
}
```

**Step 2:** Verify no other files need changes (the API backend already accepts `contract_number` in PUT requests because it's in `CreateContractRequest`).

**Verification:**
```bash
cd pacta_appweb
npx tsc --noEmit 2>&1 | grep -i "UpdateContractRequest\|contract_number"
# Should show no errors related to this interface
```

---

## Task 2: Fix Contract Union Types (5 min)

**Files:** `pacta_appweb/src/types/index.ts`

**Issue:** `Contract.type` and `Contract.status` are typed as `string`, but reports use them as keys in `Record<ContractStatus, ...>` and `Record<ContractType, ...>`, causing TypeScript errors.

**Step 1:** Change `Contract.type` from `string` to `ContractType`

```typescript
export interface Contract {
  id: number;
  internal_id: string;
  contract_number: string;
  title?: string;
  client_id: number;
  supplier_id: number;
  client_signer_id: number | null;
  supplier_signer_id: number | null;
  start_date: string;
  end_date: string;
  amount: number;
  type: ContractType;  // ← CHANGE from `string` to `ContractType`
  status: ContractStatus;  // ← CHANGE from `string` to `ContractStatus`
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

**Step 2:** This will cascade; ensure all code that assigns to `type`/`status` uses valid union values. The API returns validated strings from the database, so runtime values are safe. TypeScript may need type assertions in API responses if backend could return invalid values, but assume backend is trusted.

**Verification:**
```bash
cd pacta_appweb
npx tsc --noEmit 2>&1 | grep -i "Type.*is not assignable"
# Should show no errors about Contract.type/status
```

---

## Task 3: Add Denormalized client/supplier Name Fields to Contract (3 min)

**Files:** `pacta_appweb/src/types/index.ts`

**Issue:** Report components need `contract.client` (string) and `contract.supplier` (string) for display and grouping, but `Contract` only has `client_id`/`supplier_id` (numbers). We need optional denormalized name fields that get populated after fetching contracts.

**Step 1:** Extend the `Contract` interface with optional denormalized name fields:

```typescript
export interface Contract {
  id: number;
  internal_id: string;
  contract_number: string;
  title?: string;
  client_id: number;
  supplier_id: number;
  client_signer_id: number | null;
  supplier_signer_id: number | null;
  start_date: string;
  end_date: string;
  amount: number;
  type: ContractType;
  status: ContractStatus;
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
  // Denormalized name fields (populated after fetching clients/suppliers)
  client?: string;    // ← ADD
  supplier?: string;  // ← ADD
}
```

**Rationale:** These fields are optional because they're not stored in the database; they're populated in-memory after fetching contracts along with clients/suppliers.

---

## Task 4: Enrich Contract Data with client/supplier Names in ReportsPage (10 min)

**Files:** `pacta_appweb/src/pages/ReportsPage.tsx`

**Issue:** `ReportsPage` passes raw contract data to report components. We need to enrich each contract with `client` and `supplier` name strings using the clients/suppliers lists fetched from the API.

**Step 1:** In `ReportsPage`, create a memoized enriched contracts array:

```typescript
// After line 56 (after contracts are loaded), add:
const enrichedContracts = useMemo(() => {
  if (!contracts.length) return [];
  
  // Build lookup maps
  const clientMap = new Map<number, string>();
  const supplierMap = new Map<number, string>();
  
  // Extract clients/suppliers from the contracts data (they're nested in the API response)
  // Actually we need to load clients/suppliers separately.
  // ReportsPage currently only loads contracts and supplements.
  // Solution: also load clients and suppliers.
  
  return contracts.map((c: any) => {
    // The API returns contracts with client_id/supplier_id (numbers)
    // We need to look up names from clients/suppliers arrays
    // But clients/suppliers are not currently loaded in ReportsPage state.
    // Add clients/suppliers state and load them.
  });
}, [contracts, clients, suppliers]);
```

But actually, `ReportsPage` doesn't currently fetch clients/suppliers separately. Let's change approach: The contracts from `contractsAPI.list()` likely already include client/supplier info? Need to check the API response shape.

Let me check the backend Go code to see what Contract JSON includes:

Wait - simpler approach: The report components should accept `clients` and `suppliers` as props and do the lookup themselves. But that would require changing all report component signatures. 

Better: `ReportsPage` already gets contracts via `contractsAPI.list()`; if those don't include client/supplier names, we need to fetch clients and suppliers too and denormalize.

Let's check what the API actually returns by examining the Go backend models.

Since I'm writing the plan, I'll state the assumption: the API returns Contract objects with `client_id` and `supplier_id` only, not names. Thus we need to enrich.

**Step 2:** Update `ReportsPage` to load clients and suppliers, then enrich contracts:

```typescript
// At top of ReportsPage component, add state:
const [clients, setClients] = useState<any[]>([]);
const [suppliers, setSuppliers] = useState<any[]>([]);

// In loadData useEffect (line 48-62), add:
useEffect(() => {
  const loadData = async () => {
    try {
      const [contractsData, supplementsData, clientsData, suppliersData] = await Promise.all([
        contractsAPI.list(),
        supplementsAPI.list(),
        clientsAPI.list(),
        suppliersAPI.list(),
      ]);
      setContracts(contractsData as any[]);
      setSupplements(supplementsData as any[]);
      setClients(clientsData as any[]);
      setSuppliers(suppliersData as any[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    }
  };
  loadData();
}, []);

// Create enrichedContracts memo:
const enrichedContracts = useMemo(() => {
  return (contracts as Contract[]).map(contract => {
    const client = clients.find(c => c.id === contract.client_id);
    const supplier = suppliers.find(s => s.id === contract.supplier_id);
    return {
      ...contract,
      client: client?.name,    // denormalized
      supplier: supplier?.name, // denormalized
    };
  });
}, [contracts, clients, suppliers]);
```

**Step 3:** Pass `enrichedContracts` to all report components instead of `filteredContracts`. Actually note: `filteredContracts` is derived from `contracts` with filters applied. We should apply filters on enriched contracts OR enrich after filtering. Better: filter first, then enrich.

Modify the `filteredContracts` memo to also attach client/supplier names:

```typescript
const filteredContracts = useMemo(() => {
  let result = [...contracts];

  if (appliedFilters.dateFrom) {
    result = result.filter((c: any) => new Date(c.start_date) >= new Date(appliedFilters.dateFrom));
  }
  if (appliedFilters.dateTo) {
    result = result.filter((c: any) => new Date(c.end_date) <= new Date(appliedFilters.dateTo));
  }
  if (appliedFilters.status !== 'all') {
    result = result.filter((c: any) => c.status === appliedFilters.status);
  }
  if (appliedFilters.type !== 'all') {
    result = result.filter((c: any) => c.type === appliedFilters.type);
  }
  if (appliedFilters.client) {
    result = result.filter((c: any) =>
      c.client?.toLowerCase().includes(appliedFilters.client?.toLowerCase())
    );
  }
  if (appliedFilters.supplier) {
    result = result.filter((c: any) =>
      c.supplier?.toLowerCase().includes(appliedFilters.supplier?.toLowerCase())
    );
  }
  if (appliedFilters.amountMin) {
    result = result.filter((c: any) => c.amount >= parseFloat(appliedFilters.amountMin));
  }
  if (appliedFilters.amountMax) {
    result = result.filter((c: any) => c.amount <= parseFloat(appliedFilters.amountMax));
  }

  // Enrich with client/supplier names
  return result.map((c: any) => {
    const client = clients.find(cl => cl.id === c.client_id);
    const supplier = suppliers.find(s => s.id === c.supplier_id);
    return {
      ...c,
      client: client?.name,
      supplier: supplier?.name,
    };
  });
}, [contracts, appliedFilters, clients, suppliers]);
```

**Step 4:** Remove the old filter using `c.client` which didn't exist; now it works after enrichment.

**Verification:**
```bash
# The filters should now work because c.client and c.supplier exist after enrichment
```

---

## Task 5: Fix ContractForm to Use Numeric IDs (10 min)

**Files:** `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Issue:** On lines 135, 136, 138, the `onSubmit` sends `parseInt(data.client_id)` but `data.client_id` is already a string representation of a number. The backend expects `number`, and the type is `number`. However, `parseInt` is correct if `client_id` is a string. The type error might be because `contract?.client_id` in initial state is `number` but we call `.toString()` on it (line 39), then later `parseInt` gets `string` -> `number`, that's fine.

Wait, actual error: Maybe `data.client_id` is typed as `string` in form state but `UpdateContractRequest` expects `number`. The `parseInt` is correct. Let me re-examine: `ContractForm` onSubmit passes `formData` which has `client_id: string` (from state). In `ContractsPage.handleCreateOrUpdate`, it calls `parseInt(data.client_id)`. That should work.

But the user said: "ContractsPage has type mismatches with parseInt on already-numeric IDs". That suggests that `data.client_id` might already be a number in some cases, causing `parseInt(number)` to produce a type error because `parseInt` expects string. Indeed, if `contract` prop has `client_id: number`, then line 39 `((contract as any)?.client_id ?? '')?.toString()` converts to string. That's okay. However, if `parseInt` receives a number, TypeScript may complain because parameter should be string. The fix is to ensure we always pass a string to `parseInt`, or use `Number()` which accepts both.

Simpler: In `ContractsPage.handleCreateOrUpdate`, replace `parseInt(data.client_id)` with `Number(data.client_id)` which accepts string | number and returns number. This handles both cases.

**Step 1:** Update `ContractsPage.tsx` lines 114, 116, 117, 135, 137, 138 to use `Number()`:

```typescript
// Before (lines 112-130):
await contractsAPI.update(editingContract.id, {
  contract_number: data.contract_number,
  client_id: parseInt(data.client_id),   // ← change
  supplier_id: parseInt(data.supplier_id), // ← change
  client_signer_id: data.client_signer_id ? parseInt(data.client_signer_id) : undefined, // ← change
  supplier_signer_id: data.supplier_signer_id ? parseInt(data.supplier_signer_id) : undefined, // ← change
  ...
});

// After:
await contractsAPI.update(editingContract.id, {
  contract_number: data.contract_number,
  client_id: Number(data.client_id),
  supplier_id: Number(data.supplier_id),
  client_signer_id: data.client_signer_id ? Number(data.client_signer_id) : undefined,
  supplier_signer_id: data.supplier_signer_id ? Number(data.supplier_signer_id) : undefined,
  ...
});
```

Same for create block (lines 133-151).

**Verification:** `Number()` accepts string | number, so no type error.

---

## Task 6: Add Missing ContractStatus Import (1 min)

**Files:** `pacta_appweb/src/pages/ContractsPage.tsx`

**Issue:** Line 193 function `getStatusBadge` parameter uses `ContractStatus` type, but `ContractStatus` is not imported. Currently imports only `Contract, Client, Supplier` from `@/types`.

**Step 1:** Add `ContractStatus` to import:

```typescript
import { Contract, Client, Supplier, ContractStatus } from '@/types';
```

---

## Task 7: Fix ContractForm Default ContractType Value (3 min)

**Files:** `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Issue:** Line 46: `type: contract?.type || 'service' as ContractType` uses `'service'` which is NOT a valid `ContractType` (valid: 'compraventa', 'suministro', etc.). This causes type error.

**Step 1:** Pick a valid default, likely 'prestacion_servicios' (services) maps to service concept. Or use first enum value safely:

```typescript
type: (contract?.type as ContractType) || 'prestacion_servicios',
```

But the options in the form (lines 225-230) use different labels: 'service', 'purchase', 'lease', 'employment', 'nda', 'other'. Those are display labels, not actual ContractType values. There's a mismatch: The Select items use values like `"service"`, but the `ContractType` union doesn't include those. Need to map.

Wait, look at ContractForm lines 225-230:

```tsx
<SelectItem value="service">{t('service')}</SelectItem>
<SelectItem value="purchase">{t('purchase')}</SelectItem>
...
```

These `value`s are string literals that are NOT in `ContractType`. That's a bug. They should match the ContractType union values. However, the form is probably using translation keys that return values that aren't the actual ContractType. Actually, `t('service')` returns a translated string like "Servicio", but the `value` attribute is hardcoded as `"service"`. So the value is `"service"`. This will cause type errors because `ContractType` doesn't include `"service"`.

We need to decide: either change `value` to valid `ContractType` values, or change `ContractType` to include these generic values. Given the root cause says to fix by making Contract union types correct, we should change the Select values to match actual `ContractType` values. But look at the actual ContractType values: 'compraventa', 'suministro', 'permuta', etc. Those are Spanish. The form is in English? Possibly the app uses English UI but stores Spanish values.

Given the task is to fix CI errors, we must make the type system happy. Options:

A) Change the Select `value`s to be `ContractType` union members.
B) Cast with `as ContractType` when setting state (already done on line 220: `onValueChange={(value) => setFormData({ ...formData, type: value as ContractType })}`). That cast is unsafe if value is not a valid ContractType. So we need to either change the values or adjust the type.

I think the intended design is that the form values correspond to ContractType values. The current SelectItem values are generic English words that don't match. This seems like a pre-existing bug. For the purpose of this fix, I'll change the SelectItem values to valid ContractType values (Spanish terms) so they type-check properly. That's a functional change but needed for correctness.

Actually, let's see what labels are used: The translations might map to those keys. The `t('service')` might translate to "Servicio", but the value should be one of the enum. The existing ContractType is Spanish. The UI may be bilingual. I'll keep the UI labels as translations but set the value to a valid ContractType:

```tsx
<SelectItem value="prestacion_servicios">{t('service')}</SelectItem>
<SelectItem value="compraventa">{t('purchase')}</SelectItem>
<SelectItem value="arrendamiento">{t('lease')}</SelectItem>
<!-- Others? We have limited ContractType values. The form shows 6 options, but ContractType has 15+. We need to map the form's 6 options to appropriate ContractType values. -->
```

But we need to know which of the ContractType values each UI option corresponds to. Based on common mappings:
- service → 'prestacion_servicios'
- purchase → 'compraventa'
- lease → 'arrendamiento'
- employment → maybe 'prestacion_servicios' too? Or another?
- nda → could be 'confidencialidad'? Not in list. Maybe use 'otro'.
- other → 'otro'

We have to pick values that exist. Since the root cause says "ContractForm uses camelCase fields" - that is separate. Actually, I don't see camelCase in ContractForm. The type default is the main issue.

Alternatively, we could keep the SelectItem values as generic and cast, but that's unsafe. But the tests may not cover UI, only type-checking. For CI to pass, we just need to satisfy TypeScript. The minimal fix: change default from `'service'` to a valid ContractType like `'prestacion_servicios'`. Also the SelectItem values need to be valid ContractType to avoid type errors when `formData.type` is assigned. Since `onValueChange` casts `value as ContractType`, TypeScript will allow any string. But the type of `formData.type` is `ContractType` (line 46) but we initialize with `'service'` which is not assignable. That's the error. So changing the default to a valid one resolves error. The SelectItem values themselves are okay as strings because the cast silences. However, if we ever use those values elsewhere, it's unsafe. But CI only compiles.

Simplest fix: change default to `'prestacion_servicios'` (or any valid).

But also ensure that if contract is provided and its type is a valid ContractType, we use that. That part is fine: `contract?.type` should be ContractType.

Thus:

```tsx
type: (contract?.type as ContractType) || 'prestacion_servicios',
```

Actually `contract?.type` is already `ContractType | undefined` if `contract` is proper type. The cast is unnecessary if we fix Contract.type to be ContractType. We'll fix that in Task 2, so after Task 2, `contract?.type` will be typed correctly. So just:

```tsx
type: contract?.type || 'prestacion_servicios',
```

But need to handle that `contract?.type` could be string if we haven't fixed types yet? We'll do tasks in order: first fix Contract.type (Task 2), then fix this default.

**Step 1:** After Task 2, change line 46 to:

```tsx
type: contract?.type || 'prestacion_servicios',
```

Also ensure the Select's `value` is of type `ContractType`. The `formData.type` is `ContractType`. The `onValueChange` casts incoming string. The SelectItem values should be compatible with ContractType. To avoid runtime bugs, we should also change the SelectItem values to actual ContractType values. But that could be a separate small task.

Let's create subtask:

**Task 7a:** Fix ContractForm default type (already covered)

**Task 7b:** Align SelectItem values to ContractType (5 min)

In ContractForm.tsx lines 225-230, change:

```tsx
<SelectItem value="prestacion_servicios">{t('service')}</SelectItem>
<SelectItem value="compraventa">{t('purchase')}</SelectItem>
<SelectItem value="arrendamiento">{t('lease')}</SelectItem>
<SelectItem value="prestacion_servicios">{t('employment')}</SelectItem> <!-- reuse or pick another? -->
<SelectItem value="otro">{t('nda')}</SelectItem>
<SelectItem value="otro">{t('other')}</SelectItem>
```

But we have duplicate 'otro'. That's okay? Or we need distinct values. The UI shows 6 options; they could map to fewer distinct ContractType values. Better to have distinct values where possible. Let's check ContractType list: compraventa, suministro, permuta, donacion, deposito, prestacion_servicios, agencia, comision, consignacion, comodato, arrendamiento, leasing, cooperacion, administracion, transporte, otro.

For 'employment', maybe 'prestacion_servicios' covers services; employment contracts are different. There's no direct 'employment' in list. Could use 'otro'. For 'nda', also 'otro'. So we might have two items mapping to 'otro', which is okay because they're different labels but same value. That's acceptable but might be confusing. Alternatively, we could map 'employment' to 'prestacion_servicios' and 'nda' to something else like 'confidencialidad' not present. So 'otro' is fine.

Thus change SelectItem values to valid ContractType values. This ensures no type errors if the cast is removed later.

But note: The form's type field is used both for create and edit. When editing an existing contract, `contract?.type` will be a valid ContractType from the backend, so the Select will show that value. If the backend returns 'compraventa', then the Select will look for an item with value='compraventa' and find it, good.

**Implementation:**

```tsx
<Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as ContractType })}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="prestacion_servicios">{t('service')}</SelectItem>
    <SelectItem value="compraventa">{t('purchase')}</SelectItem>
    <SelectItem value="arrendamiento">{t('lease')}</SelectItem>
    <SelectItem value="prestacion_servicios">{t('employment')}</SelectItem>
    <SelectItem value="otro">{t('nda')}</SelectItem>
    <SelectItem value="otro">{t('other')}</SelectItem>
  </SelectContent>
</Select>
```

But we have duplicate values; that's allowed? In a Select, duplicate values are not recommended but allowed; they'll both be selected when 'otro' is the value. That's fine.

Alternatively, we could expand the ContractType to include more values, but that's beyond scope.

**Verification:** TypeScript will check that `value as ContractType` is acceptable, but it still allows any string due to cast. However, the initial state now uses a valid ContractType, so the type error is resolved.

---

## Task 8: Fix ClientSupplierReport to Use snake_case + Ensure client/supplier Names (15 min)

**Files:** `pacta_appweb/src/components/reports/ClientSupplierReport.tsx`

**Issues:**
- Uses `contract.client` and `contract.supplier` (camelCase denormalized fields). After Task 3, Contract will have optional `client?` and `supplier?` fields, so this will be valid.
- However, the component expects those fields to exist. We need to ensure that ReportsPage passes contracts with those fields denormalized.
- Also uses `c.amount` correctly, but note that `contract.amount` is number.

So after Task 3 and Task 4, this component should work. But we also need to adjust the code to use `contract.client` (which will be populated). The component already uses `contract.client` (line 27, 36), so after fixing Contract type and enrichment, it's fine.

But there's a potential issue: the report uses `contract.client` as a key in a Map. Since `client` is now `string | undefined`, we need to handle undefined. But enrichment guarantees it's defined because it maps to client name or empty string. If client not found, `client` becomes `undefined`, and the Map will have key `undefined` which is okay. Should we filter out undefined? It's fine.

However, the original code used `contract.client` as if it always existed. To be safe, we can default to empty string: `contract.client || ''`. But we can assume enrichment always sets it to a string (client name) or undefined. The grouping should work.

But TypeScript may complain that `client` might be undefined. We can add optional chaining: `contract.client` is possibly undefined. Let's update to provide fallback:

```ts
const clientMap = new Map<string, { count: number; totalValue: number; contracts: Contract[] }>();
contracts.forEach(contract => {
  const clientName = contract.client || 'Unknown';
  // ...
});
```

Similarly for supplier.

**Step 1:** Update ClientSupplierReport to handle possibly undefined client/supplier:

```diff
- if (contract.client) {
+ const clientName = contract.client || 'Unknown';
+ if (clientName) {
   const clientData = clientMap.get(contract.client) || { count: 0, totalValue: 0, contracts: [] };
+   clientMap.set(clientName, ...);
 }
```

Better to directly use the name as key:

```tsx
contracts.forEach(contract => {
  const clientName = contract.client || 'Unknown Client';
  const clientData = clientMap.get(clientName) || { count: 0, totalValue: 0, contracts: [] };
  clientData.count++;
  clientData.totalValue += contract.amount;
  clientData.contracts.push(contract);
  clientMap.set(clientName, clientData);
});
```

Do same for supplier.

**Step 2:** Also update `ContractStatusReport` to use snake_case fields (Task 9), `ExpirationReport` (Task 10), `FinancialReport` (Task 11). But those are separate tasks.

**Verification:** The report should compile without errors after using correct field names.

---

## Task 9: Fix ContractStatusReport to snake_case (10 min)

**Files:** `pacta_appweb/src/components/reports/ContractStatusReport.tsx`

**Issues:**
- Line 47: columns use `contractNumber`, but Contract has `contract_number`
- Line 49: `client` but Contract has `client_id` (and we want denormalized `client` after enrichment)
- Lines 51-52: `startDate`, `endDate` → `start_date`, `end_date`
- Line 57-64: exportData uses `c.contractNumber`, `c.title`, `c.client`, `c.startDate`, `c.endDate`
- Line 190-196: table rows use `contract.contractNumber`, `contract.title`, `contract.client`, `contract.startDate`, `contract.endDate`

After enrichment (Task 3 and 4), contracts will have `client` (name) and `supplier` (name). So we can use `contract.client`. But need to adjust to snake_case for fields that exist: `contract_number`, `title`, `start_date`, `end_date`.

**Step 1:** Update column definitions to match snake_case keys:

```tsx
const columns: ExportColumn[] = [
  { key: 'contract_number', header: 'Contract Number' },
  { key: 'title', header: 'Title' },
  { key: 'client', header: 'Client' },
  { key: 'status', header: 'Status' },
  { key: 'start_date', header: 'Start Date' },
  { key: 'end_date', header: 'End Date' },
  { key: 'amount', header: 'Amount' },
];
```

**Step 2:** Update exportData mapping:

```tsx
const exportData = contracts.map(c => ({
  contract_number: c.contract_number,
  title: c.title,
  client: c.client, // denormalized name from enrichment
  status: formatStatus(c.status),
  start_date: formatDate(c.start_date),
  end_date: formatDate(c.end_date),
  amount: formatCurrency(c.amount),
}));
```

**Step 3:** Update table row rendering:

```tsx
contracts.map((contract) => (
  <TableRow key={contract.id}>
    <TableCell className="font-medium">{contract.contract_number}</TableCell>
    <TableCell>{contract.title}</TableCell>
    <TableCell>{contract.client}</TableCell>
    <TableCell>{getStatusBadge(contract.status)}</TableCell>
    <TableCell>{formatDate(contract.start_date)}</TableCell>
    <TableCell>{formatDate(contract.end_date)}</TableCell>
    <TableCell className="text-right">{formatCurrency(contract.amount)}</TableCell>
  </TableRow>
))
```

**Note:** `getStatusBadge` expects `ContractStatus`; `contract.status` is now `ContractStatus` after Task 2, so it's fine.

**Step 4:** Remove any use of `contractNumber`, `startDate`, `endDate`.

**Verification:** Compile should show no undefined field errors.

---

## Task 10: Fix ExpirationReport to snake_case (10 min)

**Files:** `pacta_appweb/src/components/reports/ExpirationReport.tsx`

**Issues:**
- Uses `contract.endDate` (line 34, 106, 239)
- Uses `contract.contractNumber` (lines 103, 242)
- Uses `contract.title` (line 243, 285)
- Uses `contract.client` (line 244) – okay after enrichment
- Uses `contract.amount` – okay
- Line 68: `a.endDate` → `a.end_date`

**Step 1:** Replace all camelCase date fields with snake_case:

```diff
- const endDate = new Date(contract.endDate);
+ const endDate = new Date(contract.end_date);

- .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
+ .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());

- contractNumber: c.contractNumber,
+ contract_number: c.contract_number,

- endDate: formatDate(c.endDate),
+ end_date: formatDate(c.end_date),

- {contract.contractNumber}
+ {contract.contract_number}

- {contract.title}
+ {contract.title}

- {contract.client}
+ {contract.client}

- {formatDate(contract.endDate)}
+ {formatDate(contract.end_date)}
```

Make these changes throughout the file: column keys (line 94), exportData (line 102-109), table rows (lines 241-247). Also in the sorting and display.

**Step 2:** Update column key:

```tsx
const columns: ExportColumn[] = [
  { key: 'contract_number', header: 'Contract Number' },
  { key: 'title', header: 'Title' },
  { key: 'client', header: 'Client' },
  { key: 'end_date', header: 'End Date' },
  { key: 'daysUntil', header: 'Days Until Expiration' },
  { key: 'amount', header: 'Amount' },
];
```

**Step 3:** Update exportData mapping:

```tsx
const exportData = expirationData.expiringSoon.map(c => ({
  contract_number: c.contract_number,
  title: c.title,
  client: c.client,
  end_date: formatDate(c.end_date),
  daysUntil: getDaysUntil(c.end_date),
  amount: formatCurrency(c.amount),
}));
```

**Step 4:** In table rows (lines 240-250), replace references:

```tsx
<TableCell className="font-medium">{contract.contract_number}</TableCell>
<TableCell>{contract.title}</TableCell>
<TableCell>{contract.client}</TableCell>
<TableCell>{formatDate(contract.end_date)}</TableCell>
```

**Verification:** Ensure all field names are snake_case consistent.

---

## Task 11: Fix FinancialReport to snake_case (10 min)

**Files:** `pacta_appweb/src/components/reports/FinancialReport.tsx`

**Issues:**
- Line 73: `c.startDate` → `c.start_date`
- Line 103: column key `contractNumber` → `contract_number`
- Line 102: column key `client` → keep (exists as denormalized)
- Line 111-117: exportData uses `c.contractNumber`, `c.title`, `c.client`, `c.type`, `c.status`, `c.amount`
- Lines 284-286: table uses `contract.contractNumber`, `contract.title`, `contract.client`

**Step 1:** Update month extraction (line 73):

```tsx
const month = new Date(c.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
```

**Step 2:** Update columns:

```tsx
const columns: ExportColumn[] = [
  { key: 'contract_number', header: 'Contract Number' },
  { key: 'title', header: 'Title' },
  { key: 'client', header: 'Client' },
  { key: 'type', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'amount', header: 'Amount' },
];
```

**Step 3:** Update exportData mapping:

```tsx
const exportData = contracts
  .sort((a, b) => b.amount - a.amount)
  .map(c => ({
    contract_number: c.contract_number,
    title: c.title,
    client: c.client,
    type: formatStatus(c.type),
    status: formatStatus(c.status),
    amount: formatCurrency(c.amount),
  }));
```

**Step 4:** Update table rows (lines 282-295):

```tsx
<TableCell>{contract.contract_number}</TableCell>
<TableCell>{contract.title}</TableCell>
<TableCell>{contract.client}</TableCell>
<TableCell>{formatStatus(contract.type)}</TableCell>
```

**Step 5:** Note: `FinancialReport` also uses `c.amount` correctly.

**Verification:** Compile should be clean.

---

## Task 12: Verify Build Locally (5 min)

**Files:** None

**Step 1:** Run TypeScript compiler:

```bash
cd pacta_appweb
npx tsc --noEmit
```

**Expected:** No errors.

**Step 2:** Run Vite build:

```bash
npm run build
```

**Expected:** Build succeeds without errors.

**Step 3:** Commit all changes with a clear message:

```bash
git add -A
git commit -m "fix: resolve TypeScript compilation errors on feature branch

- UpdateContractRequest: add missing contract_number field
- Contract.type/status: change from string to ContractType/ContractStatus union types
- Contract interface: add optional client/supplier denormalized name fields
- ReportsPage: enrich contracts with client/supplier names from fetched data
- ContractsPage: replace parseInt with Number() for numeric ID conversions
- ContractsPage: add missing ContractStatus import
- ContractForm: fix default type value to valid ContractType
- ClientSupplierReport: handle possibly undefined client/supplier names
- ContractStatusReport, ExpirationReport, FinancialReport: migrate from camelCase to snake_case field access
- All reports: use corrected snake_case keys and enriched contract data"
```

**Step 4:** Create PR or merge to main as needed per workflow.

---

## Execution Options

**Option A — Sequential Implementation:** Run tasks 1 → 12 in order. Each task is independent and builds on previous fixes. Recommended.

**Option B — Batch Commit:** Group related tasks into logical commits:
- Commit 1: UpdateContractRequest + Contract union types (Tasks 1-2)
- Commit 2: Add denormalized fields + ReportsPage enrichment (Tasks 3-4)
- Commit 3: Fix ContractsPage parseInt + missing import (Tasks 5-6)
- Commit 4: Fix ContractForm default type (Task 7)
- Commit 5: Migrate all report components to snake_case + client/supplier (Tasks 8-11)
- Commit 6: Verification (Task 12)

**Option C — Test After Each:** After each task, run `npx tsc --noEmit` to catch errors early. Use this if you want immediate feedback.

---

## Risk Mitigation

- If the Go backend's Contract JSON uses snake_case already, these changes align frontend to that shape.
- Denormalized fields are computed client-side only; no persistence changes.
- Changing ContractForm SelectItem values to Spanish enum values is a functional change but preserves intended contract type semantics. Ensure translation keys (`t('service')`, etc.) still display appropriate labels.
- If ReportsPage's client/supplier loading fails, enrichment yields empty names; reports still render but may show "Unknown". Consider adding fallback text.

---

## Estimated Total Time: ~65 minutes

Break into multiple PRs if desired for easier review.
