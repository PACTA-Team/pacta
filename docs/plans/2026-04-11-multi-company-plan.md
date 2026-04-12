# Multi-Company Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add single/multi-company (parent + subsidiaries) support to PACTA, with complete data isolation per company and a company selector for parent-level admins.

**Architecture:** Add `companies` table + `user_companies` junction table. Add `company_id` column to every data table. Implement `CompanyMiddleware` that reads user's active company from session and injects it into request context. All existing handlers query with `WHERE company_id = ?`. Redesign setup wizard with mode selection.

**Tech Stack:** Go 1.25, SQLite (`modernc.org/sqlite`), chi router, React 19 + TypeScript, shadcn/ui

---

## Phase 1: Database Migrations

### Task 1: Migration 013 — Companies + User Companies Tables

**Files:**
- Create: `internal/db/013_companies.sql`
- Modify: `internal/models/models.go` (add Company, UserCompany structs)

**Step 1: Create migration file**

```sql
-- internal/db/013_companies.sql

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    tax_id TEXT,
    company_type TEXT NOT NULL DEFAULT 'single'
        CHECK (company_type IN ('single', 'parent', 'subsidiary')),
    parent_id INTEGER REFERENCES companies(id),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(company_type);
CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_id);

CREATE TABLE IF NOT EXISTS user_companies (
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    is_default INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
```

**Step 2: Add Go structs to models.go**

Append to `internal/models/models.go`:

```go
type Company struct {
	ID           int        `json:"id"`
	Name         string     `json:"name"`
	Address      *string    `json:"address,omitempty"`
	TaxID        *string    `json:"tax_id,omitempty"`
	CompanyType  string     `json:"company_type"`
	ParentID     *int       `json:"parent_id,omitempty"`
	ParentName   *string    `json:"parent_name,omitempty"`
	CreatedBy    *int       `json:"created_by,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type UserCompany struct {
	UserID      int    `json:"user_id"`
	CompanyID   int    `json:"company_id"`
	CompanyName string `json:"company_name"`
	IsDefault   bool   `json:"is_default"`
}
```

**Step 3: Verify migration loads**

Run: `go build ./...`
Expected: No errors (migration is embedded via `//go:embed`)

**Step 4: Commit**

```bash
git add internal/db/013_companies.sql internal/models/models.go
git commit -m "feat: add companies and user_companies tables (migration 013)"
```

---

### Task 2: Migration 014 — Company ID on Users, Clients, Suppliers

**Files:**
- Create: `internal/db/014_company_id_users.sql`

**Step 1: Create migration file**

```sql
-- internal/db/014_company_id_users.sql

-- Add company_id to users (nullable initially, backfilled later)
ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id);

-- Add company_id to clients
ALTER TABLE clients ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

-- Add company_id to suppliers
ALTER TABLE suppliers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
```

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/db/014_company_id_users.sql
git commit -m "feat: add company_id to users, clients, suppliers (migration 014)"
```

---

### Task 3: Migration 015 — Company ID on Core Entities

**Files:**
- Create: `internal/db/015_company_id_core.sql`

**Step 1: Create migration file**

```sql
-- internal/db/015_company_id_core.sql

-- Add company_id to authorized_signers
ALTER TABLE authorized_signers ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_signers_company ON authorized_signers(company_id);

-- Add company_id to contracts
ALTER TABLE contracts ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);

-- Add company_id to supplements (denormalized for query performance)
ALTER TABLE supplements ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements(company_id);
```

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/db/015_company_id_core.sql
git commit -m "feat: add company_id to signers, contracts, supplements (migration 015)"
```

---

### Task 4: Migration 016 — Company ID on Auxiliary Entities

**Files:**
- Create: `internal/db/016_company_id_aux.sql`

**Step 1: Create migration file**

```sql
-- internal/db/016_company_id_aux.sql

-- Add company_id to documents
ALTER TABLE documents ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);

-- Add company_id to notifications
ALTER TABLE notifications ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);

-- Add company_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
```

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/db/016_company_id_aux.sql
git commit -m "feat: add company_id to documents, notifications, audit_logs (migration 016)"
```

---

### Task 5: Migration 017 — Backfill Existing Data

**Files:**
- Create: `internal/db/017_company_backfill.sql`

**Step 1: Create migration file**

```sql
-- internal/db/017_company_backfill.sql

-- Create default company from existing data
-- Use the first client name as company name, or 'Mi Empresa' if none exists
INSERT INTO companies (name, company_type, created_at, updated_at)
SELECT
    COALESCE(
        (SELECT name FROM clients WHERE deleted_at IS NULL LIMIT 1),
        'Mi Empresa'
    ),
    'single',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM companies);

-- Link all users to default company
UPDATE users SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all clients to default company
UPDATE clients SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all suppliers to default company
UPDATE suppliers SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all signers to default company
UPDATE authorized_signers SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all contracts to default company
UPDATE contracts SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all supplements to default company
UPDATE supplements SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all documents to default company
UPDATE documents SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all notifications to default company
UPDATE notifications SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Link all audit logs to default company
UPDATE audit_logs SET company_id = 1 WHERE company_id IS NULL AND deleted_at IS NULL;

