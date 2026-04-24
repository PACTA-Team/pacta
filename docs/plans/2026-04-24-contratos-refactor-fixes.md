# Contracts Refactor — Critical Security & Functionality Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **Objective:** Resolve critical security vulnerability (missing ownership validation in `updateContract`), implement all missing contract form fields, complete test coverage, and remove dead code to achieve a production-ready state.
>
> **Scope:** This plan covers 8 work streams:
> 1. Backend ownership validation (security)
> 2. Frontend: Complete contract fields in `ContraparteForm`
> 3. Frontend: Wrapper data flow integration
> 4. Frontend: Improve document verification (timeout + abort)
> 5. Cleanup: Remove dead code, unused vars
> 6. Tests: Unit test coverage (≥85%)
> 7. Tests: E2E test suite
> 8. Final verification and merge
>
> **Success Criteria:**
> - All required contract fields render, validate, and persist
> - Backend `updateContract` enforces company ownership (parity with CREATE)
> - HEAD verification timeout 5s, respects abort signal
> - Test coverage ≥85% lines, ≥90% branches on affected components
> - Zero lint errors, build succeeds
> - E2E scenarios for loading, document expiry, optimized fetch all pass
>
> **Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Go 1.25, SQLite, Vitest, Playwright

---

## Context & Problem Statement

Code review of `docs/plans/2026-04-24-contratos-refactor-implementation.md` implementation identified:

### Critical Issues (Blocking)
1. **Security — UPDATE ownership bypass** (`internal/handlers/contracts.go:308`): `updateContract` only verifies client/supplier existence, NOT that they belong to the user's company. Allows cross-company data tampering.
2. **Incomplete form** (`ContraparteForm.tsx`): Missing ~10 contract fields (contract_number, dates, amount, type, status, description, object, fulfillment_place, dispute_resolution, guarantees, renewal_type, has_confidentiality). Form cannot create/update contracts.

### Important Issues
3. Dead code in `SupplementsPage.tsx` (lines 456–489 — unreachable after component close)
4. `isSubmitting` variable unused in `ContractFormWrapper`
5. HEAD verification lacks timeout and abort signal support
6. Debugging comments in test files
7. Test coverage insufficient (unit tests < required, E2E missing)

---

## Solution Overview

- **Backend:** Mirror the ownership validation present in `createContract` (lines 183–201) within `updateContract`.
- **Frontend – ContraparteForm:** Add all contract fields using controlled inputs; employ a generic `onFieldChange` callback to propagate changes to Wrapper.
- **Frontend – Wrapper:** Implement `handleFieldChange`, expand `formDataRef` type, assemble all fields in `handleSubmit`, add required validation and `isSubmitting` state.
- **Frontend – Document verification:** Add 5s timeout and AbortController cancellation.
- **Cleanup:** Delete dead code block in SupplementsPage, remove unused variable, clean test comments.
- **Tests:** Write comprehensive unit tests for new fields, abort behavior, HEAD verification; create E2E suite covering loading states, document expiry, optimized signers fetch.

---

## Detailed Tasks

---

### Task 1: Backend — Add Ownership Validation to `updateContract`

**Files:**
- Modify: `internal/handlers/contracts.go:308-383` (function `updateContract`)

**Step 1: Replace existence checks with ownership checks**

Current code (lines 316–335):
```go
   // Validate foreign key references before UPDATE
   var clientExists int
   if err := h.DB.QueryRow("SELECT COUNT(*) FROM clients WHERE id = ? AND deleted_at IS NULL", req.ClientID).Scan(&clientExists); err != nil {
       h.Error(w, http.StatusInternalServerError, "failed to update contract")
       return
   }
   if clientExists == 0 {
       h.Error(w, http.StatusBadRequest, "client not found")
       return
   }

   var supplierExists int
   if err := h.DB.QueryRow("SELECT COUNT(*) FROM suppliers WHERE id = ? AND deleted_at IS NULL", req.SupplierID).Scan(&supplierExists); err != nil {
       h.Error(w, http.StatusInternalServerError, "failed to update contract")
       return
   }
   if supplierExists == 0 {
       h.Error(w, http.StatusBadRequest, "supplier not found")
       return
   }
```

