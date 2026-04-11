# Supplement Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement full-stack supplement workflow with CRUD API, status transitions, internal ID auto-generation, and frontend migration from localStorage to API.

**Architecture:** Backend-first approach. Create SQL migration, Go handlers following the established pattern (signers.go/clients.go), then migrate frontend to use the real API. Status workflow enforced at handler level with transition validation.

**Tech Stack:** Go (chi router, SQLite), React 19 + TypeScript, Zod validation, shadcn/ui

---

## Phase 1: Backend — Migration + Model

### Task 1: SQL Migration for internal_id

**Files:**
- Create: `internal/db/012_supplements_internal_id.sql`

**Step 1: Create migration file**

```sql
-- Add internal_id column for system-generated supplement identifiers
ALTER TABLE supplements ADD COLUMN internal_id TEXT;

-- Backfill existing records with SPL-YYYY-NNNN format
UPDATE supplements SET internal_id = 'SPL-' || strftime('%Y', created_at) || '-' ||
    printf('%04d', (
        SELECT COUNT(*) FROM supplements s2
        WHERE s2.id <= supplements.id
        AND strftime('%Y', s2.created_at) = strftime('%Y', supplements.created_at)
    ))
WHERE internal_id IS NULL;

-- Enforce NOT NULL and uniqueness
UPDATE supplements SET internal_id = '' WHERE internal_id IS NULL;
CREATE UNIQUE INDEX idx_supplements_internal_id ON supplements(internal_id);
```

**Step 2: Verify migration runs**

Run: `go build ./...`
Expected: PASS (migration is embedded, runs on next app start)

**Step 3: Commit**

```bash
git add internal/db/012_supplements_internal_id.sql
git commit -m "feat: add internal_id column to supplements (SPL-YYYY-NNNN)"
```

---

### Task 2: Add Supplement struct to models.go

**Files:**
- Modify: `internal/models/models.go`

**Step 1: Add Supplement struct**

Append to `internal/models/models.go`:

```go
type Supplement struct {
	ID               int        `json:"id"`
	InternalID       string     `json:"internal_id"`
	ContractID       int        `json:"contract_id"`
	SupplementNumber string     `json:"supplement_number"`
	Description      *string    `json:"description,omitempty"`
	EffectiveDate    string     `json:"effective_date"`
	Modifications    *string    `json:"modifications,omitempty"`
	Status           string     `json:"status"`
	ClientSignerID   *int       `json:"client_signer_id,omitempty"`
	SupplierSignerID *int       `json:"supplier_signer_id,omitempty"`
	CreatedBy        *int       `json:"created_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
```

**Step 2: Verify compilation**

Run: `go build ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add internal/models/models.go
git commit -m "feat: add Supplement struct to models"
```

---

## Phase 2: Backend — Handlers

### Task 3: Create supplements.go handler file

**Files:**
- Create: `internal/handlers/supplements.go`

This is the largest task. We'll write the complete file following the pattern from `signers.go` and `contracts.go`.

**Step 1: Write the handler file**

Create `internal/handlers/supplements.go` with:

```go
package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type supplementRow struct {
	ID               int       `json:"id"`
	InternalID       string    `json:"internal_id"`
	ContractID       int       `json:"contract_id"`
	SupplementNumber string    `json:"supplement_number"`
	Description      *string   `json:"description,omitempty"`
	EffectiveDate    string    `json:"effective_date"`
	Modifications    *string   `json:"modifications,omitempty"`
	Status           string    `json:"status"`
	ClientSignerID   *int      `json:"client_signer_id,omitempty"`
	SupplierSignerID *int      `json:"supplier_signer_id,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (h *Handler) HandleSupplements(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listSupplements(w, r)
	case http.MethodPost:
		h.createSupplement(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listSupplements(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, internal_id, contract_id, supplement_number, description,
		       effective_date, modifications, status, client_signer_id, supplier_signer_id,
		       created_at, updated_at
		FROM supplements WHERE deleted_at IS NULL ORDER BY created_at DESC
	`)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list supplements")
		return
	}
	defer rows.Close()

	var supplements []supplementRow
	for rows.Next() {
		var s supplementRow
		if err := rows.Scan(&s.ID, &s.InternalID, &s.ContractID, &s.SupplementNumber,
			&s.Description, &s.EffectiveDate, &s.Modifications, &s.Status,
			&s.ClientSignerID, &s.SupplierSignerID, &s.CreatedAt, &s.UpdatedAt); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list supplements")
			return
		}
		supplements = append(supplements, s)
	}
	if supplements == nil {
		supplements = []supplementRow{}
	}
	h.JSON(w, http.StatusOK, supplements)
}

