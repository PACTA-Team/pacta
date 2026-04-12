# Multi-Company Design — PACTA

## Overview

Add support for single-company and multi-company (parent + subsidiaries) modes to PACTA. This determines the entire application scope: in single-company mode, one company's lawyers manage all contracts; in multi-company mode, each subsidiary has independent lawyers, clients, suppliers, and contracts, with parent-level admins able to switch between company contexts.

## Design Decisions

### Approach: `company_id` Column on Every Table

Every data table gets a `company_id` foreign key. A `user_companies` junction table enables users to belong to multiple companies (e.g., lawyers working across subsidiaries). A company selector in the navbar lets parent admins switch context.

### Why This Approach

- Simplest implementation for our SQLite + Go architecture
- Clean SQL queries (`WHERE company_id = ?`)
- Easy to reason about, minimal handler changes
- Works with current single-binary distribution
- No external dependencies, no multi-file database complexity

### Constraints

- Single-level hierarchy only (parent → subsidiaries, no nested subsidiaries)
- Complete data isolation: all entities scoped to company
- Users can belong to multiple companies via junction table
- Parent admins see all companies; subsidiary users see only theirs
- Backward compatible: existing single-company installations get auto-migrated

---

## Database Schema

### New Table: `companies`

```sql
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
```

### Junction Table: `user_companies`

```sql
CREATE TABLE IF NOT EXISTS user_companies (
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    is_default INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
```

### Schema Changes to Existing Tables

Every data table gets `company_id INTEGER NOT NULL REFERENCES companies(id)`:

| Table | Column Added |
|-------|-------------|
| `users` | `company_id` (primary company) |
| `clients` | `company_id` |
| `suppliers` | `company_id` |
| `authorized_signers` | `company_id` |
| `contracts` | `company_id` |
| `supplements` | `company_id` (denormalized from parent contract for query performance) |
| `documents` | `company_id` (denormalized from parent entity) |
| `notifications` | `company_id` |
| `audit_logs` | `company_id` |

### Migrations

| Migration | Purpose |
|-----------|---------|
| `013_companies.sql` | Create `companies` + `user_companies` tables |
| `014_company_id_users.sql` | Add `company_id` to `users`, `clients`, `suppliers` |
| `015_company_id_core.sql` | Add `company_id` to `authorized_signers`, `contracts`, `supplements` |
| `016_company_id_aux.sql` | Add `company_id` to `documents`, `notifications`, `audit_logs` |
| `017_company_backfill.sql` | Create default company from existing data, link all records |

### Backfill Logic (Migration 017)

For existing installations:
1. Create `companies` row with `company_type = 'single'`, name from existing client/supplier or "Mi Empresa"
2. Update all existing records to set `company_id = 1`
3. Insert `user_companies` rows for all existing users pointing to company 1

---

## Backend API

### New Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/companies` | Viewer+ | List companies (filtered by user membership) |
| `POST` | `/api/companies` | Admin | Create company |
| `GET` | `/api/companies/{id}` | Viewer+ | Get company by ID |
| `PUT` | `/api/companies/{id}` | Admin | Update company |
| `DELETE` | `/api/companies/{id}` | Admin | Soft delete company |
| `GET` | `/api/users/me/companies` | Viewer+ | Get user's company memberships |
| `PATCH` | `/api/users/me/company/{id}` | Viewer+ | Switch active company context |

### Modified Endpoints

All existing data endpoints gain company scoping via `CompanyMiddleware`:

1. **CompanyMiddleware** (runs after AuthMiddleware):
   - Reads user's active company from session
   - Defaults to `is_default = 1` company if not set
   - Auto-selects if user has only one company
   - Sets `r.Context()` with `companyID` key
   - Returns 403 if user accesses company they don't belong to

2. **Handler changes**: every query gets `WHERE company_id = ?`:
   - `GET /api/contracts` → `WHERE company_id = ? AND deleted_at IS NULL`
   - `POST /api/contracts` → INSERT includes `company_id` from context
   - Same pattern for all entities

### Session Changes

```go
type Session struct {
    UserID    int64
    CompanyID int64  // NEW: active company context
    Role      string
    // ...
}
```

Cookie stores `company_id` alongside `user_id`. Switching company updates the session.

### Setup Wizard Changes

`POST /api/setup` request body:

```json
{
  "company_mode": "single",
  "admin": { "name": "...", "email": "...", "password": "..." },
  "company": { "name": "...", "address": "...", "tax_id": "..." },
  "client": { "name": "...", "address": "...", "reu_code": "...", "contacts": "..." },
  "supplier": { "name": "...", "address": "...", "reu_code": "...", "contacts": "..." },
  "subsidiaries": [
    {
      "name": "...",
      "address": "...",
      "client": { "name": "..." },
      "supplier": { "name": "..." }
    }
  ]
}
```

- `company_mode = "single"`: creates one company, all data scoped to it
- `company_mode = "multi"`: creates parent company + optional subsidiaries
- `subsidiaries` array is optional (can add later via Settings)

### Company Middleware Flow

```
Request → AuthMiddleware → CompanyMiddleware → RoleMiddleware → Handler
                                              ↓
                                    ctx.Value("companyID")
                                              ↓
                                    WHERE company_id = ?
```

Parent admins: company selector sends `X-Company-ID` header. Middleware validates membership via `user_companies`, sets context.

---

## Frontend

### New Pages

**Companies Page** (`/companies`)
- List all companies (parent admins see all, subsidiary users see only theirs)
- Add/Edit/Delete company (admin only)
- Company type badge: "Matriz" or "Subsidiaria"
- Subsidiaries show parent company name
- Soft delete with confirmation

**Company Settings** (`/settings/company`)
- Edit current company details
- Manage subsidiaries (add, edit, remove)
- View company hierarchy tree

### Modified Pages

**Setup Wizard** (`/setup`) — redesigned:

```
Step 1: Mode Selection
┌─────────────────────────────────────┐
│  ¿Cómo usará PACTA?                 │
│                                     │
│  [●] Empresa Individual             │
│      Una sola empresa, todos los    │
│      abogados gestionan contratos   │
│                                     │
│  [ ] Multiempresa                   │
│      Empresa matriz + subsidiarias  │
│      con abogados independientes    │
│                                     │
│         [Siguiente →]               │
└─────────────────────────────────────┘

Step 2a (Single): Admin + Company + Client + Supplier
Step 2b (Multi): Admin + Parent Company → Optional subsidiaries
```

**Top Navbar / Sidebar** — Company Selector:
- Dropdown showing current company name
- Only visible for users with multi-company membership
- Switching company triggers API call, reloads data
- Parent admins see all companies; subsidiary users see only theirs

**All CRUD Pages** — no visible changes for single-company mode. Multi-company: all data scoped to active company. Company badge shown in list views for parent admins.

### New Components

| Component | Purpose |
|-----------|---------|
| `CompanySelector` | Dropdown in navbar for switching company context |
| `CompanyBadge` | Visual indicator showing company type |
| `CompanyForm` | Create/edit company details |
| `CompanyHierarchy` | Tree view of parent → subsidiaries |
| `SetupModeSelector` | Radio cards for single vs multi-company in wizard |
| `SubsidiaryStep` | Wizard step for adding subsidiaries |

### State Management

`CompanyContext` React context provider:
- `currentCompany`: Company object
- `userCompanies`: Array of user's company memberships
- `switchCompany(id)`: API call + context update + data refetch
- `isMultiCompany`: boolean flag for conditional UI rendering

All API client modules gain `company_id` parameter (auto-injected from context or session cookie).

### TypeScript Types

```typescript
interface Company {
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

interface UserCompany {
  user_id: number;
  company_id: number;
  company_name: string;
  is_default: boolean;
}
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| User accesses company they don't belong to | 403 Forbidden |
| Create entity with invalid company_id | 400 Bad Request |
| Delete company with active contracts | 409 Conflict (must delete/move contracts first) |
| Setup already completed | 403 Forbidden |
| Company name duplicate within same parent | 409 Conflict |

## Security

- Company scoping enforced at middleware level, not just UI
- All SQL queries parameterized with `company_id` from trusted session context
- No client-side `company_id` injection — server derives from session
- Audit logs capture company context for every operation
- Soft delete on companies prevents accidental data loss

## Testing

- Unit tests: company middleware, company-scoped queries, setup wizard with subsidiaries
- Integration tests: CRUD operations scoped to company, cross-company isolation verification
- E2E tests: setup wizard flow (single + multi), company switching, parent admin view

## Migration Risk

- **Low risk**: migrations are additive (new columns, new tables)
- **Backfill is safe**: creates one company, links all existing data
- **Rollback plan**: if migration fails, existing data untouched (ALTER TABLE is safe in SQLite)
- **Testing**: run migration on copy of production database before release