Replace with:
```go
   // Validate client belongs to user's company
   var clientCompanyID int
   if err := h.DB.QueryRow("SELECT company_id FROM clients WHERE id = ? AND deleted_at IS NULL", req.ClientID).Scan(&clientCompanyID); err != nil {
       h.Error(w, http.StatusBadRequest, "client not found")
       return
   }
   if clientCompanyID != companyID {
       h.Error(w, http.StatusBadRequest, "client does not belong to your company")
       return
   }

   // Validate supplier belongs to user's company
   var supplierCompanyID int
   if err := h.DB.QueryRow("SELECT company_id FROM suppliers WHERE id = ? AND deleted_at IS NULL", req.SupplierID).Scan(&supplierCompanyID); err != nil {
       h.Error(w, http.StatusBadRequest, "supplier not found")
       return
   }
   if supplierCompanyID != companyID {
       h.Error(w, http.StatusBadRequest, "supplier does not belong to your company")
       return
   }
```

**Note:** `companyID` is obtained earlier via `companyID := h.GetCompanyID(r)` (line 309). No further changes needed.

**Step 2: Verify that UPDATE query already includes `company_id = ?` in WHERE clause** (line 378):
```go
query := fmt.Sprintf(`UPDATE contracts SET %s WHERE id=? AND deleted_at IS NULL AND company_id = ?`, ...)
```
This ensures the contract belongs to the company, and the new client/supplier also belong (via foreign keys? They are just IDs; we validate separately). Good.

**Step 3: Run manual verification** (no automated test infrastructure):
```bash
# Start server locally (if possible) or rely on CI
# Use curl to simulate:
# 1. Create a contract as company A
# 2. Attempt update with client_id belonging to company B -> expect 400
```

**Step 4: Commit**
```bash
git add internal/handlers/contracts.go
git commit -m "fix(contracts): enforce company ownership validation on update"
```

---

### Task 2: Frontend — Extend `ContraparteForm` with All Contract Fields

**Files:**
- Create/modify: `pacta_appweb/src/components/contracts/ContraparteForm.tsx`
- Create/modify: `pacta_appweb/src/types/contract.ts` (if needed for new types)
- Test: `pacta_appweb/src/components/contracts/__tests__/ContraparteForm.test.tsx`

**Step 1: Update `ContraparteFormProps` interface**

Add a generic field change callback:
```typescript
interface ContraparteFormProps {
  type: 'client' | 'supplier';
  companyId: number;
  contract?: Contract | null;
  clients?: Client[];
  suppliers?: Supplier[];
  signers: AuthorizedSigner[];
  onContraparteIdChange: (id: string) => void;
  onSignerIdChange?: (id: string) => void;
  onAddContraparte: () => void;
  onAddResponsible: () => void;
  pendingDocument: { url: string; key: string; file: File } | null;
  onDocumentChange: (doc: {url:string;key:string;file:File}) => void;
  onDocumentRemove: () => void;
  isLoading?: boolean;
  loadingSigners?: boolean;
  onFieldChange?: (field: keyof ContractSubmitData, value: any) => void; // NEW
}
```

**Step 2: Add local state for all contract fields**

Inside component, before return:
```typescript
   // ─── Contract field states ───
   const [contractNumber, setContractNumber] = useState(contract?.contract_number || '');
   const [title, setTitle] = useState(contract?.title || '');
   const [startDate, setStartDate] = useState(contract?.start_date || '');
   const [endDate, setEndDate] = useState(contract?.end_date || '');
   const [amount, setAmount] = useState<number | ''>(contract?.amount || '');
   const [type, setType] = useState<ContractType | ''>(contract?.type || '');
   const [status, setStatus] = useState<ContractStatus>('active'); // default
   const [description, setDescription] = useState(contract?.description || '');
   const [object, setObject] = useState(contract?.object || '');
   const [hasConfidentiality, setHasConfidentiality] = useState<boolean>(
     contract?.has_confidentiality || false
   );
   const [fulfillmentPlace, setFulfillmentPlace] = useState(contract?.fulfillment_place || '');
   const [disputeResolution, setDisputeResolution] = useState(contract?.dispute_resolution || '');
   const [guarantees, setGuarantees] = useState(contract?.guarantees || '');
   const [renewalType, setRenewalType] = useState<RenewalType | ''>(contract?.renewal_type || '');
```

Initialize `status` from contract if editing: if `contract?.status`, set that.