func (h *Handler) generateSupplementInternalID() (string, error) {
	year := time.Now().Year()
	var maxNum sql.NullInt64
	err := h.DB.QueryRow(`
		SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))
		FROM supplements
		WHERE internal_id LIKE 'SPL-' || ? || '-%'
	`, year).Scan(&maxNum)
	if err != nil {
		return "", err
	}
	next := 1
	if maxNum.Valid {
		next = int(maxNum.Int64) + 1
	}
	return fmt.Sprintf("SPL-%d-%04d", year, next), nil
}

type createSupplementRequest struct {
	ContractID       int     `json:"contract_id"`
	SupplementNumber string  `json:"supplement_number"`
	Description      *string `json:"description"`
	EffectiveDate    string  `json:"effective_date"`
	Modifications    *string `json:"modifications"`
	ClientSignerID   *int    `json:"client_signer_id"`
	SupplierSignerID *int    `json:"supplier_signer_id"`
}

func (h *Handler) createSupplement(w http.ResponseWriter, r *http.Request) {
	var req createSupplementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}

	// Validate contract exists
	var contractExists int
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL", req.ContractID).Scan(&contractExists); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create supplement")
		return
	}
	if contractExists == 0 {
		h.Error(w, http.StatusBadRequest, "contract not found")
		return
	}

	// Validate signers if provided
	if req.ClientSignerID != nil {
		var signerExists int
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM authorized_signers WHERE id = ? AND deleted_at IS NULL", *req.ClientSignerID).Scan(&signerExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create supplement")
			return
		}
		if signerExists == 0 {
			h.Error(w, http.StatusBadRequest, "client signer not found")
			return
		}
	}
	if req.SupplierSignerID != nil {
		var signerExists int
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM authorized_signers WHERE id = ? AND deleted_at IS NULL", *req.SupplierSignerID).Scan(&signerExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create supplement")
			return
		}
		if signerExists == 0 {
			h.Error(w, http.StatusBadRequest, "supplier signer not found")
			return
		}
	}

	internalID, err := h.generateSupplementInternalID()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate internal ID")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(`
		INSERT INTO supplements (internal_id, contract_id, supplement_number, description,
			effective_date, modifications, status, client_signer_id, supplier_signer_id, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, internalID, req.ContractID, req.SupplementNumber, req.Description,
		req.EffectiveDate, req.Modifications, req.Status,
		req.ClientSignerID, req.SupplierSignerID, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create supplement")
		return
	}
	id64, _ := result.LastInsertId()
	id := int(id64)
	h.auditLog(r, userID, "create", "supplement", &id, nil, map[string]interface{}{
		"id":                id,
		"internal_id":       internalID,
		"contract_id":       req.ContractID,
		"supplement_number": req.SupplementNumber,
		"status":            req.Status,
	})
	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"internal_id": internalID,
		"status":      "created",
	})
}

