# Signer CRUD Endpoints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete CRUD API endpoints for authorized signers (GET, POST, PUT, DELETE /api/signers) to enable management of people authorized to sign contracts on behalf of clients or suppliers.

**Architecture:** Follow the exact handler pattern established in `clients.go` and `suppliers.go`: two handler functions (`HandleSigners` for list/create, `HandleSignerByID` for get/update/delete) with soft delete support, sanitized error messages, and foreign key validation. Routes registered in the authenticated API group in `server.go`.

**Tech Stack:** Go 1.25, database/sql, SQLite (`modernc.org/sqlite`), go-chi/chi router

---

## Context for Engineer

### What are Signers?

Signers are people authorized to sign contracts on behalf of a company (client or supplier). Each signer is linked to either a client or a supplier via `company_id` + `company_type` (polymorphic association). Contracts reference signers via `client_signer_id` and `supplier_signer_id` columns.

### Database Schema (already exists — migration `004_authorized_signers.sql`)

```sql
CREATE TABLE IF NOT EXISTS authorized_signers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    company_type TEXT NOT NULL CHECK (company_type IN ('client', 'supplier')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id, company_type);
```

### Existing Patterns to Follow

**Handler structure** (from `clients.go`, `suppliers.go`):
- `HandleXxx` — handles GET (list all) and POST (create)
- `HandleXxxByID` — handles GET, PUT, DELETE for a specific ID
- Private helper methods: `listXxx`, `createXxx`, `getXxx`, `updateXxx`, `deleteXxx`
- Row struct for JSON serialization (e.g., `clientRow`, `supplierRow`)
- Request struct for create/update (e.g., `createClientRequest`)
- Soft delete via `UPDATE ... SET deleted_at=CURRENT_TIMESTAMP`
- Error sanitization: generic messages to client, details logged server-side

**Route registration** (from `server.go`):
```go
r.Get("/api/clients", h.HandleClients)
r.Post("/api/clients", h.HandleClients)
r.Get("/api/clients/{id}", h.HandleClientByID)
r.Put("/api/clients/{id}", h.HandleClientByID)
r.Delete("/api/clients/{id}", h.HandleClientByID)
```

**ID extraction pattern**:
```go
idStr := strings.TrimPrefix(r.URL.Path, "/api/clients/")
id, err := strconv.Atoi(idStr)
```

### Foreign Key Validation Requirement

Following the H-001 fix pattern from `contracts.go`, validate that `company_id` references an existing client or supplier BEFORE attempting INSERT/UPDATE. This prevents orphaned signers and returns clean 400 errors instead of raw SQLite constraint violations.

### No Existing Tests

The project has zero test files. We will NOT add tests in this plan to keep scope focused. Testing will be done via manual curl commands. A future iteration will add the full test suite.

---

## Task List

### Task 1: Add Signer struct to models.go

**Files:**
- Modify: `internal/models/models.go`

**Step 1: Add Signer struct**

Add the following struct to `internal/models/models.go`, placing it after the `Supplier` struct and before the `Contract` struct:

```go
type Signer struct {
	ID          int       `json:"id"`
	CompanyID   int       `json:"company_id"`
	CompanyType string    `json:"company_type"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	Position    *string   `json:"position,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Email       *string   `json:"email,omitempty"`
	CreatedBy   *int      `json:"created_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
```

**Step 2: Verify build**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/models/models.go
git commit -m "feat: add Signer model struct"
```

---

### Task 2: Create signer handler file (signers.go)

**Files:**
- Create: `internal/handlers/signers.go`

**Step 1: Create the file with package, imports, and row struct**