Add a `useEffect` to initialize all fields from contract when editing:
```typescript
   useEffect(() => {
     if (contract) {
       setContractNumber(contract.contract_number || '');
       setTitle(contract.title || '');
       setStartDate(contract.start_date || '');
       setEndDate(contract.end_date || '');
       setAmount(contract.amount || '');
       setType(contract.type || '');
       setStatus(contract.status || 'active');
       setDescription(contract.description || '');
       setObject(contract.object || '');
       setHasConfidentiality(contract.has_confidentiality || false);
       setFulfillmentPlace(contract.fulfillment_place || '');
       setDisputeResolution(contract.dispute_resolution || '');
       setGuarantees(contract.guarantees || '');
       setRenewalType(contract.renewal_type || '');
     }
   }, [contract]);
```

**Step 3: Wire change handlers to call `onFieldChange`**

Create helper:
```typescript
   const handleFieldChange = (field: keyof ContractSubmitData, value: any) => {
     // Also update local state via appropriate setter? Actually state handlers will set state; we call onFieldChange after.
   };
```

But we'll combine: each field's setter also triggers onFieldChange. Example:
```typescript
   const handleContractNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setContractNumber(val);
     onFieldChange?.('contract_number', val);
   };
```
Repeat for each field.

Alternatively, create a factory: `const makeChangeHandler = (field: keyof ContractSubmitData) => (value: any) => { setXxx(value); onFieldChange?.(field, value); };` But for clarity we'll write explicit handlers.

Add handlers for:
- contractNumber (text)
- title (text)
- startDate (date)
- endDate (date)
- amount (number)
- type (select, value as ContractType)
- status (select, value as ContractStatus)
- description (textarea)
- object (textarea)
- hasConfidentiality (checkbox, boolean)
- fulfillmentPlace (textarea or text)
- disputeResolution (textarea)
- guarantees (textarea)
- renewalType (select with RenewalType options)

**Step 4: Render form fields**

Insert after the signer select (around line ~191) before ContractDocumentUpload.

Group fields logically:

```tsx
{/* Contract Basic Information */}
<div className="space-y-4 border-b pb-4">
  <h3 className="text-lg font-medium">Contract Information</h3>
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="contract-number">Contract Number *</Label>
      <Input
        id="contract-number"
        value={contractNumber}
        onChange={handleContractNumberChange}
        required
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="title">Title</Label>
      <Input id="title" value={title} onChange={handleTitleChange} />
    </div>
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="start-date">Start Date *</Label>
      <Input id="start-date" type="date" value={startDate} onChange={handleStartDateChange} required />
    </div>
    <div className="space-y-2">
      <Label htmlFor="end-date">End Date *</Label>
      <Input id="end-date" type="date" value={endDate} onChange={handleEndDateChange} required />
    </div>
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="amount">Amount (USD) *</Label>
      <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={handleAmountChange} required />
    </div>
    <div className="space-y-2">
      <Label htmlFor="type">Contract Type *</Label>
      <Select value={type} onValueChange={(v) => handleTypeChange(v as ContractType)} required>
        <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
        <SelectContent>
          {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>

  <div className="space-y-2">
    <Label htmlFor="status">Status *</Label>
    <Select value={status} onValueChange={(v) => handleStatusChange(v as ContractStatus)} required>
      <SelectTrigger id="status"><SelectValue placeholder="Select status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="expired">Expired</SelectItem>
        <SelectItem value="cancelled">Cancelled</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <Label htmlFor="description">Description</Label>
    <Textarea id="description" value={description} onChange={handleDescriptionChange} rows={3} />
  </div>

  <div className="space-y-2">
    <Label htmlFor="object">Object (purpose)</Label>
    <Textarea id="object" value={object} onChange={handleObjectChange} rows={2} />
  </div>

  <div className="flex items-center space-x-2">
    <Checkbox id="has-confidentiality" checked={hasConfidentiality} onCheckedChange={(c) => setHasConfidentiality(!!c)} />
    <Label htmlFor="has-confidentiality">Confidentiality Clause</Label>
  </div>
</div>

{/* Legal Fields — Collapsible */}
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full mt-4">
    <ChevronDown className="h-4 w-4" />
    Cláusulas Adicionales
  </CollapsibleTrigger>
  <CollapsibleContent className="space-y-4 pt-4">
    <div className="space-y-2">
      <Label htmlFor="fulfillment-place">Fulfillment Place</Label>
      <Input id="fulfillment-place" value={fulfillmentPlace} onChange={handleFulfillmentPlaceChange} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="dispute-resolution">Dispute Resolution</Label>
      <Textarea id="dispute-resolution" value={disputeResolution} onChange={handleDisputeResolutionChange} rows={2} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="guarantees">Guarantees</Label>
      <Textarea id="guarantees" value={guarantees} onChange={handleGuaranteesChange} rows={2} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="renewal-type">Renewal Type</Label>
      <Select value={renewalType} onValueChange={(v) => setRenewalType(v as RenewalType)}>
        <SelectTrigger id="renewal-type"><SelectValue placeholder="Select renewal type" /></SelectTrigger>
        <SelectContent>
          {Object.entries(RENEWAL_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </CollapsibleContent>
</Collapsible>
```