func (h *Handler) HandleSupplementByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/supplements/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getSupplement(w, id)
	case http.MethodPut:
		h.updateSupplement(w, r, id)
	case http.MethodDelete:
		h.deleteSupplement(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getSupplement(w http.ResponseWriter, id int) {
	var s supplementRow
	err := h.DB.QueryRow(`
		SELECT id, internal_id, contract_id, supplement_number, description,
		       effective_date, modifications, status, client_signer_id, supplier_signer_id,
		       created_at, updated_at
		FROM supplements WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&s.ID, &s.InternalID, &s.ContractID, &s.SupplementNumber,
		&s.Description, &s.EffectiveDate, &s.Modifications, &s.Status,
		&s.ClientSignerID, &s.SupplierSignerID, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}
	h.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSupplement(w http.ResponseWriter, r *http.Request, id int) {
	var req createSupplementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate contract exists if contract_id is being changed
	if req.ContractID > 0 {
		var contractExists int
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL", req.ContractID).Scan(&contractExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to update supplement")
			return
		}
		if contractExists == 0 {
			h.Error(w, http.StatusBadRequest, "contract not found")
			return
		}
	}

	// Fetch previous state for audit
	var prevContractID, prevSupplementNumber string
	var prevDescription, prevEffectiveDate, prevModifications, prevStatus *string
	var prevClientSignerID, prevSupplierSignerID *int
	err := h.DB.QueryRow(`
		SELECT contract_id, supplement_number, description, effective_date,
		       modifications, status, client_signer_id, supplier_signer_id
		FROM supplements WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&prevContractID, &prevSupplementNumber, &prevDescription,
		&prevEffectiveDate, &prevModifications, &prevStatus,
		&prevClientSignerID, &prevSupplierSignerID)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	_, err = h.DB.Exec(`
		UPDATE supplements SET contract_id=?, supplement_number=?, description=?,
			effective_date=?, modifications=?, status=?, client_signer_id=?, supplier_signer_id=?,
			updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, req.ContractID, req.SupplementNumber, req.Description,
		req.EffectiveDate, req.Modifications, req.Status,
		req.ClientSignerID, req.SupplierSignerID, id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplement")
		return
	}

	h.auditLog(r, h.getUserID(r), "update", "supplement", &id, map[string]interface{}{
		"id":                id,
		"contract_id":       prevContractID,
		"supplement_number": prevSupplementNumber,
		"description":       prevDescription,
		"effective_date":    prevEffectiveDate,
		"modifications":     prevModifications,
		"status":            prevStatus,
	}, map[string]interface{}{
		"id":                id,
		"contract_id":       req.ContractID,
		"supplement_number": req.SupplementNumber,
		"description":       req.Description,
		"effective_date":    req.EffectiveDate,
		"modifications":     req.Modifications,
		"status":            req.Status,
	})
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteSupplement(w http.ResponseWriter, r *http.Request, id int) {
	var prevSupplementNumber, prevStatus string
	err := h.DB.QueryRow("SELECT supplement_number, status FROM supplements WHERE id = ? AND deleted_at IS NULL", id).Scan(&prevSupplementNumber, &prevStatus)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	_, err = h.DB.Exec("UPDATE supplements SET deleted_at=CURRENT_TIMESTAMP WHERE id=?", id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete supplement")
		return
	}
	h.auditLog(r, h.getUserID(r), "delete", "supplement", &id, map[string]interface{}{
		"id":                id,
		"supplement_number": prevSupplementNumber,
		"status":            prevStatus,
	}, nil)
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Step 2: Verify compilation**

Run: `go build ./...`
Expected: PASS (handlers compile, routes not yet added)

**Step 3: Commit**

```bash
git add internal/handlers/supplements.go
git commit -m "feat: add supplement CRUD handlers with FK validation and audit logging"
```

---

### Task 4: Add routes to server.go

**Files:**
- Modify: `internal/server/server.go`

**Step 1: Add supplement routes**

In the authenticated routes group, after the signers routes, add:

```go
r.Get("/api/supplements", h.HandleSupplements)
r.Post("/api/supplements", h.HandleSupplements)
r.Get("/api/supplements/{id}", h.HandleSupplementByID)
r.Put("/api/supplements/{id}", h.HandleSupplementByID)
r.Patch("/api/supplements/{id}/status", h.HandleSupplementStatus)
r.Delete("/api/supplements/{id}", h.HandleSupplementByID)
```

**Step 2: Verify compilation**

Run: `go build ./...`
Expected: FAIL — `h.HandleSupplementStatus` not defined yet (next task)

**Step 3: Commit**

```bash
git add internal/server/server.go
git commit -m "feat: add supplement API routes"
```

---

### Task 5: Implement status transition handler

**Files:**
- Modify: `internal/handlers/supplements.go`

**Step 1: Add HandleSupplementStatus method**

Append to `supplements.go`:

```go
func (h *Handler) HandleSupplementStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/supplements/")
	idStr = strings.TrimSuffix(idStr, "/status")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate status value
	if req.Status != "draft" && req.Status != "approved" && req.Status != "active" {
		h.Error(w, http.StatusBadRequest, "status must be 'draft', 'approved', or 'active'")
		return
	}

	// Get current status
	var currentStatus string
	err = h.DB.QueryRow("SELECT status FROM supplements WHERE id = ? AND deleted_at IS NULL", id).Scan(&currentStatus)
	if err != nil {
		h.Error(w, http.StatusNotFound, "supplement not found")
		return
	}

	// Validate transition
	validTransitions := map[string][]string{
		"draft":    {"approved"},
		"approved": {"draft", "active"},
		"active":   {},
	}
	allowed := validTransitions[currentStatus]
	transitionAllowed := false
	for _, a := range allowed {
		if a == req.Status {
			transitionAllowed = true
			break
		}
	}
	if !transitionAllowed {
		h.Error(w, http.StatusBadRequest, fmt.Sprintf("cannot transition from '%s' to '%s'", currentStatus, req.Status))
		return
	}

	// Update status
	_, err = h.DB.Exec("UPDATE supplements SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL", req.Status, id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update supplement status")
		return
	}

	h.auditLog(r, h.getUserID(r), "status_change", "supplement", &id, map[string]interface{}{
		"id":     id,
		"status": currentStatus,
	}, map[string]interface{}{
		"id":     id,
		"status": req.Status,
	})
	h.JSON(w, http.StatusOK, map[string]interface{}{
		"status":          req.Status,
		"previous_status": currentStatus,
	})
}
```

**Step 2: Verify compilation**

Run: `go build ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add internal/handlers/supplements.go
git commit -m "feat: add supplement status transition handler with workflow validation"
```

---

### Task 6: Verify backend builds cleanly

**Step 1: Full build**

Run: `go build ./...`
Expected: PASS — no errors

**Step 2: Vet**

Run: `go vet ./...`
Expected: PASS — no issues

**Step 3: Commit checkpoint**

```bash
git status  # verify clean working tree
```

---

## Phase 3: Frontend — Types + API Client

### Task 7: Update TypeScript types

**Files:**
- Modify: `pacta_appweb/src/types/index.ts`

**Step 1: Update Supplement interface**

Replace the existing `Supplement` interface with:

```ts
export interface Supplement {
  id: number;
  internal_id: string;
  contract_id: number;
  supplement_number: string;
  description: string | null;
  effective_date: string;
  modifications: string | null;
  status: SupplementStatus;
  client_signer_id: number | null;
  supplier_signer_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Add request types**

After the Supplement interface, add:

```ts
export interface CreateSupplementRequest {
  contract_id: number;
  supplement_number: string;
  description?: string;
  effective_date: string;
  modifications?: string;
  client_signer_id?: number;
  supplier_signer_id?: number;
}

export interface UpdateSupplementRequest {
  contract_id?: number;
  supplement_number?: string;
  description?: string;
  effective_date?: string;
  modifications?: string;
  status?: SupplementStatus;
  client_signer_id?: number;
  supplier_signer_id?: number;
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: May have errors in pages using old Supplement shape (will fix in next tasks)

**Step 4: Commit**

```bash
git add pacta_appweb/src/types/index.ts
git commit -m "feat: update Supplement type with internal_id and API request types"
```

---

### Task 8: Create supplements API module

**Files:**
- Create: `pacta_appweb/src/lib/supplements-api.ts`

**Step 1: Create API module**

```ts
import { Supplement, CreateSupplementRequest, UpdateSupplementRequest, SupplementStatus } from '@/types';

const BASE = '/api/supplements';

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

export const supplementsAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<Supplement[]>(BASE, { signal }),

  create: (data: CreateSupplementRequest, signal?: AbortSignal) =>
    fetchJSON(BASE, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }),

  update: (id: number, data: UpdateSupplementRequest, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }),

  transitionStatus: (id: number, status: SupplementStatus, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      signal,
    }),

  delete: (id: number, signal?: AbortSignal) =>
    fetchJSON(`${BASE}/${id}`, {
      method: 'DELETE',
      signal,
    }),
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: PASS (this file has no errors)