Create `internal/handlers/signers.go` with:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type signerRow struct {
	ID          int     `json:"id"`
	CompanyID   int     `json:"company_id"`
	CompanyType string  `json:"company_type"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	Position    *string `json:"position,omitempty"`
	Phone       *string `json:"phone,omitempty"`
	Email       *string `json:"email,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}
```

**Step 2: Add HandleSigners method (list + create)**

```go
func (h *Handler) HandleSigners(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listSigners(w, r)
	case http.MethodPost:
		h.createSigner(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
```

**Step 3: Add listSigners method**

```go
func (h *Handler) listSigners(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
		FROM authorized_signers WHERE deleted_at IS NULL ORDER BY last_name, first_name
	`)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list signers")
		return
	}
	defer rows.Close()

	var signers []signerRow
	for rows.Next() {
		var s signerRow
		rows.Scan(&s.ID, &s.CompanyID, &s.CompanyType, &s.FirstName, &s.LastName, &s.Position, &s.Phone, &s.Email, &s.CreatedAt, &s.UpdatedAt)
		signers = append(signers, s)
	}
	if signers == nil {
		signers = []signerRow{}
	}
	h.JSON(w, http.StatusOK, signers)
}
```

**Step 4: Add createSignerRequest struct and createSigner method**

```go
type createSignerRequest struct {
	CompanyID   int    `json:"company_id"`
	CompanyType string `json:"company_type"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Position    string `json:"position"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
}

func (h *Handler) createSigner(w http.ResponseWriter, r *http.Request) {
	var req createSignerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate company_type
	if req.CompanyType != "client" && req.CompanyType != "supplier" {
		h.Error(w, http.StatusBadRequest, "company_type must be 'client' or 'supplier'")
		return
	}

	// Validate foreign key: check company exists
	var companyExists int
	if req.CompanyType == "client" {
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM clients WHERE id = ? AND deleted_at IS NULL", req.CompanyID).Scan(&companyExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create signer")
			return
		}
	} else {
		if err := h.DB.QueryRow("SELECT COUNT(*) FROM suppliers WHERE id = ? AND deleted_at IS NULL", req.CompanyID).Scan(&companyExists); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to create signer")
			return
		}
	}
	if companyExists == 0 {
		h.Error(w, http.StatusBadRequest, req.CompanyType+" not found")
		return
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(
		"INSERT INTO authorized_signers (company_id, company_type, first_name, last_name, position, phone, email, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		req.CompanyID, req.CompanyType, req.FirstName, req.LastName, req.Position, req.Phone, req.Email, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create signer")
		return
	}
	id, _ := result.LastInsertId()
	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}
```

**Step 5: Add HandleSignerByID method**

```go
func (h *Handler) HandleSignerByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/signers/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getSigner(w, id)
	case http.MethodPut:
		h.updateSigner(w, r, id)
	case http.MethodDelete:
		h.deleteSigner(w, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
```

**Step 6: Add getSigner method**

```go
func (h *Handler) getSigner(w http.ResponseWriter, id int) {
	var s signerRow
	err := h.DB.QueryRow(`
		SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
		FROM authorized_signers WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&s.ID, &s.CompanyID, &s.CompanyType, &s.FirstName, &s.LastName, &s.Position, &s.Phone, &s.Email, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.JSON(w, http.StatusOK, s)
}
```

**Step 7: Add updateSigner method**

```go
func (h *Handler) updateSigner(w http.ResponseWriter, r *http.Request, id int) {
	var req createSignerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate company_type if provided
	if req.CompanyType != "" && req.CompanyType != "client" && req.CompanyType != "supplier" {
		h.Error(w, http.StatusBadRequest, "company_type must be 'client' or 'supplier'")
		return
	}

	// Validate foreign key if company_id is provided
	if req.CompanyID > 0 {
		companyType := req.CompanyType
		if companyType == "" {
			// Fetch existing company_type to validate against
			var existingType string
			if err := h.DB.QueryRow("SELECT company_type FROM authorized_signers WHERE id = ? AND deleted_at IS NULL", id).Scan(&existingType); err != nil {
				h.Error(w, http.StatusNotFound, "signer not found")
				return
			}
			companyType = existingType
		}

		var companyExists int
		if companyType == "client" {
			if err := h.DB.QueryRow("SELECT COUNT(*) FROM clients WHERE id = ? AND deleted_at IS NULL", req.CompanyID).Scan(&companyExists); err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to update signer")
				return
			}
		} else {
			if err := h.DB.QueryRow("SELECT COUNT(*) FROM suppliers WHERE id = ? AND deleted_at IS NULL", req.CompanyID).Scan(&companyExists); err != nil {
				h.Error(w, http.StatusInternalServerError, "failed to update signer")
				return
			}
		}
		if companyExists == 0 {
			h.Error(w, http.StatusBadRequest, companyType+" not found")
			return
		}
	}

	result, err := h.DB.Exec(`
		UPDATE authorized_signers SET company_id=?, company_type=?, first_name=?, last_name=?, position=?, phone=?, email=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, req.CompanyID, req.CompanyType, req.FirstName, req.LastName, req.Position, req.Phone, req.Email, id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update signer")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
```

**Step 8: Add deleteSigner method**

```go
func (h *Handler) deleteSigner(w http.ResponseWriter, id int) {
	result, err := h.DB.Exec(
		"UPDATE authorized_signers SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",
		id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete signer")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		h.Error(w, http.StatusNotFound, "signer not found")
		return
	}
	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Step 9: Verify build**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: No errors

**Step 10: Commit**

```bash
git add internal/handlers/signers.go
git commit -m "feat: add signer CRUD handlers"
```

---

### Task 3: Register signer routes in server.go

**Files:**
- Modify: `internal/server/server.go`

**Step 1: Add signer routes**

In `internal/server/server.go`, inside the `r.Group(func(r chi.Router) { ... })` block, after the suppliers routes and before the closing `})`, add:

```go
		r.Get("/api/signers", h.HandleSigners)
		r.Post("/api/signers", h.HandleSigners)
		r.Get("/api/signers/{id}", h.HandleSignerByID)
		r.Put("/api/signers/{id}", h.HandleSignerByID)
		r.Delete("/api/signers/{id}", h.HandleSignerByID)
```

The full authenticated group should now look like:

```go
	r.Group(func(r chi.Router) {
		r.Use(h.AuthMiddleware)

		r.Get("/api/auth/me", h.HandleMe)

		r.Get("/api/contracts", h.HandleContracts)
		r.Post("/api/contracts", h.HandleContracts)
		r.Get("/api/contracts/{id}", h.HandleContractByID)
		r.Put("/api/contracts/{id}", h.HandleContractByID)
		r.Delete("/api/contracts/{id}", h.HandleContractByID)

		r.Get("/api/clients", h.HandleClients)
		r.Post("/api/clients", h.HandleClients)
		r.Get("/api/clients/{id}", h.HandleClientByID)
		r.Put("/api/clients/{id}", h.HandleClientByID)
		r.Delete("/api/clients/{id}", h.HandleClientByID)

		r.Get("/api/suppliers", h.HandleSuppliers)
		r.Post("/api/suppliers", h.HandleSuppliers)
		r.Get("/api/suppliers/{id}", h.HandleSupplierByID)
		r.Put("/api/suppliers/{id}", h.HandleSupplierByID)
		r.Delete("/api/suppliers/{id}", h.HandleSupplierByID)

		r.Get("/api/signers", h.HandleSigners)
		r.Post("/api/signers", h.HandleSigners)
		r.Get("/api/signers/{id}", h.HandleSignerByID)
		r.Put("/api/signers/{id}", h.HandleSignerByID)
		r.Delete("/api/signers/{id}", h.HandleSignerByID)
	})
```

**Step 2: Verify build**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/server/server.go
git commit -m "feat: register signer routes"
```

---

### Task 4: Build and start the application

**Files:**
- None (build + run only)

**Step 1: Build the application**

Run: `cd /home/mowgli/pacta && go build -o pacta ./cmd/pacta`
Expected: Binary created at `./pacta`, no errors

**Step 2: Start the application**

Run: `./pacta &`
Expected: "PACTA v0.6.0 running on http://127.0.0.1:8080" (or configured port)

**Step 3: Verify application is running**

Run: `curl -s http://127.0.0.1:8080/ | head -5`
Expected: HTML content from embedded frontend

---

### Task 5: Manual API testing — Authentication

**Files:**
- None (manual testing)

**Step 1: Login to get session cookie**

Run:
```bash
curl -s -c /tmp/pacta_cookie.txt -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"<your-admin-password>"}'
```
Expected: `{"status":"ok"}` or similar success response

**Step 2: Verify cookie was saved**

Run: `cat /tmp/pacta_cookie.txt`
Expected: Session cookie entry

---

### Task 6: Manual API testing — Create Signers

**Files:**
- None (manual testing)

**Step 1: Create a signer for a client**

First, get a client ID:
```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/clients
```
Note the `id` of the first client (e.g., `1`).

Create signer:
```bash
curl -s -b /tmp/pacta_cookie.txt -X POST http://127.0.0.1:8080/api/signers \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "company_type": "client",
    "first_name": "John",
    "last_name": "Doe",
    "position": "CEO",
    "phone": "+50212345678",
    "email": "john.doe@testcorp.com"
  }'
```
Expected: `{"id":1,"status":"created"}` with HTTP 201

**Step 2: Create a signer for a supplier**

First, get a supplier ID:
```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/suppliers
```
Note the `id` of the first supplier (e.g., `1`).

Create signer:
```bash
curl -s -b /tmp/pacta_cookie.txt -X POST http://127.0.0.1:8080/api/signers \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "company_type": "supplier",
    "first_name": "Jane",
    "last_name": "Smith",
    "position": "Director",
    "phone": "+50287654321",
    "email": "jane.smith@supplyco.com"
  }'
```
Expected: `{"id":2,"status":"created"}` with HTTP 201

**Step 3: Test invalid company_type**

```bash
curl -s -b /tmp/pacta_cookie.txt -X POST http://127.0.0.1:8080/api/signers \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "company_type": "invalid",
    "first_name": "Bad",
    "last_name": "Actor",
    "position": "Hacker",
    "phone": "000",
    "email": "bad@evil.com"
  }'
```
Expected: `{"error":"company_type must be 'client' or 'supplier'"}` with HTTP 400

**Step 4: Test non-existent company (FK validation)**

```bash
curl -s -b /tmp/pacta_cookie.txt -X POST http://127.0.0.1:8080/api/signers \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 99999,
    "company_type": "client",
    "first_name": "Ghost",
    "last_name": "User",
    "position": "None",
    "phone": "000",
    "email": "ghost@nowhere.com"
  }'
```
Expected: `{"error":"client not found"}` with HTTP 400

---

### Task 7: Manual API testing — List and Get Signers

**Files:**
- None (manual testing)

**Step 1: List all signers**

```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/signers
```
Expected: Array of signers created in Task 6, HTTP 200
```json
[
  {"id":1,"company_id":1,"company_type":"client","first_name":"John","last_name":"Doe","position":"CEO","phone":"+50212345678","email":"john.doe@testcorp.com","created_at":"...","updated_at":"..."},
  {"id":2,"company_id":1,"company_type":"supplier","first_name":"Jane","last_name":"Smith","position":"Director","phone":"+50287654321","email":"jane.smith@supplyco.com","created_at":"...","updated_at":"..."}
]
```

**Step 2: Get signer by ID**

```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/signers/1
```
Expected: Single signer object, HTTP 200

**Step 3: Get non-existent signer**

```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/signers/99999
```
Expected: `{"error":"signer not found"}` with HTTP 404

---

### Task 8: Manual API testing — Update Signer

**Files:**
- None (manual testing)

**Step 1: Update a signer**

```bash
curl -s -b /tmp/pacta_cookie.txt -X PUT http://127.0.0.1:8080/api/signers/1 \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "company_type": "client",
    "first_name": "John",
    "last_name": "Doe",
    "position": "CTO",
    "phone": "+50212345678",
    "email": "john.doe@testcorp.com"
  }'
```
Expected: `{"status":"updated"}` with HTTP 200

**Step 2: Verify update**

```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/signers/1
```
Expected: `position` field now shows "CTO"

**Step 3: Update non-existent signer**

```bash
curl -s -b /tmp/pacta_cookie.txt -X PUT http://127.0.0.1:8080/api/signers/99999 \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "company_type": "client",
    "first_name": "Nobody",
    "last_name": "Here",
    "position": "None",
    "phone": "000",
    "email": "nobody@nowhere.com"
  }'
```
Expected: `{"error":"signer not found"}` with HTTP 404

---

### Task 9: Manual API testing — Delete Signer

**Files:**
- None (manual testing)

**Step 1: Delete a signer**

```bash
curl -s -b /tmp/pacta_cookie.txt -X DELETE http://127.0.0.1:8080/api/signers/2
```
Expected: `{"status":"deleted"}` with HTTP 200

**Step 2: Verify deleted signer returns 404**

```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/signers/2
```
Expected: `{"error":"signer not found"}` with HTTP 404

**Step 3: Verify deleted signer not in list**

```bash
curl -s -b /tmp/pacta_cookie.txt http://127.0.0.1:8080/api/signers
```
Expected: Array contains only signer 1 (signer 2 excluded due to `deleted_at IS NULL` filter)

**Step 4: Double delete returns 404**

```bash
curl -s -b /tmp/pacta_cookie.txt -X DELETE http://127.0.0.1:8080/api/signers/2
```
Expected: `{"error":"signer not found"}` with HTTP 404

---

### Task 10: Method not allowed tests

**Files:**
- None (manual testing)

**Step 1: Test PUT on list endpoint**

```bash
curl -s -b /tmp/pacta_cookie.txt -X PUT http://127.0.0.1:8080/api/signers \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `{"error":"method not allowed"}` with HTTP 405

**Step 2: Test POST on ID endpoint**

```bash
curl -s -b /tmp/pacta_cookie.txt -X POST http://127.0.0.1:8080/api/signers/1 \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `{"error":"method not allowed"}` with HTTP 405

---

### Task 11: Stop server and commit

**Files:**
- None (cleanup)

**Step 1: Stop the application**

Run: `pkill -f "^./pacta$"` or `kill %1` (if running in background)
Expected: Process terminated

**Step 2: Final build check**

Run: `cd /home/mowgli/pacta && go build ./...`
Expected: No errors

**Step 3: Review all changes**

Run: `git diff HEAD`
Expected: Review all added files and modifications

**Step 4: Final commit (if any uncommitted changes)**

Run: `git status`
If uncommitted changes exist:
```bash
git add -A
git commit -m "feat: complete signer CRUD implementation"
```

---

### Checkpoint: Complete

- [ ] `go build ./...` succeeds with zero errors
- [ ] All 10 manual test tasks pass with expected results
- [ ] Error messages are sanitized (no raw SQLite errors exposed)
- [ ] FK validation returns 400 for non-existent companies
- [ ] Soft delete works correctly (deleted signers hidden from list/get)
- [ ] Double delete returns 404
- [ ] Method not allowed returns 405
- [ ] Code follows same patterns as `clients.go` and `suppliers.go`
- [ ] All changes committed with descriptive messages

---

## API Contract Summary

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/signers` | List all active signers | Required |
| POST | `/api/signers` | Create a new signer | Required |
| GET | `/api/signers/{id}` | Get signer by ID | Required |
| PUT | `/api/signers/{id}` | Update a signer | Required |
| DELETE | `/api/signers/{id}` | Soft delete a signer | Required |

### Request/Response Examples

**POST /api/signers**
```json
// Request
{
  "company_id": 1,
  "company_type": "client",
  "first_name": "John",
  "last_name": "Doe",
  "position": "CEO",
  "phone": "+50212345678",
  "email": "john@example.com"
}

// Response (201)
{"id": 1, "status": "created"}

// Response (400 - invalid company_type)
{"error": "company_type must be 'client' or 'supplier'"}

// Response (400 - company not found)
{"error": "client not found"}
```

**GET /api/signers**
```json
// Response (200)
[
  {
    "id": 1,
    "company_id": 1,
    "company_type": "client",
    "first_name": "John",
    "last_name": "Doe",
    "position": "CEO",
    "phone": "+50212345678",
    "email": "john@example.com",
    "created_at": "2026-04-11T10:00:00Z",
    "updated_at": "2026-04-11T10:00:00Z"
  }
]
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema field mismatch | High | Struct fields verified against `004_authorized_signers.sql` before coding |
| FK validation gap | Medium | Pre-INSERT/UPDATE checks for both client and supplier tables |
| Route conflict with existing paths | Low | `/api/signers` is unique, no overlap with existing routes |
| Update with partial company_type change | Medium | Update handler validates company_type and checks company existence |
| Empty string fields in UPDATE | Low | Empty strings stored as-is; SQL allows NULL for optional fields but handler uses empty string — acceptable for this iteration |

---

## Files Summary

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `internal/models/models.go` | Modify | +12 | Add `Signer` struct |
| `internal/handlers/signers.go` | Create | ~180 | Signer CRUD handlers |
| `internal/server/server.go` | Modify | +5 | Register signer routes |

**Total new code:** ~200 lines
**Total files touched:** 3

---

## Post-Implementation: Update PROJECT_SUMMARY.md

After successful implementation, update `docs/PROJECT_SUMMARY.md`:

1. In "Current Status" table, change "Signer Tracking" from "Complete" to "Complete (API endpoints added)"
2. In "Progress Tracking → Completed (v0.7.0)" section, add:
   - [x] Signer CRUD endpoints (`GET/POST/PUT/DELETE /api/signers`)
   - [x] Foreign key validation on signer create/update
   - [x] Soft delete support for signers
3. In "Pending — Backend" section, remove "Add signer CRUD endpoints"