**Step 5: Ensure each change handler calls both local setter and `onFieldChange`**

Example:
```typescript
   const handleContractNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setContractNumber(val);
     onFieldChange?.('contract_number', val);
   };
```
Repeat pattern for all text/number/date fields.

For checkbox:
```typescript
   const handleHasConfidentialityChange = (checked: boolean | 'indeterminate') => {
     const bool = !!checked;
     setHasConfidentiality(bool);
     onFieldChange?.('has_confidentiality', bool);
   };
```

For selects (type, status, renewalType):
```typescript
   const handleTypeChange = (value: ContractType) => {
     setType(value);
     onFieldChange?.('type', value);
   };
```

**Step 6: Import required components and types**

At top of file, add imports:
```typescript
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CONTRACT_TYPE_LABELS } from '@/types';
import type { ContractType, ContractStatus, RenewalType } from '@/types';
import { RENEWAL_TYPE_LABELS } from '@/types';
```
(Confirm that `CONTRACT_TYPE_LABELS` and `RENEWAL_TYPE_LABELS` are exported from types/index.ts. They are (lines 24–41 and 135–139).)

**Step 7: Update tests**

Modify `ContraparteForm.test.tsx` to include tests for new fields rendering and callbacks.

Add:
- `it('renders all required contract fields', () => { ... check presence of inputs ... })`
- `it('calls onFieldChange when contract number changes', async () => { ... })`
- For each major field group.

**Step 8: Commit**

```bash
git add pacta_appweb/src/components/contracts/ContraparteForm.tsx
git add pacta_appweb/src/components/contracts/__tests__/ContraparteForm.test.tsx
git commit -m "feat(contracts): complete ContraparteForm with all contract fields and onFieldChange integration"
```

---

### Task 3: Frontend — Integrate Field Data Flow in `ContractFormWrapper`

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx`

**Step 1: Expand `formDataRef` type**

Replace current ref definition:
```typescript
   const formDataRef = useRef<{
     client_id?: string;
     supplier_id?: string;
     client_signer_id?: string;
     supplier_signer_id?: string;
   }>({});
```

With:
```typescript
   type FormField = keyof ContractSubmitData;
   const formDataRef = useRef<Partial<ContractSubmitData>>({});
```

**Step 2: Implement generic `handleFieldChange`**

```typescript
   const handleFieldChange = useCallback((field: keyof ContractSubmitData, value: any) => {
     formDataRef.current[field] = value;
   }, []);
```

**Step 3: Pass `handleFieldChange` to `ContraparteForm` as `onFieldChange`**

In JSX where ContraparteForm is used:
```tsx
          <ContraparteForm
            ...
            onFieldChange={handleFieldChange}
          />
```

**Step 4: Add `isSubmitting` state and disable submit button**

```typescript
   const [isSubmitting, setIsSubmitting] = useState(false);
```

In `handleSubmit`:
```typescript
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!selectedOwnCompany) {
       toast.error('Seleccione una empresa');
       return;
     }

     // Validate required contract fields
     const requiredFields: (keyof ContractSubmitData)[] = ['contract_number', 'start_date', 'end_date', 'amount', 'type', 'status'];
     for (const field of requiredFields) {
       const value = formDataRef.current[field];
       if (value === undefined || value === '' || value === null) {
         toast.error(`Field ${field} is required`);
         return;
       }
     }

     // Verify pending document...
     setIsSubmitting(true);
     try {
       // ... existing verification and submit
     } catch (err) { ... } finally {
       setIsSubmitting(false);
     }
   };