**Step 3: Commit**

```bash
git add pacta_appweb/src/lib/supplements-api.ts
git commit -m "feat: add supplements API client with AbortController support"
```

---

## Phase 4: Frontend — Page Refactor

### Task 9: Refactor SupplementsPage.tsx to use API

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx`

**Step 1: Replace imports**

Remove:
```ts
import { getSupplements, setSupplements, getContracts, getCurrentUser } from '@/lib/storage';
import { addAuditLog } from '@/lib/audit';
```

Add:
```ts
import { supplementsAPI } from '@/lib/supplements-api';
import { contractsAPI } from '@/lib/contracts-api'; // if exists, else create similar pattern
```

**Step 2: Replace state and data loading**

Replace localStorage-based state with:

```ts
const [supplements, setSupplementsState] = useState<Supplement[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const controller = new AbortController();
  loadData(controller.signal);
  return () => controller.abort();
}, []);

const loadData = async (signal?: AbortSignal) => {
  try {
    setLoading(true);
    const data = await supplementsAPI.list(signal);
    setSupplementsState(data);
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      setError(err.message);
    }
  } finally {
    setLoading(false);
  }
};
```

**Step 3: Replace handleSubmit**

```ts
const handleSubmit = async (data: CreateSupplementRequest) => {
  try {
    if (editingSupplement) {
      await supplementsAPI.update(editingSupplement.id, data);
      toast.success('Supplement updated successfully');
    } else {
      await supplementsAPI.create(data);
      toast.success('Supplement created successfully');
    }
    resetForm();
    loadData();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Operation failed');
  }
};
```

**Step 4: Replace handleDelete**

```ts
const handleDelete = async (id: number) => {
  try {
    await supplementsAPI.delete(id);
    toast.success('Supplement deleted successfully');
    loadData();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Delete failed');
  }
};
```

**Step 5: Add status transition buttons**

In the Actions column of the table, after edit/delete buttons, add:

```tsx
{supplement.status === 'draft' && hasPermission('manager') && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleStatusChange(supplement.id, 'approved')}
    aria-label={`Approve supplement ${supplement.supplement_number}`}
  >
    Approve
  </Button>
)}
{supplement.status === 'approved' && hasPermission('manager') && (
  <>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleStatusChange(supplement.id, 'active')}
      aria-label={`Activate supplement ${supplement.supplement_number}`}
    >
      Activate
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleStatusChange(supplement.id, 'draft')}
      aria-label={`Return supplement ${supplement.supplement_number} to draft`}
    >
      Return
    </Button>
  </>
)}
```

**Step 6: Add handleStatusChange**

```ts
const handleStatusChange = async (id: number, status: SupplementStatus) => {
  try {
    await supplementsAPI.transitionStatus(id, status);
    toast.success(`Supplement ${status}`);
    loadData();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Status change failed');
  }
};
```

**Step 7: Update table to use snake_case fields**

Change all references:
- `supplement.id` stays (number now)
- `supplement.contractId` → `supplement.contract_id`
- `supplement.supplementNumber` → `supplement.supplement_number`
- `supplement.effectiveDate` → `supplement.effective_date`
- `supplement.createdAt` → `supplement.created_at`
- `supplement.status` stays

**Step 8: Update getContractInfo**

Since contracts now come from API, the function needs API-fetched contracts. For now, show `contract_id` as text. Full contract name resolution comes in Task 11.

**Step 9: Verify TypeScript compiles**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: Fix any remaining type errors

**Step 10: Commit**

```bash
git add pacta_appweb/src/pages/SupplementsPage.tsx
git commit -m "refactor: migrate SupplementsPage from localStorage to API"
```

---

### Task 10: Refactor SupplementForm.tsx

**Files:**
- Modify: `pacta_appweb/src/components/supplements/SupplementForm.tsx`

**Step 1: Update props interface**

Replace the current props with API-based ones:

```ts
interface SupplementFormProps {
  onSubmit: (data: CreateSupplementRequest) => Promise<void>;
  editingSupplement?: Supplement;
  contracts: Array<{ id: number; internal_id: string; contract_number: string; title: string }>;
  onCancel: () => void;
}
```

**Step 2: Remove localStorage dependencies**

Remove:
- `upload` import (document upload not in scope for this phase)
- `documentUrl`, `documentKey`, `documentName` fields
- File upload handlers

**Step 3: Update form fields to use snake_case**

- `contractId` → `contract_id`
- `supplementNumber` → `supplement_number`
- `effectiveDate` → `effective_date`

**Step 4: Remove status dropdown from form**

Status is now managed via workflow buttons (PATCH /status), not via the create/edit form. Remove the status Select component.

**Step 5: Add error display**

Add local state for form errors and display API error messages.

**Step 6: Verify TypeScript compiles**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add pacta_appweb/src/components/supplements/SupplementForm.tsx
git commit -m "refactor: migrate SupplementForm to API-based props"
```

