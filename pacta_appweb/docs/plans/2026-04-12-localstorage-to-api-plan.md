# localStorage → Backend API Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Contracts, Clients, Suppliers, and AuthorizedSigners from localStorage to the existing Go backend API.

**Architecture:** Create dedicated API modules following the `supplements-api.ts` pattern. Replace all `get/set` localStorage calls in pages with async API calls. Add loading/error states where missing.

**Tech Stack:** TypeScript, React, fetch API, Vitest, Go backend (already exists)

---

## Task 1: Expand contracts-api.ts with full CRUD

**Files:**
- Modify: `pacta_appweb/src/lib/contracts-api.ts` (entire file)
- Test: `pacta_appweb/src/__tests__/contracts-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/contracts-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('contractsAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of contracts', async () => {
    const mockData = [{ id: 1, internal_id: 'CNT-2026-0001', contract_number: 'C-001', title: 'Test' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { contractsAPI } = await import('@/lib/contracts-api');
    const result = await contractsAPI.list();
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('/api/contracts', expect.any(Object));
  });

  it('create sends POST and returns result', async () => {
    const mockData = { id: 1, internal_id: 'CNT-2026-0001', status: 'created' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { contractsAPI } = await import('@/lib/contracts-api');
    const result = await contractsAPI.create({ contract_number: 'C-001', title: 'Test', client_id: 1, supplier_id: 1, start_date: '2026-01-01', end_date: '2027-01-01', amount: 1000, type: 'service' });
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('/api/contracts', expect.objectContaining({ method: 'POST' }));
  });

  it('update sends PUT and returns result', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { contractsAPI } = await import('@/lib/contracts-api');
    const result = await contractsAPI.update(1, { title: 'Updated' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE and returns result', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { contractsAPI } = await import('@/lib/contracts-api');
    const result = await contractsAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
    const { contractsAPI } = await import('@/lib/contracts-api');
    await expect(contractsAPI.list()).rejects.toThrow('Not found');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npm test -- src/__tests__/contracts-api.test.ts`
Expected: FAIL — `contractsAPI.create`, `contractsAPI.update`, `contractsAPI.delete` don't exist

**Step 3: Write minimal implementation**

Replace entire `pacta_appweb/src/lib/contracts-api.ts`:

```typescript
const BASE = '/api/contracts';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CreateContractRequest {
  contract_number: string;
  title: string;
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type?: string;
  status?: string;
  description?: string;
}

export interface UpdateContractRequest {
  title: string;
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
}

export const contractsAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateContractRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateContractRequest, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npm test -- src/__tests__/contracts-api.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/contracts-api.ts pacta_appweb/src/__tests__/contracts-api.test.ts
git commit -m "feat: expand contracts-api with full CRUD and tests"
```

---

## Task 2: Create clients-api.ts

**Files:**
- Create: `pacta_appweb/src/lib/clients-api.ts`
- Test: `pacta_appweb/src/__tests__/clients-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/clients-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('clientsAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of clients', async () => {
    const mockData = [{ id: 1, name: 'Test Client', address: '123 Main St', reu_code: 'R001', contacts: 'John' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.list();
    expect(result).toEqual(mockData);
  });

  it('create sends POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.create({ name: 'Test', address: '123 Main', reu_code: 'R001', contacts: 'John' });
    expect(result).toEqual({ id: 1, status: 'created' });
    expect(mockFetch).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ method: 'POST' }));
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.update(1, { name: 'Updated' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { clientsAPI } = await import('@/lib/clients-api');
    const result = await clientsAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npm test -- src/__tests__/clients-api.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write minimal implementation**

Create `pacta_appweb/src/lib/clients-api.ts`:

```typescript
const BASE = '/api/clients';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CreateClientRequest {
  name: string;
  address: string;
  reu_code: string;
  contacts: string;
}

export interface UpdateClientRequest {
  name?: string;
  address?: string;
  reu_code?: string;
  contacts?: string;
}