```

**Step 5: Update `handleSubmit` to include all contract fields**

Currently builds `submitData` with only IDs and document. Replace with:
```typescript
        const submitData: Partial<ContractSubmitData> = {
          ...formDataRef.current, // spread all collected fields
          company_id: selectedOwnCompany.id,
          document_url: pendingDocument?.url,
          document_key: pendingDocument?.key,
          // Ensure numeric types where needed
          client_id: formDataRef.current.client_id ? Number(formDataRef.current.client_id) : undefined,
          supplier_id: formDataRef.current.supplier_id ? Number(formDataRef.current.supplier_id) : undefined,
          client_signer_id: formDataRef.current.client_signer_id ? Number(formDataRef.current.client_signer_id) : undefined,
          supplier_signer_id: formDataRef.current.supplier_signer_id ? Number(formDataRef.current.supplier_signer_id) : undefined,
          amount: typeof formDataRef.current.amount === 'number' ? formDataRef.current.amount : Number(formDataRef.current.amount),
        };
```
Remove individual assignments; the spread covers most. Ensure type matches exactly; eliminate any undefined numeric fields by conditionally adding.

**Step 6: Remove unused `isSubmitting` placeholder line** (remove line 278 `const isSubmitting = false;`)

**Step 7: Add submit button disabled state**

```tsx
            <Button type="submit" form="contract-form" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (contract ? 'Actualizar Contrato' : 'Crear Contrato')}
            </Button>
```

**Step 8: Test manually (dev) or via unit test** (tests will be added in later tasks)

**Step 9: Commit**
```bash
git add pacta_appweb/src/components/contracts/ContractFormWrapper.tsx
git commit -m "feat(contracts): integrate all contract fields and isSubmitting state"
```

---

### Task 4: Improve Document HEAD Verification with Timeout & Abort

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx` lines 236–260

**Step 1: Replace fetch with AbortController and timeout**

Replace existing verification block with:

```typescript
      // Verify pending document still exists (prevents TTL expiry issues)
      if (pendingDocument) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        try {
          const response = await fetch(pendingDocument.url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            // Document expired or was deleted
            setPendingDocument(null);
            toast.error('El documento ha expirado. Por favor, súbalo nuevamente.');
            return;
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            toast.error('Document verification timed out');
          } else {
            toast.error('Error al verificar documento. Intente nuevamente.');
          }
          return;
        }
      }
```

**Step 2: Run existing unit tests to ensure no regression**

```bash
cd pacta_appweb && npm test -- ContractFormWrapper
```

**Step 3: Commit**
```bash
git add pacta_appweb/src/components/contracts/ContractFormWrapper.tsx
git commit -m "fix(contracts): add timeout and abort to document HEAD verification"
```

---

### Task 5: Remove Dead Code & Unused Variables

**Files:**
1. `pacta_appweb/src/pages/SupplementsPage.tsx`
2. `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx`

**Step 1: Delete unreachable code in SupplementsPage**

Remove lines 456–489 entirely (they appear after component closing brace and are dead).

**Step 2: Remove unused `isSubmitting` placeholder (already done in Task 3)** — ensure no other unused vars.

**Step 3: Run linter to catch other issues**

```bash
cd pacta_appweb && npm run lint
```

Fix any new warnings.

**Step 4: Commit**
```bash
git add pacta_appweb/src/pages/SupplementsPage.tsx
git commit -m "chore(contracts): remove dead code in SupplementsPage"
```

---

### Task 6: Clean Up Test Debugging Artifacts

**Files:**
- `pacta_appweb/src/hooks/__tests__/useCompanyFilter.test.ts`

**Step 1: Remove debug comments**

Lines 48–52 contain inline debugging comments:
```typescript
       // Actually check: items[1] has supplier_id=3 not 1, items[2] has both 1 -> only one? Let's compute: baseCompany id=1, items: [1,2] -> supplier=2, not match; [2,3] -> supplier=3 no; [1,1] -> supplier=1 yes. So only [1,1] matches. That's length 1.
```

Delete those lines, keep only clean test expectations:
```typescript
       expect(result.current).toHaveLength(1);
       expect(result.current).toEqual([items[2]]);
```

**Step 2: Run tests to ensure they still pass**

```bash
cd pacta_appweb && npm test useCompanyFilter
```

**Step 3: Commit**
```bash
git add pacta_appweb/src/hooks/__tests__/useCompanyFilter.test.ts
git commit -m "test(contracts): clean debugging comments in useCompanyFilter tests"
```