-- Create user_companies entries for all existing users
INSERT OR IGNORE INTO user_companies (user_id, company_id, is_default)
SELECT id, 1, 1 FROM users WHERE deleted_at IS NULL;

-- Make company_id NOT NULL after backfill (SQLite doesn't support ALTER COLUMN)
-- This is handled by application-level validation; column remains nullable in schema
-- but all existing rows are populated and new inserts always include company_id
```

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/db/017_company_backfill.sql
git commit -m "feat: backfill company_id for existing data (migration 017)"
```

---

## Phase 2: Backend — Models, Session, Middleware

### Task 6: Update Session Struct with CompanyID

**Files:**
- Modify: `internal/auth/session.go`
- Modify: `internal/handlers/auth.go`

**Step 1: Update Session struct in session.go**

In `internal/auth/session.go`, change:

```go
type Session struct {
	Token     string
	UserID    int
	CompanyID int       // NEW: active company context
	ExpiresAt time.Time
}
```

**Step 2: Update CreateSession to accept companyID**

```go
func CreateSession(db *sql.DB, userID int, companyID int) (*Session, error) {
	token, err := generateToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = db.Exec(
		"INSERT INTO sessions (token, user_id, company_id, expires_at) VALUES (?, ?, ?, ?)",
		token, userID, companyID, expiresAt,
	)
	if err != nil {
		return nil, err
	}
	return &Session{Token: token, UserID: userID, CompanyID: companyID, ExpiresAt: expiresAt}, nil
}
```

**Step 3: Update GetSession to read company_id**

```go
func GetSession(db *sql.DB, token string) (*Session, error) {
	var s Session
	err := db.QueryRow(
		"SELECT token, user_id, company_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?",
		token, time.Now(),
	).Scan(&s.Token, &s.UserID, &s.CompanyID, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}
```

**Step 4: Update sessions table migration**

Modify `internal/db/010_sessions.sql` — but since it's already applied, create a new migration instead:

Create `internal/db/018_sessions_company_id.sql`:

```sql
-- Add company_id to sessions for company context persistence
ALTER TABLE sessions ADD COLUMN company_id INTEGER NOT NULL DEFAULT 0 REFERENCES companies(id);
```

**Step 5: Update HandleLogin to resolve default company**

In `internal/handlers/auth.go`, modify `HandleLogin`:

```go
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := auth.Authenticate(h.DB, req.Email, req.Password)
	if err != nil {
		h.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	// Reject inactive/locked users
	if user.Status != "active" {
		h.Error(w, http.StatusForbidden, "account is "+user.Status)
		return
	}

	// Resolve user's default company
	var companyID int
	err = h.DB.QueryRow(`
		SELECT company_id FROM user_companies
		WHERE user_id = ? AND is_default = 1
	`, user.ID).Scan(&companyID)
	if err == sql.ErrNoRows {
		// Fallback: use company_id from users table
		err = h.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", user.ID).Scan(&companyID)
	}
	if err != nil {
		h.Error(w, http.StatusForbidden, "no company assigned. Contact administrator.")
		return
	}

	session, err := auth.CreateSession(h.DB, user.ID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	h.JSON(w, http.StatusOK, sanitizeUser(user))
}
```

**Step 6: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 7: Commit**

```bash
git add internal/auth/session.go internal/handlers/auth.go internal/db/018_sessions_company_id.sql
git commit -m "feat: add company_id to sessions, update login flow"
```

---

### Task 7: CompanyMiddleware

**Files:**
- Create: `internal/handlers/company_middleware.go`
- Modify: `internal/handlers/handler.go` (add ctxKey)

**Step 1: Create company middleware file**

```go
// internal/handlers/company_middleware.go
package handlers

import (
	"context"
	"net/http"
	"strconv"
)

type ctxKey string

const ctxCompanyID ctxKey = "companyID"

// CompanyMiddleware resolves the active company from session or X-Company-ID header.
// It validates the user belongs to the requested company and injects companyID into context.
func (h *Handler) CompanyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := h.getUserID(r)
		if userID == 0 {
			h.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		companyID := 0

		// Check if user explicitly requested a company via header
		if headerID := r.Header.Get("X-Company-ID"); headerID != "" {
			id, err := strconv.Atoi(headerID)
			if err != nil {
				h.Error(w, http.StatusBadRequest, "invalid company ID")
				return
			}

			// Verify user belongs to this company
			var exists int
			err = h.DB.QueryRow(
				"SELECT COUNT(*) FROM user_companies WHERE user_id = ? AND company_id = ?",
				userID, id,
			).Scan(&exists)
			if err != nil || exists == 0 {
				h.Error(w, http.StatusForbidden, "access denied to this company")
				return
			}
			companyID = id
		}

		// If no explicit company, use session's company_id
		if companyID == 0 {
			// Get company_id from session (stored in sessions table)
			cookie, err := r.Cookie("session")
			if err == nil {
				session, err := auth.GetSession(h.DB, cookie.Value)
				if err == nil && session.CompanyID > 0 {
					companyID = session.CompanyID
				}
			}
		}

		// Fallback: get user's default company
		if companyID == 0 {
			err := h.DB.QueryRow(
				"SELECT company_id FROM user_companies WHERE user_id = ? AND is_default = 1",
				userID,
			).Scan(&companyID)
			if err != nil {
				// Last resort: from users table
				err = h.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", userID).Scan(&companyID)
			}
			if err != nil || companyID == 0 {
				h.Error(w, http.StatusForbidden, "no company assigned. Contact administrator.")
				return
			}
		}

		ctx := context.WithValue(r.Context(), ctxCompanyID, companyID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetCompanyID extracts company_id from request context.
func (h *Handler) GetCompanyID(r *http.Request) int {
	v := r.Context().Value(ctxCompanyID)
	if v == nil {
		return 0
	}
	return v.(int)
}
```

**Step 2: Add import for auth package**

Add `"github.com/PACTA-Team/pacta/internal/auth"` to imports.

**Step 3: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add internal/handlers/company_middleware.go
git commit -m "feat: add CompanyMiddleware for company context resolution"
```

---

### Task 8: Wire CompanyMiddleware into Server Routes

**Files:**
- Modify: `internal/server/server.go`

**Step 1: Add CompanyMiddleware to authenticated route group**

In `internal/server/server.go`, inside the `r.Group(func(r chi.Router) { ... })` block, add CompanyMiddleware right after AuthMiddleware:

```go
// Authenticated API routes
r.Group(func(r chi.Router) {
	r.Use(h.AuthMiddleware)
	r.Use(h.CompanyMiddleware)  // NEW

	// ... rest of routes unchanged
```

**Step 2: Add company routes to server.go**

Inside the Viewer+ group, add:
```go
r.Get("/api/companies", h.HandleCompanies)
r.Get("/api/companies/{id}", h.HandleCompanyByID)
```

Inside the Editor+ group, add:
```go
r.Post("/api/companies", h.HandleCompanies)
r.Put("/api/companies/{id}", h.HandleCompanyByID)
```

Inside the Manager+ group, add:
```go
r.Delete("/api/companies/{id}", h.HandleCompanyByID)
```

Add user company membership routes (Viewer+):
```go
r.Get("/api/users/me/companies", h.HandleUserCompanies)
r.Patch("/api/users/me/company/{id}", h.HandleSwitchCompany)
```

**Step 3: Verify build**

Run: `go build ./...`
Expected: Compilation errors (handlers don't exist yet — expected)

**Step 4: Commit**

```bash
git add internal/server/server.go
git commit -m "feat: wire CompanyMiddleware, add company route stubs"
```

---

## Phase 3: Backend — Company CRUD Handlers

### Task 9: Company List + Get by ID Handlers

**Files:**
- Create: `internal/handlers/companies.go`

**Step 1: Create companies handler file**

```go
// internal/handlers/companies.go
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/PACTA-Team/pacta/internal/models"
)

func (h *Handler) HandleCompanies(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.handleListCompanies(w, r)
	case http.MethodPost:
		h.handleCreateCompany(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) handleListCompanies(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	// Check if user is admin of a parent company (can see all subsidiaries)
	var companyType string
	h.DB.QueryRow("SELECT company_type FROM companies WHERE id = ?", companyID).Scan(&companyType)

	var rows *sql.Rows
	var err error

	if companyType == "parent" {
		// Parent admin sees all subsidiaries + parent
		rows, err = h.DB.Query(`
			SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
			       p.name as parent_name, c.created_by, c.created_at, c.updated_at
			FROM companies c
			LEFT JOIN companies p ON c.parent_id = p.id
			WHERE c.deleted_at IS NULL
			ORDER BY c.company_type DESC, c.name
		`)
	} else {
		// Regular user sees only their companies
		rows, err = h.DB.Query(`
			SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
			       p.name as parent_name, c.created_by, c.created_at, c.updated_at
			FROM companies c
			JOIN user_companies uc ON uc.company_id = c.id
			LEFT JOIN companies p ON c.parent_id = p.id
			WHERE uc.user_id = ? AND c.deleted_at IS NULL
			ORDER BY c.company_type DESC, c.name
		`, userID)
	}

	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list companies")
		return
	}
	defer rows.Close()

	var companies []models.Company
	for rows.Next() {
		var c models.Company
		err := rows.Scan(&c.ID, &c.Name, &c.Address, &c.TaxID, &c.CompanyType,
			&c.ParentID, &c.ParentName, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			continue
		}
		companies = append(companies, c)
	}

	if companies == nil {
		companies = []models.Company{}
	}
	h.JSON(w, http.StatusOK, companies)
}

func (h *Handler) handleCreateCompany(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Address     *string `json:"address,omitempty"`
		TaxID       *string `json:"tax_id,omitempty"`
		CompanyType string  `json:"company_type"`
		ParentID    *int    `json:"parent_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		h.Error(w, http.StatusBadRequest, "company name is required")
		return
	}
	if req.CompanyType != "parent" && req.CompanyType != "subsidiary" && req.CompanyType != "single" {
		h.Error(w, http.StatusBadRequest, "invalid company type")
		return
	}

	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	// If creating a subsidiary, validate parent exists and user has access
	if req.CompanyType == "subsidiary" && req.ParentID != nil {
		var parentType string
		err := h.DB.QueryRow("SELECT company_type FROM companies WHERE id = ? AND deleted_at IS NULL", *req.ParentID).Scan(&parentType)
		if err != nil {
			h.Error(w, http.StatusBadRequest, "parent company not found")
			return
		}
	}

	result, err := h.DB.Exec(
		"INSERT INTO companies (name, address, tax_id, company_type, parent_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
		req.Name, req.Address, req.TaxID, req.CompanyType, req.ParentID, userID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create company")
		return
	}

	id, _ := result.LastInsertId()

	// Link creator to new company
	h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 0)", userID, id)

	h.JSON(w, http.StatusCreated, map[string]interface{}{"id": id, "name": req.Name})
}
```

**Step 2: Add sql import**

Add `"database/sql"` to imports.

**Step 3: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add internal/handlers/companies.go
git commit -m "feat: add company list and create handlers"
```

---

### Task 10: Company Update + Delete Handlers

**Files:**
- Modify: `internal/handlers/companies.go`

**Step 1: Add HandleCompanyByID**

Append to `internal/handlers/companies.go`:

```go
func (h *Handler) HandleCompanyByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid company ID")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.handleGetCompany(w, r, id)
	case http.MethodPut:
		h.handleUpdateCompany(w, r, id)
	case http.MethodDelete:
		h.handleDeleteCompany(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) handleGetCompany(w http.ResponseWriter, r *http.Request, id int) {
	var c models.Company
	err := h.DB.QueryRow(`
		SELECT c.id, c.name, c.address, c.tax_id, c.company_type, c.parent_id,
		       p.name as parent_name, c.created_by, c.created_at, c.updated_at
		FROM companies c
		LEFT JOIN companies p ON c.parent_id = p.id
		WHERE c.id = ? AND c.deleted_at IS NULL
	`, id).Scan(&c.ID, &c.Name, &c.Address, &c.TaxID, &c.CompanyType,
		&c.ParentID, &c.ParentName, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		h.Error(w, http.StatusNotFound, "company not found")
		return
	}
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to get company")
		return
	}
	h.JSON(w, http.StatusOK, c)
}

func (h *Handler) handleUpdateCompany(w http.ResponseWriter, r *http.Request, id int) {
	var req struct {
		Name    *string `json:"name"`
		Address *string `json:"address"`
		TaxID   *string `json:"tax_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	_, err := h.DB.Exec(
		"UPDATE companies SET name = COALESCE(?, name), address = COALESCE(?, address), tax_id = COALESCE(?, tax_id), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
		req.Name, req.Address, req.TaxID, id,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) handleDeleteCompany(w http.ResponseWriter, r *http.Request, id int) {
	// Check if company has active contracts
	var count int
	h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE company_id = ? AND deleted_at IS NULL", id).Scan(&count)
	if count > 0 {
		h.Error(w, http.StatusConflict, "cannot delete company with active contracts")
		return
	}

	_, err := h.DB.Exec("UPDATE companies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete company")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Step 2: Add chi import**

Add `"github.com/go-chi/chi/v5"` to imports.

**Step 3: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add internal/handlers/companies.go
git commit -m "feat: add company get, update, delete handlers"
```

---

### Task 11: User Company Membership + Switch Company Handlers

**Files:**
- Modify: `internal/handlers/users.go` (append to end)

**Step 1: Add user company endpoints**

Append to `internal/handlers/users.go`:

```go
func (h *Handler) HandleUserCompanies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	rows, err := h.DB.Query(`
		SELECT uc.user_id, uc.company_id, c.name, uc.is_default
		FROM user_companies uc
		JOIN companies c ON c.id = uc.company_id
		WHERE uc.user_id = ? AND c.deleted_at IS NULL
		ORDER BY uc.is_default DESC, c.name
	`, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list user companies")
		return
	}
	defer rows.Close()

	var companies []models.UserCompany
	for rows.Next() {
		var uc models.UserCompany
		rows.Scan(&uc.UserID, &uc.CompanyID, &uc.CompanyName, &uc.IsDefault)
		companies = append(companies, uc)
	}
	if companies == nil {
		companies = []models.UserCompany{}
	}

	h.JSON(w, http.StatusOK, companies)
}

func (h *Handler) HandleSwitchCompany(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	idStr := chi.URLParam(r, "id")
	companyID, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid company ID")
		return
	}

	// Verify user belongs to this company
	var exists int
	h.DB.QueryRow("SELECT COUNT(*) FROM user_companies WHERE user_id = ? AND company_id = ?", userID, companyID).Scan(&exists)
	if exists == 0 {
		h.Error(w, http.StatusForbidden, "access denied to this company")
		return
	}

	// Update session's company_id
	cookie, err := r.Cookie("session")
	if err == nil {
		h.DB.Exec("UPDATE sessions SET company_id = ? WHERE token = ?", companyID, cookie.Value)
	}

	// Update user's default company
	h.DB.Exec("UPDATE user_companies SET is_default = 0 WHERE user_id = ?", userID)
	h.DB.Exec("UPDATE user_companies SET is_default = 1 WHERE user_id = ? AND company_id = ?", userID, companyID)

	h.JSON(w, http.StatusOK, map[string]interface{}{"company_id": companyID})
}
```

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/users.go
git commit -m "feat: add user company membership and switch company handlers"
```

---

## Phase 4: Backend — Update Existing Handlers with Company Scoping

### Task 12: Update Contracts Handler with Company Scoping

**Files:**
- Modify: `internal/handlers/contracts.go`

**Step 1: Add company_id to all queries**

In every SQL query in `contracts.go`, add `company_id = ?` to WHERE clauses and include `companyID` in INSERT statements.

For `HandleContracts` GET:
```go
companyID := h.GetCompanyID(r)
rows, err := h.DB.Query(`
    SELECT ... FROM contracts WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
`, companyID)
```

For `HandleContracts` POST:
```go
companyID := h.GetCompanyID(r)
result, err := h.DB.Exec(`
    INSERT INTO contracts (..., company_id) VALUES (..., ?)
`, ..., companyID)
```

For `HandleContractByID` GET/PUT/DELETE:
```go
companyID := h.GetCompanyID(r)
// Add AND company_id = ? to all WHERE clauses
```

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/contracts.go
git commit -m "feat: add company scoping to contract handlers"
```

---

### Task 13: Update Clients Handler with Company Scoping

**Files:**
- Modify: `internal/handlers/clients.go`

**Step 1: Add company_id to all queries**

Same pattern as Task 12. Add `company_id = ?` to WHERE clauses and INSERT statements.

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/clients.go
git commit -m "feat: add company scoping to client handlers"
```

---

### Task 14: Update Suppliers Handler with Company Scoping

**Files:**
- Modify: `internal/handlers/suppliers.go`

**Step 1: Add company_id to all queries**

Same pattern.

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/suppliers.go
git commit -m "feat: add company scoping to supplier handlers"
```

---

### Task 15: Update Signers Handler with Company Scoping

**Files:**
- Modify: `internal/handlers/signers.go`

**Step 1: Add company_id to all queries**

Same pattern.

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/signers.go
git commit -m "feat: add company scoping to signer handlers"
```

---

### Task 16: Update Supplements Handler with Company Scoping

**Files:**
- Modify: `internal/handlers/supplements.go`

**Step 1: Add company_id to all queries**

Same pattern. Also update the internal ID generation query to filter by company.

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/supplements.go
git commit -m "feat: add company scoping to supplement handlers"
```

---

### Task 17: Update Documents, Notifications, Audit Logs with Company Scoping

**Files:**
- Modify: `internal/handlers/documents.go`
- Modify: `internal/handlers/notifications.go`
- Modify: `internal/handlers/audit_logs.go`

**Step 1: Add company_id to all queries in each file**

Same pattern for all three files.

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/documents.go internal/handlers/notifications.go internal/handlers/audit_logs.go
git commit -m "feat: add company scoping to documents, notifications, audit handlers"
```

---

## Phase 5: Backend — Setup Wizard Redesign

### Task 18: Redesign Setup Handler for Multi-Company

**Files:**
- Modify: `internal/handlers/setup.go`

**Step 1: Update SetupRequest struct**

```go
type SetupRequest struct {
	CompanyMode  string         `json:"company_mode"` // "single" or "multi"
	Admin        SetupAdmin     `json:"admin"`
	Company      SetupCompany   `json:"company"`
	Client       SetupParty     `json:"client"`
	Supplier     SetupParty     `json:"supplier"`
	Subsidiaries []SetupSubsidiary `json:"subsidiaries,omitempty"`
}

type SetupCompany struct {
	Name    string  `json:"name"`
	Address *string `json:"address,omitempty"`
	TaxID   *string `json:"tax_id,omitempty"`
}

type SetupSubsidiary struct {
	Name     string     `json:"name"`
	Address  *string    `json:"address,omitempty"`
	TaxID    *string    `json:"tax_id,omitempty"`
	Client   SetupParty `json:"client"`
	Supplier SetupParty `json:"supplier"`
}
```

**Step 2: Update HandleSetup function**

Rewrite `HandleSetup` to:
1. Validate `company_mode` is "single" or "multi"
2. Create parent company (or single company)
3. Create admin user linked to company
4. Create default client/supplier linked to company
5. Create `user_companies` entry
6. If multi + subsidiaries: loop and create each subsidiary with its own client/supplier
7. All in one transaction

```go
func (h *Handler) HandleSetup(w http.ResponseWriter, r *http.Request) {
	var count int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&count)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check setup status")
		return
	}
	if count > 0 {
		h.Error(w, http.StatusForbidden, "setup has already been completed")
		return
	}

	var req SetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate
	if req.CompanyMode != "single" && req.CompanyMode != "multi" {
		h.Error(w, http.StatusBadRequest, "company_mode must be 'single' or 'multi'")
		return
	}
	if err := validateSetupAdmin(req.Admin); err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Company.Name) == "" {
		h.Error(w, http.StatusBadRequest, "company name is required")
		return
	}
	if strings.TrimSpace(req.Client.Name) == "" {
		h.Error(w, http.StatusBadRequest, "client name is required")
		return
	}
	if strings.TrimSpace(req.Supplier.Name) == "" {
		h.Error(w, http.StatusBadRequest, "supplier name is required")
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	defer tx.Rollback()

	// Determine company type
	companyType := "single"
	if req.CompanyMode == "multi" {
		companyType = "parent"
	}

	// Create parent/single company
	companyResult, err := tx.Exec(
		"INSERT INTO companies (name, address, tax_id, company_type) VALUES (?, ?, ?, ?)",
		req.Company.Name, req.Company.Address, req.Company.TaxID, companyType,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	companyID, _ := companyResult.LastInsertId()

	// Create admin user
	hash, err := auth.HashPassword(req.Admin.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminResult, err := tx.Exec(
		"INSERT INTO users (name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)",
		req.Admin.Name, req.Admin.Email, hash, companyID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			h.Error(w, http.StatusConflict, "a user with this email already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminID, _ := adminResult.LastInsertId()

	// Link admin to company
	_, err = tx.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", adminID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	// Create default client
	clientResult, err := tx.Exec(
		"INSERT INTO clients (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		req.Client.Name, req.Client.Address, req.Client.REUCode, req.Client.Contacts, adminID, companyID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	_ = clientResult

	// Create default supplier
	supplierResult, err := tx.Exec(
		"INSERT INTO suppliers (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
		req.Supplier.Name, req.Supplier.Address, req.Supplier.REUCode, req.Supplier.Contacts, adminID, companyID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	_ = supplierResult

	// Create subsidiaries if provided
	for _, sub := range req.Subsidiaries {
		if strings.TrimSpace(sub.Name) == "" {
			continue
		}

		subResult, err := tx.Exec(
			"INSERT INTO companies (name, address, tax_id, company_type, parent_id) VALUES (?, ?, ?, 'subsidiary', ?)",
			sub.Name, sub.Address, sub.TaxID, companyID,
		)
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
			return
		}
		subID, _ := subResult.LastInsertId()

		// Create subsidiary's default client
		if strings.TrimSpace(sub.Client.Name) != "" {
			tx.Exec(
				"INSERT INTO clients (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
				sub.Client.Name, sub.Client.Address, sub.Client.REUCode, sub.Client.Contacts, adminID, subID,
			)
		}

		// Create subsidiary's default supplier
		if strings.TrimSpace(sub.Supplier.Name) != "" {
			tx.Exec(
				"INSERT INTO suppliers (name, address, reu_code, contacts, created_by, company_id) VALUES (?, ?, ?, ?, ?, ?)",
				sub.Supplier.Name, sub.Supplier.Address, sub.Supplier.REUCode, sub.Supplier.Contacts, adminID, subID,
			)
		}
	}

	if err := tx.Commit(); err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"status":     "setup_complete",
		"company_id": companyID,
		"admin_id":   adminID,
	})
}
```

**Step 3: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add internal/handlers/setup.go
git commit -m "feat: redesign setup wizard for multi-company support"
```

---

### Task 19: Update Go Models for Company Scoping

**Files:**
- Modify: `internal/models/models.go`

**Step 1: Add CompanyID to all existing structs**

Add `CompanyID int `json:"company_id"`` to:
- `Client`
- `Supplier`
- `Signer`
- `Contract`
- `Supplement`
- `AuditLog`

Add corresponding fields to any other structs used in handlers.

**Step 2: Verify build**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/models/models.go
git commit -m "feat: add CompanyID to all model structs"
```

---

## Phase 6: Backend — Build Verification

### Task 20: Full Build Verification + CI Check

**Files:**
- All modified files

**Step 1: Full build**

Run: `go build ./...`
Expected: No errors

**Step 2: Vet**

Run: `go vet ./...`
Expected: No issues

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "chore: final build verification, all company scoping applied"
```

**Step 4: Push and verify CI**

```bash
git push
```

Monitor GitHub Actions for successful build.

---

## Phase 7: Frontend — TypeScript Types + API Client

### Task 21: Add TypeScript Types + Companies API Client

**Files:**
- Create: `pacta_appweb/src/lib/companies-api.ts`
- Modify: `pacta_appweb/src/types/index.ts` (add Company, UserCompany types)

**Step 1: Add types**

In `pacta_appweb/src/types/index.ts`, add:

```typescript
export interface Company {
  id: number;
  name: string;
  address?: string;
  tax_id?: string;
  company_type: 'single' | 'parent' | 'subsidiary';
  parent_id?: number;
  parent_name?: string;
  created_at: string;
  updated_at: string;
}

export interface UserCompany {
  user_id: number;
  company_id: number;
  company_name: string;
  is_default: boolean;
}
```

**Step 2: Create companies API client**

```typescript
// pacta_appweb/src/lib/companies-api.ts
import type { Company, UserCompany } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listCompanies(): Promise<Company[]> {
  return request<Company[]>('/companies');
}

export async function getCompany(id: number): Promise<Company> {
  return request<Company>(`/companies/${id}`);
}

export async function createCompany(data: {
  name: string;
  address?: string;
  tax_id?: string;
  company_type: string;
  parent_id?: number;
}): Promise<{ id: number; name: string }> {
  return request<{ id: number; name: string }>('/companies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCompany(id: number, data: {
  name?: string;
  address?: string;
  tax_id?: string;
}): Promise<{ status: string }> {
  return request<{ status: string }>(`/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCompany(id: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/companies/${id}`, {
    method: 'DELETE',
  });
}

export async function getUserCompanies(): Promise<UserCompany[]> {
  return request<UserCompany[]>('/users/me/companies');
}

export async function switchCompany(id: number): Promise<{ company_id: number }> {
  return request<{ company_id: number }>(`/users/me/company/${id}`, {
    method: 'PATCH',
  });
}
```

**Step 3: Verify TypeScript compilation**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: No errors (may have pre-existing errors, but no new ones)

**Step 4: Commit**

```bash
git add pacta_appweb/src/lib/companies-api.ts pacta_appweb/src/types/index.ts
git commit -m "feat: add companies API client and TypeScript types"
```

---

### Task 22: CompanyContext React Provider

**Files:**
- Create: `pacta_appweb/src/contexts/CompanyContext.tsx`

**Step 1: Create context provider**

```tsx
// pacta_appweb/src/contexts/CompanyContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Company, UserCompany } from '../types';
import { listCompanies, getUserCompanies, switchCompany } from '../lib/companies-api';

interface CompanyContextType {
  currentCompany: Company | null;
  userCompanies: UserCompany[];
  isMultiCompany: boolean;
  switchCompany: (id: number) => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    try {
      const [companies, userComps] = await Promise.all([
        listCompanies(),
        getUserCompanies(),
      ]);
      setUserCompanies(userComps);
      if (companies.length > 0) {
        // Default to first company or the one marked as default
        const defaultComp = userComps.find(c => c.is_default);
        const targetId = defaultComp ? defaultComp.company_id : companies[0].id;
        const current = companies.find(c => c.id === targetId) || companies[0];
        setCurrentCompany(current);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleSwitch = useCallback(async (id: number) => {
    await switchCompany(id);
    window.location.reload(); // Reload to refresh all data
  }, []);

  const isMultiCompany = userCompanies.length > 1;

  return (
    <CompanyContext.Provider value={{
      currentCompany,
      userCompanies,
      isMultiCompany,
      switchCompany: handleSwitch,
      loading,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
```

**Step 2: Wire into App.tsx**

In `pacta_appweb/src/App.tsx`, wrap the app with `CompanyProvider` (inside `AuthProvider`):

```tsx
import { CompanyProvider } from './contexts/CompanyContext';

// Inside the AuthProvider wrap:
<CompanyProvider>
  {/* existing routes */}
</CompanyProvider>
```

**Step 3: Verify TypeScript compilation**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add pacta_appweb/src/contexts/CompanyContext.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add CompanyContext provider"
```

---

## Phase 8: Frontend — Setup Wizard Redesign

### Task 23: Setup Mode Selector Component

**Files:**
- Create: `pacta_appweb/src/components/SetupModeSelector.tsx`
- Modify: `pacta_appweb/src/pages/SetupPage.tsx`

**Step 1: Create mode selector component**

```tsx
// pacta_appweb/src/components/SetupModeSelector.tsx
import React from 'react';

interface Props {
  mode: 'single' | 'multi';
  onChange: (mode: 'single' | 'multi') => void;
}

export default function SetupModeSelector({ mode, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">¿Cómo usará PACTA?</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange('single')}
          className={`p-6 rounded-lg border-2 text-left transition ${
            mode === 'single'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          aria-pressed={mode === 'single'}
        >
          <div className="font-semibold mb-2">Empresa Individual</div>
          <p className="text-sm text-muted-foreground">
            Una sola empresa, todos los abogados gestionan contratos y suplementos.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange('multi')}
          className={`p-6 rounded-lg border-2 text-left transition ${
            mode === 'multi'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          aria-pressed={mode === 'multi'}
        >
          <div className="font-semibold mb-2">Multiempresa</div>
          <p className="text-sm text-muted-foreground">
            Empresa matriz + subsidiarias con abogados independientes y contratos separados.
          </p>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Redesign SetupPage**

Rewrite `SetupPage.tsx` to include mode selection as step 1, then flow into existing admin/company/client/supplier steps.

Add `company_mode` to the setup payload sent to `POST /api/setup`.

**Step 3: Verify TypeScript compilation**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/SetupModeSelector.tsx pacta_appweb/src/pages/SetupPage.tsx
git commit -m "feat: redesign setup wizard with company mode selection"
```

---

## Phase 9: Frontend — Company UI Components

### Task 24: CompanySelector Component (Navbar)

**Files:**
- Create: `pacta_appweb/src/components/CompanySelector.tsx`
- Modify: `pacta_appweb/src/components/AppSidebar.tsx` or navbar component

**Step 1: Create CompanySelector**

```tsx
// pacta_appweb/src/components/CompanySelector.tsx
import React from 'react';
import { useCompany } from '../contexts/CompanyContext';
import type { UserCompany } from '../types';

export default function CompanySelector() {
  const { userCompanies, currentCompany, switchCompany, isMultiCompany } = useCompany();

  if (!isMultiCompany || !currentCompany) return null;

  return (
    <div className="px-3 py-2">
      <label htmlFor="company-select" className="sr-only">
        Select company
      </label>
      <select
        id="company-select"
        value={currentCompany.id}
        onChange={(e) => switchCompany(Number(e.target.value))}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        aria-label="Current company"
      >
        {userCompanies.map((uc) => (
          <option key={uc.company_id} value={uc.company_id}>
            {uc.company_name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Add to sidebar/navbar**

Insert `<CompanySelector />` into `AppSidebar.tsx` below the user info section.

**Step 3: Verify TypeScript compilation**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/CompanySelector.tsx pacta_appweb/src/components/AppSidebar.tsx
git commit -m "feat: add CompanySelector to sidebar"
```

---

### Task 25: Companies Page

**Files:**
- Create: `pacta_appweb/src/pages/CompaniesPage.tsx`
- Modify: `pacta_appweb/src/App.tsx` (add route)

**Step 1: Create CompaniesPage**

Basic list page with add/edit/delete. Use existing patterns from ClientsPage/SuppliersPage.

**Step 2: Add route**

In `App.tsx`, add:
```tsx
const CompaniesPage = React.lazy(() => import('./pages/CompaniesPage'));
// ...
<Route path="/companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
```

**Step 3: Add navigation link**

Add "Companies" link to sidebar for admin users only.

**Step 4: Verify build**

Run: `cd pacta_appweb && npm run build`
Expected: Successful build

**Step 5: Commit**

```bash
git add pacta_appweb/src/pages/CompaniesPage.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add Companies page"
```

---

## Phase 10: Frontend Build + Full Verification

### Task 26: Frontend Build Verification

**Files:**
- All modified frontend files

**Step 1: TypeScript check**

Run: `cd pacta_appweb && npx tsc --noEmit`
Expected: No new errors beyond pre-existing ones

**Step 2: Full build**

Run: `cd pacta_appweb && npm run build`
Expected: Successful build with no errors

**Step 3: Copy to Go embed**

Run: `cp -r pacta_appweb/dist cmd/pacta/dist`

**Step 4: Go build**

Run: `go build ./...`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: frontend build verification"
```

---

## Phase 11: Version Bump + Release

### Task 27: Update CHANGELOG + Version

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `cmd/pacta/main.go` (version constant)

**Step 1: Update CHANGELOG.md**

Add entry for v0.16.0:

```markdown
## [v0.16.0] - 2026-04-11

### Added
- Multi-company support (single company and parent + subsidiaries modes)
- Company scoping middleware for all API endpoints
- Company selector for parent-level admins
- Redesigned setup wizard with company mode selection
- Companies management page
- User company membership endpoints
- Database migrations 013-018 for company schema
```

**Step 2: Bump version**

In `cmd/pacta/main.go`, update version constant to `0.16.0`.

**Step 3: Commit**

```bash
git add CHANGELOG.md cmd/pacta/main.go
git commit -m "chore: bump version to v0.16.0"
```

---

## Summary of Files to Create/Modify

### New Files (12)
1. `internal/db/013_companies.sql`
2. `internal/db/014_company_id_users.sql`
3. `internal/db/015_company_id_core.sql`
4. `internal/db/016_company_id_aux.sql`
5. `internal/db/017_company_backfill.sql`
6. `internal/db/018_sessions_company_id.sql`
7. `internal/handlers/company_middleware.go`
8. `internal/handlers/companies.go`
9. `pacta_appweb/src/lib/companies-api.ts`
10. `pacta_appweb/src/contexts/CompanyContext.tsx`
11. `pacta_appweb/src/components/SetupModeSelector.tsx`
12. `pacta_appweb/src/components/CompanySelector.tsx`
13. `pacta_appweb/src/pages/CompaniesPage.tsx`

### Modified Files (14)
1. `internal/models/models.go`
2. `internal/auth/session.go`
3. `internal/handlers/auth.go`
4. `internal/handlers/setup.go`
5. `internal/handlers/users.go`
6. `internal/handlers/contracts.go`
7. `internal/handlers/clients.go`
8. `internal/handlers/suppliers.go`
9. `internal/handlers/signers.go`
10. `internal/handlers/supplements.go`
11. `internal/handlers/documents.go`
12. `internal/handlers/notifications.go`
13. `internal/handlers/audit_logs.go`
14. `internal/server/server.go`
15. `pacta_appweb/src/types/index.ts`
16. `pacta_appweb/src/pages/SetupPage.tsx`
17. `pacta_appweb/src/App.tsx`
18. `pacta_appweb/src/components/AppSidebar.tsx`
19. `CHANGELOG.md`
20. `cmd/pacta/main.go`

---

## Testing Strategy

Since no test infrastructure exists yet, testing is manual:

1. **Fresh install test:** Delete `pacta.db`, run app, complete setup in single-company mode, verify all data scoped to company 1
2. **Multi-company test:** Delete `pacta.db`, run app, complete setup in multi-company mode with 2 subsidiaries, verify company isolation
3. **Migration test:** Run app with existing database, verify migration 017 backfills correctly
4. **Company switch test:** As parent admin, switch between companies, verify data changes
5. **Permission test:** As subsidiary user, try to access parent company data via API — should get 403