---

### Task 11: Add contracts API module (if not exists)

**Files:**
- Check: `pacta_appweb/src/lib/contracts-api.ts`
- Create if missing: `pacta_appweb/src/lib/contracts-api.ts`

**Step 1: Check if contracts API exists**

If it doesn't exist, create:

```ts
import { Contract } from '@/types';

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

export const contractsAPI = {
  list: (signal?: AbortSignal) =>
    fetchJSON<Contract[]>(BASE, { signal }),
};
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/contracts-api.ts
git commit -m "feat: add contracts API client"
```

---

### Task 12: Add supplements section to ContractDetailsPage

**Files:**
- Modify: `pacta_appweb/src/pages/ContractDetailsPage.tsx`

**Step 1: Add supplements section**

After the contract details, add a supplements list section:

```tsx
<div className="mt-8">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold">Supplements</h2>
    <Button onClick={() => navigate(`/supplements?action=create&contractId=${contractId}`)}>
      <Plus className="mr-2 h-4 w-4" />
      Add Supplement
    </Button>
  </div>
  {/* Supplements table or "No supplements yet" message */}
</div>
```

**Step 2: Fetch supplements for this contract**

Add a `useEffect` that calls `supplementsAPI.list()` and filters by `contract_id`.

**Step 3: Verify TypeScript compiles**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/ContractDetailsPage.tsx
git commit -m "feat: add supplements section to ContractDetailsPage"
```

---

## Phase 5: Build + Verify

### Task 13: Full build verification

**Step 1: Build frontend**

Run: `cd pacta_appweb && npm run build`
Expected: PASS — no TypeScript errors, clean build output

**Step 2: Build backend**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: PASS

**Step 3: Vet**

Run: `go vet ./...`
Expected: PASS

---

### Task 14: Update PROJECT_SUMMARY.md

**Files:**
- Modify: `docs/PROJECT_SUMMARY.md`

**Step 1: Add to Completed section**

Add under a new "Completed (v0.9.0)" heading:

```markdown
### Completed (v0.9.0)