---

### Task 7: Expand Unit Test Coverage for ContractFormWrapper

**Files:**
- Modify: `pacta_appweb/src/components/contracts/__tests__/ContractFormWrapper.test.tsx`

**Goal:** Add tests for:
- Required fields validation (missing contract_number, dates, etc.)
- AbortController cancels previous request on rapid company change
- HEAD verification: 404 clears pendingDocument and shows error
- HEAD verification: 200 allows submit to proceed
- Partial failure preserves pendingDocument

**Step 1: Install/verify test utilities**

Already using `@testing-library/react`, `vitest`, `user-event`. Good.

**Step 2: Write test for required fields validation**

Example:
```typescript
   it('blocks submission and shows error when required fields are missing', async () => {
     // Render with minimal mocks; submit empty form
     const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
     render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={vi.fn()} />);
     
     // Fill only counterpart and signer (skip contract_number)
     // Attempt submit
     await userEvent.click(screen.getByRole('button', { name: /crear contrato/i }));
     
     // Expect toast error about contract_number required (or HTML5 validation)
     await waitFor(() => {
       expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('contract_number'));
     });
     expect(mockOnSubmit).not.toHaveBeenCalled();
   });
```
But note: our validation in handleSubmit checks via requiredFields loop. We'll need to simulate missing field by not triggering onFieldChange for contract_number. That's tricky if component requires input to be present. Better to test that submit fails if input is empty. We could query the input and ensure empty, then submit. But our handleSubmit reads from formDataRef; that ref will be empty for that field unless we simulate typing. Simulate typing counterpart id etc but leave contract_number empty. That works.

**Step 2b: Complete test for AbortController**

```typescript
   it('cancels previous request when company changes rapidly', async () => {
     const { rerender } = render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={vi.fn()} />);
     // The wrapper's effect for loading counterparts uses loadAbortRef.
     // Simulate company change by changing selectedOwnCompany via mocking useOwnCompanies? 
     // Or we can test the effect indirectly by ensuring that when selectedOwnCompany changes quickly, the abort is called.
     // Better unit: expose loadAbortRef? Not accessible.
     // Alternative: integration test: mock clientsAPI.listByCompany to delay; then trigger company change; then verify that the first promise rejects with AbortError.
   });
```
We'll write a test that ensures the abort happens by checking that the first fetch was aborted. We can spy on `AbortController.prototype.abort`. That's doable.

**Step 2c: HEAD verification tests**

Mock `global.fetch`:
```typescript
   it('prevents submit and shows error when document HEAD returns 404 (expired)', async () => {
     const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
     const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
     global.fetch = mockFetch;

     render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={vi.fn()} />);
     // Simulate pendingDocument state via prop? Hard to reach; maybe we need to simulate upload first.
     // Alternatively test handleSubmit directly via wrapper instance? Not straightforward.
   });
```
This may require testing the `handleSubmit` function indirectly by triggering form submission after setting up state. Since `pendingDocument` is internal state of Wrapper, we could simulate adding document by calling setPendingDocument via act? Or better: render the component, simulate file upload by interacting with ContractDocumentUpload to set pendingDocument. That's a full integration test. Might be easier to test `handleSubmit` logic by extracting it into a custom hook? But we can write an E2E test instead.

Given complexity, we might limit unit tests for HEAD verification to testing a custom hook or we can skip in unit and rely on E2E. The plan expects E2E coverage. So for unit we can have minimal. I'll add a simple unit test that mocks the internal fetch behavior, but we can't easily access handleSubmit. Could use `userEvent.click` after rendering full component and mocking fetch. We can setup the component with `pendingDocument` already set by mocking upload process. Might be doable: We could mock the upload service to immediately set a pending document. Not trivial.

Alternative: In `ContractFormWrapper` test, we can fire the submit event and mock fetch globally. We'll need to render the whole component with mocked child components that allow setting pendingDocument. The `ContractDocumentUpload` component is mocked? In the test file, they mock child components with simple testids. In that mock, they can simulate pendingDocument presence. In current test file, they mock ContractDocumentUpload as a simple component with `pendingDocument` prop display and buttons to call onUpload/onRemove. We could adjust mock to allow setting pendingDocument via onUpload, then submit the form. The `ContractFormWrapper` test currently already mocks ContraparteForm and ContractDocumentUpload. The mock for ContractDocumentUpload includes an upload button that calls `onUpload` with a fake file. That file sets pendingDocument in Wrapper. Great. So we can simulate uploading by clicking that button, then submit form. Then we can intercept fetch HEAD call.

