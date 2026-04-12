# Design: localStorage → Backend API Migration

## Problem

Frontend stores Contracts, Clients, Suppliers, and AuthorizedSigners in `localStorage` while Supplements, Users, Documents, and Notifications use the Go backend API. This causes:

- Data isolation: contracts and supplements live in separate stores
- No multi-user support for contracts
- No audit trail for contract CRUD
- Data lost on browser clear

## Solution

Migrate all localStorage-based pages to use the existing Go backend API endpoints.

## Architecture

### New API Modules

| File | Status | CRUD Operations |
|------|--------|-----------------|
| `src/lib/contracts-api.ts` | Expand existing | list, getById, create, update, delete |
| `src/lib/clients-api.ts` | New | list, getById, create, update, delete |
| `src/lib/suppliers-api.ts` | New | list, getById, create, update, delete |
| `src/lib/signers-api.ts` | New | list, getById, create, update, delete |

Pattern: Follow `supplements-api.ts` structure with `fetchJSON` helper, AbortSignal support, typed requests/responses.

### Pages to Migrate

| Page | Current Source | Target API |
|------|---------------|------------|
| ContractsPage | `getContracts()`, `setContracts()` | `contractsAPI.*` |
| ClientsPage | `getClients()`, `setClients()` | `clientsAPI.*` |
| SuppliersPage | `getSuppliers()`, `setSuppliers()` | `suppliersAPI.*` |
| DashboardPage | `getContracts()` (read) | `contractsAPI.list()` |
| ReportsPage | `getContracts()`, `getSupplements()` | `contractsAPI.list()`, `supplementsAPI.list()` |
| ContractDetailsPage | `getContracts()` + API mix | `contractsAPI.getById()` only |
| ContractForm | `getClients()`, `getSuppliers()` | `clientsAPI.list()`, `suppliersAPI.list()` |
| AuthorizedSignersPage | `getClients()`, `getSuppliers()` | `clientsAPI.list()`, `suppliersAPI.list()` |

### Data Flow

```
Page Component → API Module → fetch() → Go Backend → SQLite → JSON Response → State
```

### Error Handling Pattern

```typescript
const loadData = useCallback(async (signal?: AbortSignal) => {
  try {
    setLoading(true);
    setError(null);
    const data = await someAPI.list(signal);
    setState(data);
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      setError(err.message);
    }
  } finally {
    setLoading(false);
  }
}, []);
```

### Testing

- Vitest with jsdom environment (already configured)
- Mock `fetch` for API module tests
- Coverage threshold: 80% (already configured)
- Test files: `src/__tests__/{contracts,clients,suppliers,signers}-api.test.ts`

## Backend Endpoints (Already Exist)

All endpoints confirmed in `internal/server/server.go`:

- `GET/POST /api/contracts` — Editor+ for POST
- `GET/PUT/DELETE /api/contracts/{id}` — Manager+ for DELETE
- `GET/POST /api/clients` — Editor+ for POST
- `GET/PUT/DELETE /api/clients/{id}` — Manager+ for DELETE
- `GET/POST /api/suppliers` — Editor+ for POST
- `GET/PUT/DELETE /api/suppliers/{id}` — Manager+ for DELETE
- `GET/POST /api/signers` — Editor+ for POST
- `GET/PUT/DELETE /api/signers/{id}` — Manager+ for DELETE

All endpoints require auth + company context via middleware.

## Anti-patterns to Avoid

- No hybrid localStorage + API fallback
- No sync logic between local and remote
- No speculative features beyond CRUD migration
- Keep existing UI behavior unchanged — only data source changes