- [x] Supplement CRUD endpoints (create, read, update, soft delete)
- [x] Supplement internal IDs (auto-generated `SPL-YYYY-NNNN`)
- [x] Supplement status transition workflow (draft → approved → active with rollback)
- [x] FK validation on supplement create (contract, signers)
- [x] Audit logging on all supplement operations
- [x] Frontend migration from localStorage to API (SupplementsPage, SupplementForm)
- [x] Supplements section in ContractDetailsPage
```

**Step 2: Update Pending sections**

Move supplement-related items from Pending to Completed.

**Step 3: Commit**

```bash
git add docs/PROJECT_SUMMARY.md
git commit -m "docs: update PROJECT_SUMMARY.md with v0.9.0 supplement workflow"
```

---

## Summary of Files Changed

| File | Action | Phase |
|------|--------|-------|
| `internal/db/012_supplements_internal_id.sql` | Create | 1 |
| `internal/models/models.go` | Modify | 1 |
| `internal/handlers/supplements.go` | Create | 2 |
| `internal/server/server.go` | Modify | 2 |
| `pacta_appweb/src/types/index.ts` | Modify | 3 |
| `pacta_appweb/src/lib/supplements-api.ts` | Create | 3 |
| `pacta_appweb/src/pages/SupplementsPage.tsx` | Refactor | 4 |
| `pacta_appweb/src/components/supplements/SupplementForm.tsx` | Refactor | 4 |
| `pacta_appweb/src/lib/contracts-api.ts` | Create (if missing) | 4 |
| `pacta_appweb/src/pages/ContractDetailsPage.tsx` | Modify | 4 |
| `docs/PROJECT_SUMMARY.md` | Modify | 5 |