So: In the test, render with mockFetch, click upload button, then submit form, and assert fetch called with method HEAD, and its result determines behavior.

We'll write two tests: one where fetch returns {ok:false}, one where {ok:true}.

We need to mock the `fetch` global to return our fake response.

Now, for abort controller test: We can mock AbortController constructor and track instances. We'll spy on its abort method.

We'll implement those.

**Step 3: Write each test following TDD pattern**  
(But we already have existing tests; we'll add to them.)

**Step 4: Run all unit tests and check coverage**

```bash
cd pacta_appweb && npm test -- --coverage
```
Ensure ≥85% lines on affected files. If not, add more tests.

**Step 5: Commit each test addition** (we can batch after several tests, but plan says frequent commits). We'll commit after each test file modification, but for brevity we can commit once after adding all unit tests.

```bash
git add pacta_appweb/src/components/contracts/__tests__/ContractFormWrapper.test.tsx
git add pacta_appweb/src/components/contracts/__tests__/ContraparteForm.test.tsx
git commit -m "test(contracts): add unit tests for contract fields, abort controller, document verification"
```

---

### Task 8: Create E2E Test Suite for Contract Form

**Files:**
- Create: `e2e/tests/contracts/contract-form.spec.ts`
- Possibly: `e2e/fixtures/contract-data.ts` for test data

**Step 1: Scaffold test file with describe blocks**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Contract Form — New', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts/new');
    // Ensure logged in? Use auth state
  });

  test('shows loading indicator in counterpart select while fetching', async ({ page }) => {
    // Mock the clientsAPI/suppliersAPI to delay
    await page.route('**/api/clients/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
    // Select company and role that triggers load
    // Expect select to be disabled or show spinner
  });

  test('prevents submission when document expires (HEAD 404)', async ({ page }) => {
    // Upload a document (mock upload endpoint to return temp URL)
    // Then mock HEAD request to that URL to return 404
    await page.route('**/api/documents/temp/**', async (route) => {
      if (route.request().method() === 'HEAD') {
        route.fulfill({ status: 404 });
      } else {
        route.continue();
      }
    });
    // Fill required fields, submit
    // Expect error toast "documento expirado"
  });

  test('allows submission when document HEAD succeeds', async ({ page }) => {
    // Mock HEAD 200
    await page.route('**/api/documents/temp/**', async (route) => {
      if (route.request().method() === 'HEAD') {
        route.fulfill({ status: 200, headers: { 'Content-Length': '123' } });
      } else {
        route.continue();
      }
    });
    // Upload, fill fields, submit, expect success toast
  });

  test('fetches signers using optimized endpoint with query params', async ({ page }) => {
    // Intercept /api/signers and check query includes company_id and company_type
    const signersRequests: any[] = [];
    await page.route('**/api/signers', (route) => {
      signersRequests.push(route.request());
      route.continue();
    });
    // Select company and counterpart to trigger signers fetch
    await expect(page.getByRole('combobox', { name: /signer/i })).toBeEnabled();
    expect(signersRequests[0]).toHaveURL(/[?&]company_id=\d+&[&]company_type=(client|supplier)/);
  });
});
```

**Step 2: Implement auth setup** — Use existing e2e auth state if present (likely `e2e/.auth/`). If not, skip or create login flow.

**Step 3: Run E2E tests**

```bash
cd pacta_appweb && npm run test:e2e
```

All must pass.

**Step 4: Commit**
```bash
git add e2e/tests/contracts/contract-form.spec.ts
git commit -m "test(contracts): add E2E tests for loading, document verification, optimized fetch"
```

---

### Task 9: Global Cleanup and Code Quality

**Step 1: Remove unused variable `isSubmitting` placeholder** (already done in Task 3).

**Step 2: Ensure no other dead code** — run `npm run lint` and fix warnings.

```bash
cd pacta_appweb && npm run lint
```

**Step 3: Format code** — run `npm run format` if available.

**Step 4: Commit**
```bash
git add .
git commit -m "chore(contracts): cleanup dead code and lint"
```

---

### Task 10: Final Verification & Merge Preparation

**Step 1: Run full test suite (frontend)**

```bash
cd pacta_appweb
npm test -- --coverage
```
Expected: coverage ≥85% lines, ≥90% branches for files under `src/components/contracts/` and `src/hooks/`.

**Step 2: Run E2E suite again**

```bash
npm run test:e2e
```

**Step 3: Build frontend**

```bash
npm run build
```
No errors.

**Step 4: Build backend (if local Go env available) or rely on CI**

```bash
cd /home/mowgli/pacta
go build ./...
go vet ./...
```

**Step 5: Create PR (if not already) or ensure branch ready**

- Branch name: `refactor/contracts-form-2026-04-24`
- Ensure all commits pushed.
- Create PR with checklist:
  - [x] Security fix applied (ownership validation)
  - [x] All contract fields implemented
  - [x] Required validation enforced
  - [x] Document verification timeout + abort
  - [x] Unit test coverage ≥85%
  - [x] E2E tests added and passing
  - [x] Lint and build clean
  - [ ] Manual QA on staging (suggested)

**Step 6: Request code review** — Use `@kilo-code-review` or equivalent.

**Step 7: After approval, merge via `/land-and-deploy` skill** (not part of this plan).

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Ownership validation might have subtle differences between CREATE and UPDATE | Reuse the exact pattern from `createContract` (lines 183–201) to ensure consistency |
| Frontend fields might not match backend expectations | Use `ContractSubmitData` TypeScript interface as single source of truth |
| Submitting all fields might cause partial failures | Existing `handleSubmit` try/catch + error toast; `pendingDocument` preserved |
| AbortController memory leak | Already cleaned up via useEffect return in Wrapper |
| Test flakiness for timeouts | Use fake timers in unit tests; in E2E use controlled delays |

---

## Files Modified Summary (Expected)

```
pacta_appweb/src/components/contracts/
├── ContraparteForm.tsx           (expanded with all fields)
├── ContractFormWrapper.tsx        (field integration, isSubmitting, timeout)
├── ContractDocumentUpload.tsx     (unchanged except inline cleanup)
└── __tests__/
    ├── ContraparteForm.test.tsx   (extended)
    └── ContractFormWrapper.test.tsx (extended)