export const clientsAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateClientRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateClientRequest, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npm test -- src/__tests__/clients-api.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/clients-api.ts pacta_appweb/src/__tests__/clients-api.test.ts
git commit -m "feat: add clients-api module with tests"
```

---

## Task 3: Create suppliers-api.ts

**Files:**
- Create: `pacta_appweb/src/lib/suppliers-api.ts`
- Test: `pacta_appweb/src/__tests__/suppliers-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/suppliers-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('suppliersAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of suppliers', async () => {
    const mockData = [{ id: 1, name: 'Test Supplier' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.list();
    expect(result).toEqual(mockData);
  });

  it('create sends POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.create({ name: 'Test', address: '456 Ave', reu_code: 'S001', contacts: 'Jane' });
    expect(result).toEqual({ id: 1, status: 'created' });
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.update(1, { name: 'Updated' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { suppliersAPI } = await import('@/lib/suppliers-api');
    const result = await suppliersAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npm test -- src/__tests__/suppliers-api.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write minimal implementation**

Create `pacta_appweb/src/lib/suppliers-api.ts` (same pattern as clients-api.ts, just change BASE to `/api/suppliers`):

```typescript
const BASE = '/api/suppliers';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CreateSupplierRequest {
  name: string;
  address: string;
  reu_code: string;
  contacts: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  address?: string;
  reu_code?: string;
  contacts?: string;
}

export const suppliersAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateSupplierRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateSupplierRequest, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npm test -- src/__tests__/suppliers-api.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/suppliers-api.ts pacta_appweb/src/__tests__/suppliers-api.test.ts
git commit -m "feat: add suppliers-api module with tests"
```

---

## Task 4: Create signers-api.ts

**Files:**
- Create: `pacta_appweb/src/lib/signers-api.ts`
- Test: `pacta_appweb/src/__tests__/signers-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/signers-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('signersAPI', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('list returns array of signers', async () => {
    const mockData = [{ id: 1, company_id: 1, company_type: 'client', first_name: 'John', last_name: 'Doe' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.list();
    expect(result).toEqual(mockData);
  });

  it('create sends POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, status: 'created' }) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.create({ company_id: 1, company_type: 'client', first_name: 'John', last_name: 'Doe', position: 'CEO', phone: '555-1234', email: 'john@test.com' });
    expect(result).toEqual({ id: 1, status: 'created' });
  });

  it('update sends PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'updated' }) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.update(1, { first_name: 'Jane' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('delete sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'deleted' }) });
    const { signersAPI } = await import('@/lib/signers-api');
    const result = await signersAPI.delete(1);
    expect(result).toEqual({ status: 'deleted' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd pacta_appweb && npm test -- src/__tests__/signers-api.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write minimal implementation**

Create `pacta_appweb/src/lib/signers-api.ts`:

```typescript
const BASE = '/api/signers';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CreateSignerRequest {
  company_id: number;
  company_type: 'client' | 'supplier';
  first_name: string;
  last_name: string;
  position: string;
  phone: string;
  email: string;
}

export interface UpdateSignerRequest {
  company_id?: number;
  company_type?: 'client' | 'supplier';
  first_name?: string;
  last_name?: string;
  position?: string;
  phone?: string;
  email?: string;
}

export const signersAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON(BASE, { signal }),

  getById: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, { signal }),

  create: (data: CreateSignerRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateSignerRequest, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
```

**Step 4: Run test to verify it passes**

Run: `cd pacta_appweb && npm test -- src/__tests__/signers-api.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/lib/signers-api.ts pacta_appweb/src/__tests__/signers-api.test.ts
git commit -m "feat: add signers-api module with tests"
```

---

## Task 5: Migrate ContractsPage from localStorage to API

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx` (lines 1-160)

**Step 1: Write the test**

No new test needed — existing page behavior should be preserved. Verify manually after migration.

**Step 2: Replace localStorage imports with API imports**

In `ContractsPage.tsx`, replace:
```typescript
// REMOVE:
import { getContracts, setContracts, getCurrentUser, getClients, getSuppliers } from '@/lib/storage';

// ADD:
import { contractsAPI, CreateContractRequest, UpdateContractRequest } from '@/lib/contracts-api';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
```

**Step 3: Replace state types and loadData**

Replace the state declarations and loadData function:

```typescript
// Change state types from string IDs to number IDs
const [contracts, setContractsState] = useState<any[]>([]); // API returns number IDs
const [clients, setClients] = useState<any[]>([]);
const [suppliers, setSuppliers] = useState<any[]>([]);

// Replace loadData:
const loadData = useCallback(async () => {
  try {
    const [contractsData, clientsData, suppliersData] = await Promise.all([
      contractsAPI.list(),
      clientsAPI.list(),
      suppliersAPI.list(),
    ]);
    setContractsState(contractsData);
    setClients(clientsData);
    setSuppliers(suppliersData);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load data');
  }
}, []);
```

**Step 4: Replace handleCreateOrUpdate**

```typescript
const handleCreateOrUpdate = async (data: Omit<Contract, 'id' | 'internalId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
  try {
    if (editingContract) {
      await contractsAPI.update(editingContract.id as unknown as number, {
        title: data.title,
        client_id: parseInt(data.clientId),
        supplier_id: parseInt(data.supplierId),
        start_date: data.startDate,
        end_date: data.endDate,
        amount: data.amount,
        type: data.type,
        status: data.status,
      });
      toast.success('Contract updated successfully');
    } else {
      await contractsAPI.create({
        contract_number: data.contractNumber,
        title: data.title,
        client_id: parseInt(data.clientId),
        supplier_id: parseInt(data.supplierId),
        start_date: data.startDate,
        end_date: data.endDate,
        amount: data.amount,
        type: data.type,
        status: data.status,
      });
      toast.success('Contract created successfully');
    }
    setShowForm(false);
    setEditingContract(undefined);
    loadData();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Operation failed');
  }
};
```

**Step 5: Replace handleDelete**

```typescript
const confirmDelete = async () => {
  if (!contractToDelete) return;
  try {
    await contractsAPI.delete(parseInt(contractToDelete));
    toast.success('Contract deleted successfully');
    setDeleteDialogOpen(false);
    setContractToDelete(null);
    loadData();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Delete failed');
  }
};
```

**Step 6: Update filterContracts for API response format**

API returns `client_id` (number) instead of `clientId` (string). Update the filter function:

```typescript
const filterContracts = () => {
  let filtered = [...contracts];

  if (searchTerm) {
    filtered = filtered.filter(c => {
      const client = clients.find(cl => cl.id === c.client_id);
      const supplier = suppliers.find(s => s.id === c.supplier_id);
      return (
        c.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter(c => c.status === statusFilter);
  }

  if (typeFilter !== 'all') {
    filtered = filtered.filter(c => c.type === typeFilter);
  }

  setFilteredContracts(filtered);
};
```

**Step 7: Update getClientName/getSupplierName**

```typescript
const getClientName = (clientId: number) => {
  const client = clients.find(c => c.id === clientId);
  return client?.name || 'Unknown';
};

const getSupplierName = (supplierId: number) => {
  const supplier = suppliers.find(s => s.id === supplierId);
  return supplier?.name || 'Unknown';
};
```

**Step 8: Run tests**

Run: `cd pacta_appweb && npm test`
Expected: All existing tests pass

**Step 9: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/ContractsPage.tsx
git commit -m "refactor: migrate ContractsPage from localStorage to API"
```

---

## Task 6: Migrate ClientsPage from localStorage to API

**Files:**
- Modify: `pacta_appweb/src/pages/ClientsPage.tsx`

**Step 1: Replace imports**

```typescript
// REMOVE:
import { getClients, setClients, getCurrentUser } from '@/lib/storage';

// ADD:
import { clientsAPI, CreateClientRequest } from '@/lib/clients-api';
```

**Step 2: Replace loadData and CRUD operations**

Follow the same pattern as ContractsPage:
- `loadData` → `clientsAPI.list()`
- Create → `clientsAPI.create()`
- Update → `clientsAPI.update()`
- Delete → `clientsAPI.delete()`

**Step 3: Run tests and commit**

```bash
cd pacta_appweb && npm test
cd /home/mowgli/pacta && git add pacta_appweb/src/pages/ClientsPage.tsx
git commit -m "refactor: migrate ClientsPage from localStorage to API"
```

---

## Task 7: Migrate SuppliersPage from localStorage to API

**Files:**
- Modify: `pacta_appweb/src/pages/SuppliersPage.tsx`

Same pattern as Tasks 5-6. Replace `getSuppliers/setSuppliers` with `suppliersAPI.*` calls.

```bash
cd pacta_appweb && npm test
cd /home/mowgli/pacta && git add pacta_appweb/src/pages/SuppliersPage.tsx
git commit -m "refactor: migrate SuppliersPage from localStorage to API"
```

---

## Task 8: Migrate DashboardPage and ReportsPage (read-only)

**Files:**
- Modify: `pacta_appweb/src/pages/DashboardPage.tsx`
- Modify: `pacta_appweb/src/pages/ReportsPage.tsx`

**Step 1: DashboardPage**

Replace `import { getContracts, getSupplements } from '@/lib/storage'` with:
```typescript
import { contractsAPI } from '@/lib/contracts-api';
import { supplementsAPI } from '@/lib/supplements-api';
```

Replace `getContracts()` with `await contractsAPI.list()` in useEffect.

**Step 2: ReportsPage**

Same pattern — replace storage imports with API calls.

**Step 3: Run tests and commit**

```bash
cd pacta_appweb && npm test
cd /home/mowgli/pacta && git add pacta_appweb/src/pages/DashboardPage.tsx pacta_appweb/src/pages/ReportsPage.tsx
git commit -m "refactor: migrate DashboardPage and ReportsPage from localStorage to API"
```

---

## Task 9: Migrate ContractDetailsPage and ContractForm

**Files:**
- Modify: `pacta_appweb/src/pages/ContractDetailsPage.tsx`
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Step 1: ContractDetailsPage**

Remove `getContracts` import. Use only `contractsAPI.getById(id)` for fetching contract details.

**Step 2: ContractForm**

Replace `getClients()`, `getSuppliers()`, `getAuthorizedSigners()` with `clientsAPI.list()`, `suppliersAPI.list()`, `signersAPI.list()`.

**Step 3: Run tests and commit**

```bash
cd pacta_appweb && npm test
cd /home/mowgli/pacta && git add pacta_appweb/src/pages/ContractDetailsPage.tsx pacta_appweb/src/components/contracts/ContractForm.tsx
git commit -m "refactor: migrate ContractDetailsPage and ContractForm from localStorage to API"
```

---

## Task 10: Migrate AuthorizedSignersPage

**Files:**
- Modify: `pacta_appweb/src/pages/AuthorizedSignersPage.tsx`

Replace `getClients`, `getSuppliers` with API calls. Add loading state if missing.

```bash
cd pacta_appweb && npm test
cd /home/mowgli/pacta && git add pacta_appweb/src/pages/AuthorizedSignersPage.tsx
git commit -m "refactor: migrate AuthorizedSignersPage from localStorage to API"
```

---

## Task 11: Run full test suite and verify

**Step 1: Run all tests**

```bash
cd pacta_appweb && npm test
```

Expected: All tests pass

**Step 2: Run build**

```bash
cd pacta_appweb && npm run build
```

Expected: No TypeScript errors

**Step 3: Commit**

```bash
cd /home/mowgli/pacta
git add .
git commit -m "chore: verify full build and test suite after API migration"
```

---

## Summary

| Task | Files Changed | Est. Impact |
|------|--------------|-------------|
| 1 | contracts-api.ts + test | New CRUD methods |
| 2 | clients-api.ts + test | New module |
| 3 | suppliers-api.ts + test | New module |
| 4 | signers-api.ts + test | New module |
| 5 | ContractsPage.tsx | Major refactor |
| 6 | ClientsPage.tsx | Medium refactor |
| 7 | SuppliersPage.tsx | Medium refactor |
| 8 | DashboardPage.tsx, ReportsPage.tsx | Light changes |
| 9 | ContractDetailsPage.tsx, ContractForm.tsx | Medium changes |
| 10 | AuthorizedSignersPage.tsx | Medium changes |
| 11 | Full verification | Build + test |