pacta_appweb/src/hooks/
└── useCompanyFilter.ts           (already correct)

pacta_appweb/src/pages/
├── ContractsPage.tsx              (already migrated)
├── ReportsPage.tsx                (already migrated)
└── SupplementsPage.tsx            (dead code removed)

internal/handlers/
├── contracts.go                  (ownership validation added)
├── documents.go                  (unchanged)
└── signers.go                   (already optimized)

e2e/tests/contracts/
└── contract-form.spec.ts         (new)
```

---

## Estimated Effort

| Phase | Tasks | Est. Hours |
|-------|-------|------------|
| Backend fix | 1 | 0.5 |
| Frontend fields | 2 | 3 |
| Wrapper integration | 3 | 1.5 |
| Document verification | 4 | 0.5 |
| Cleanup | 5 | 0.5 |
| Unit tests | 7 | 2 |
| E2E tests | 8 | 2 |
| Verification | 10 | 1 |
**Total:** ~11 hours

---

## Checklist Before Merge

- [ ] Ownership validation present in `updateContract`
- [ ] ContraparteForm renders all required fields with asterisks
- [ ] All fields call `onFieldChange` and update local state
- [ ] Wrapper `handleSubmit` includes all fields and validates required
- [ ] Document HEAD verification uses 5s timeout + abort
- [ ] Dead code removed from SupplementsPage
- [ ] Test comments cleaned
- [ ] Unit test coverage ≥85%
- [ ] E2E scenarios for loading, expiry, optimized fetch pass
- [ ] Lint: zero errors/warnings
- [ ] Build: frontend + backend succeed
- [ ] Changelog updated (contracts: complete form fields, fix ownership validation)
- [ ] Peer review completed

---

**Plan prepared by:** Kilo (code-review-and-quality agent)  
**Date:** 2026-04-24  
**Plan ID:** 2026-04-24-contratos-refactor-fixes  
**Related plan:** docs/plans/2026-04-24-contratos-refactor-implementation.md

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-04-24-contratos-refactor-fixes.md`. Three execution options:**

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.  
**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.  
**3. Plan-to-Issues (team workflow)** — Convert plan tasks to GitHub issues for team distribution.

**Which approach do you prefer?**
