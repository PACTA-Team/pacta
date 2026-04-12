# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.20.2] - 2026-04-12

### Fixed
- **Migration ordering** -- Backfill migration (019) was running before `company_id` columns were added to `supplements` (017) and `sessions` (018). Renumbered so all ALTER TABLE migrations complete before backfill.

---

## [0.20.1] - 2026-04-12

### Fixed
- **Redundant migration 015** -- `authorized_signers` table already had `company_id` in CREATE TABLE (migration 004). Removed duplicate ALTER TABLE that caused fresh install failures.

---

## [0.20.0] - 2026-04-12

### Changed
- **Database migrations** -- Migrated from custom runner to goose v3. Adds up/down migration support, dirty state tracking, and CLI tooling for database schema management.

### Technical Details
- **Files Created:** `internal/db/db.go`, `internal/db/migrations/` (19 files with goose Up/Down markers)
- **Files Deleted:** `internal/db/migrate.go`, 19 old migration files from db root
- **Dependencies:** Added `github.com/pressly/goose/v3`

---

## [0.19.0] - 2026-04-12

### Fixed
- **Migration idempotency** -- SQLite `ALTER TABLE ADD COLUMN` fails when column already exists. Migration system now detects `duplicate column name` errors, skips the migration, and marks it as applied. Fixes fresh install failure on release binaries where migrations were partially applied.

---

## [0.18.0] - 2026-04-11

### Added
- **Landing page** -- Modern landing page with Framer Motion animations, animated geometric shapes, and PACTA branding
- **AnimatedLogo component** -- Reusable animated SVG logo with scale-in entrance and continuous floating effect
- **HeroSection** -- Full-screen hero with animated geometric shapes, gradient text, and "Start Now" CTA button
- **FeaturesSection** -- Three feature cards with staggered scroll-triggered animations and hover effects
- **LoginPage branding** -- Animated PACTA logo on login page with spring animation and hover effect

### Changed
- **HomePage** -- Replaced direct login form with full landing page composition (navbar + hero + features)
- **LoginPage** -- Removed duplicate gradient background (LoginForm already provides it)

### Fixed
- **Theme toggle broken since v0.2.0** -- Root cause: `ThemeProvider` from `next-themes` was never mounted in `main.tsx`. Fixed by wrapping `<App />` with `<ThemeProvider defaultTheme="system" storageKey="pacta-theme">`
- **Setup redirect preserved** -- Landing page retains first-run setup check and redirect to `/setup`

### Technical Details
- **Files Created:** 4 (`AnimatedLogo.tsx`, `LandingNavbar.tsx`, `HeroSection.tsx`, `FeaturesSection.tsx`)
- **Files Modified:** 3 (`main.tsx`, `HomePage.tsx`, `LoginPage.tsx`)
- **Dependencies:** Framer Motion (already in package.json)

---

## [0.17.0] - 2026-04-11

### Added
- **Multi-company setup wizard** -- Users can now configure deployment as single-company or multi-company mode during initial setup
- **Company mode selector** -- UI component for choosing between single and multi-company modes
- **Company info step** -- Captures company name, address, and tax ID during setup flow
- **Company data in setup payload** -- Backend now accepts and stores company information from setup wizard

### Changed
- **Setup wizard flow extended** -- Now 7 steps instead of 5 (Welcome → Company Mode → Company Info → Admin → Client → Supplier → Review)
- **Setup API payload** -- Now includes `company_mode` and `company` fields alongside admin, client, and supplier data
- **Review screen** -- Displays company information and mode before final submission

### Technical Details
- **Files Created:** 2 (`SetupModeSelector.tsx`, `StepCompany.tsx`)
- **Files Modified:** 4 (`SetupWizard.tsx`, `StepReview.tsx`, `setup-api.ts`, `setup.go`)
- **Lines Added:** ~310

---

## [0.16.0] - 2026-04-11

### Added
- **Multi-company support** -- Single company and parent + subsidiaries modes with complete data isolation
- **Company scoping middleware** -- `CompanyMiddleware` resolves active company from session/header and injects into request context
- **Company CRUD endpoints** -- Full REST API for company management with parent/subsidiary hierarchy
- **Company selector** -- Dropdown for parent-level admins to switch between companies
- **Companies management page** -- Frontend CRUD page with search, create, edit, delete
- **User company membership** -- Endpoints to list user companies and switch active company
- **Database migrations 013-018** -- Companies table, user_companies junction, company_id on all data tables, backfill
- **CompanyContext React provider** -- Global company state management with auto-default resolution

### Changed
- **All handlers company-scoped** -- contracts, clients, suppliers, signers, supplements, documents, notifications, audit_logs now filter by `company_id`
- **auditLog helper** -- Updated signature to accept `companyID`, all 23 callers updated
- **Model structs** -- `CompanyID` added to Client, Supplier, Contract, Supplement, AuditLog
- **Login flow** -- Resolves user's default company from `user_companies` table
- **Session management** -- `company_id` column added to sessions table for company context persistence

### Technical Details
- **Files Created:** 6 (companies.go, company_middleware.go, companies-api.ts, CompanyContext.tsx, CompanySelector.tsx, CompaniesPage.tsx)
- **Files Modified:** 20 (all handlers, models, session, server, frontend types, App.tsx, AppSidebar)
- **Lines Added:** ~2,900
- **Migrations:** 013-018 (companies schema + company_id backfill)

### Backend Integration
- GET /api/companies -- List companies (parent admins see all subsidiaries)
- POST /api/companies -- Create company
- GET /api/companies/{id} -- Get company by ID
- PUT /api/companies/{id} -- Update company
- DELETE /api/companies/{id} -- Delete company (blocked if active contracts)
- GET /api/users/me/companies -- List current user's companies
- PATCH /api/users/me/company/{id} -- Switch active company

---

## [0.14.0] - 2026-04-11

### Added
- **Users API client** -- `src/lib/users-api.ts` with list, create, update, delete, reset-password, and status methods
- **UsersPage API migration** -- Full migration from localStorage to backend API
- **Password reset UI** -- Dedicated form for admin password reset
- **Delete user button** -- With self-protection (cannot delete own account)

### Changed
- UsersPage now fetches users from `/api/users` instead of localStorage
- User status toggle now calls backend API (supports active/inactive/locked)
- Added loading states for user list
- Email field disabled during edit (cannot change email)

### Technical Details
- **Files Created:** 1 (`pacta_appweb/src/lib/users-api.ts`)
- **Files Modified:** 1 (`pacta_appweb/src/pages/UsersPage.tsx`)
- **Lines Changed:** +397 / -248

---

## [0.13.0] - 2026-04-11

### Added
- **User list endpoint** -- `GET /api/users` returns all non-deleted users (excludes password_hash)
- **User create endpoint** -- `POST /api/users` with bcrypt password hashing and role validation
- **User get by ID** -- `GET /api/users/{id}` (user-scoped)
- **User update endpoint** -- `PUT /api/users/{id}` (name, email, role)
- **User delete endpoint** -- `DELETE /api/users/{id}` (soft delete, cannot delete own account)
- **Password reset endpoint** -- `PATCH /api/users/{id}/reset-password` (admin-only)
- **User status endpoint** -- `PATCH /api/users/{id}/status` (active/inactive/locked)

### Security
- Cannot demote own admin role
- Cannot delete own account
- Cannot change own status to inactive/locked
- Password hashing via bcrypt (cost 10)
- Audit logging on all operations (create, update, delete, reset_password, update_status)
- Duplicate email detection (409 Conflict)

### Technical Details
- **Files Created:** 1 (`internal/handlers/users.go`)
- **Files Modified:** 2 (`internal/server/server.go`, `docs/PROJECT_SUMMARY.md`)
- **Lines Added:** ~316

### Backend Integration
- GET /api/users - List all users
- POST /api/users - Create user (bcrypt hashing, role validation)
- GET /api/users/{id} - Get user by ID
- PUT /api/users/{id} - Update user (name, email, role)
- DELETE /api/users/{id} - Soft delete (cannot delete own)
- PATCH /api/users/{id}/reset-password - Reset password
- PATCH /api/users/{id}/status - Update status (active/inactive/locked)

---

## [0.12.0] - 2026-04-11

### Added
- **Documents API client** -- `src/lib/documents-api.ts` with list, upload (multipart), download, and delete methods
- **Notifications API client** -- `src/lib/notifications-api.ts` with list, count, mark read, mark all read, and delete methods
- **Notification badge in AppSidebar** -- Live unread count polling every 30s from `/api/notifications/count`

### Changed
- **DocumentsPage** -- Migrated from localStorage to backend API; upload form now sends multipart to `/api/documents`
- **NotificationsPage** -- Migrated from localStorage to backend API; removed localStorage settings panel
- **ContractDetailsPage** -- Document repository section now fetches from `/api/documents` and supports download/delete via API
- **DashboardPage** -- Removed `generateNotifications()` (backend now handles notification generation)
- **TypeScript types** -- Updated `Document` and `Notification` interfaces to match backend snake_case format (int IDs, `entity_id`, `created_at`, etc.)

### Removed
- `generateNotifications()` from `lib/notifications.ts` (no longer needed, backend handles this)
- localStorage-based document and notification management from frontend pages

### Technical Details
- **Files Created:** 2 (`pacta_appweb/src/lib/documents-api.ts`, `pacta_appweb/src/lib/notifications-api.ts`)
- **Files Modified:** 6 (`DocumentsPage.tsx`, `NotificationsPage.tsx`, `ContractDetailsPage.tsx`, `DashboardPage.tsx`, `AppSidebar.tsx`, `types/index.ts`)
- **Lines Changed:** +430 / -349

---

## [0.11.0] - 2026-04-11

### Added
- **Notification list endpoint** -- `GET /api/notifications` with `?unread=true` filter, limit 100
- **Notification create endpoint** -- `POST /api/notifications` with optional `user_id` (defaults to authenticated user)
- **Notification mark read endpoint** -- `PATCH /api/notifications/{id}/read`
- **Mark all notifications read** -- `PATCH /api/notifications/mark-all-read`
- **Notification count endpoint** -- `GET /api/notifications/count` (for badge UI)
- **Notification get by ID** -- `GET /api/notifications/{id}` (user-scoped)
- **Notification delete endpoint** -- `DELETE /api/notifications/{id}` (user-scoped)

### Security
- All notification queries scoped to authenticated user; no cross-user access possible

### Technical Details
- **Files Created:** 1 (`internal/handlers/notifications.go`)
- **Files Modified:** 2 (`internal/server/server.go`, `docs/PROJECT_SUMMARY.md`)
- **Lines Added:** ~233

### Backend Integration
- GET /api/notifications - List notifications (supports `?unread=true`)
- POST /api/notifications - Create notification
- GET /api/notifications/{id} - Get by ID (user-scoped)
- PATCH /api/notifications/{id}/read - Mark as read
- PATCH /api/notifications/mark-all-read - Mark all as read
- GET /api/notifications/count - Unread count
- DELETE /api/notifications/{id} - Delete (user-scoped)

---

## [0.10.0] - 2026-04-11

### Added
- **Document upload endpoint** -- `POST /api/documents` with multipart/form-data, 50MB limit, UUID storage filenames
- **Document list endpoint** -- `GET /api/documents?entity_id=X&entity_type=contract`
- **Document download endpoint** -- `GET /api/documents/{id}/download` with proper Content-Type and Content-Disposition headers
- **Document delete endpoint** -- `DELETE /api/documents/{id}` with filesystem cleanup and audit logging
- **Local filesystem storage** -- Files stored under `{data_dir}/documents/{entity_type}/{entity_id}/{uuid}`
- **FK validation** -- Contract existence check before upload (returns 400 if not found)

### Security
- UUID storage filenames prevent path traversal attacks
- 50MB file size limit prevents disk exhaustion
- All routes behind AuthMiddleware
- Audit logging on upload and delete operations

### Technical Details
- **Files Created:** 1 (`internal/handlers/documents.go`)
- **Files Modified:** 3 (`internal/handlers/handler.go`, `internal/server/server.go`, `docs/PROJECT_SUMMARY.md`)
- **Lines Added:** ~270

### Backend Integration
- POST /api/documents - Upload document (multipart/form-data)
- GET /api/documents?entity_id=X&entity_type=contract - List documents
- GET /api/documents/{id}/download - Download file
- DELETE /api/documents/{id} - Delete document

---

## [0.9.0] - 2026-04-11

### Added
- **Supplement CRUD endpoints** -- `GET/POST/PUT/DELETE /api/supplements` with internal ID auto-generation (`SPL-YYYY-NNNN`)
- **Supplement status transition** -- `PATCH /api/supplements/{id}/status` with enforced workflow: draft → approved → active
- **Supplement internal IDs** -- System-generated unique identifiers, resets per year
- **FK validation on supplement create/update** -- Contract and signer existence checks (returns 400 if missing)
- **Audit logging on all supplement operations** -- create, update, delete, status_change with JSON state capture
- **Frontend API migration** -- SupplementsPage and SupplementForm migrated from localStorage to API
- **Status workflow UI buttons** -- Approve, activate, return to draft in SupplementForm
- **Contracts API client** -- `src/lib/contracts-api.ts`
- **Supplements API client** -- `src/lib/supplements-api.ts`

### Changed
- Loading and error states now use accessible markup with `role="status"` and `aria-live`
- All API calls use `AbortController` to prevent memory leaks

### Technical Details
- **Files Created:** 2 (`internal/handlers/supplements.go`, `pacta_appweb/src/lib/supplements-api.ts`)
- **Files Modified:** 8 (backend Go files, frontend TypeScript files)
- **Migration:** `012_supplements_internal_id.sql` -- ALTER TABLE + backfill + unique index

### Backend Integration
- GET /api/supplements - List all supplements
- POST /api/supplements - Create supplement (validates contract + signers)
- GET /api/supplements/{id} - Get supplement by ID
- PUT /api/supplements/{id} - Update supplement
- PATCH /api/supplements/{id}/status - Transition status (enforces workflow)
- DELETE /api/supplements/{id} - Soft delete

---

## [0.8.0] - 2026-04-11

### Added
- **Audit logging system** -- Automatic recording of all CRUD operations on contracts, clients, suppliers, and signers
- **Audit log query endpoint** -- `GET /api/audit-logs` with filtering by entity_type, entity_id, user_id, and action
- **State capture** -- JSON snapshots of previous and new state on update operations for full change history
- **IP address tracking** -- Each audit log entry records the source IP of the request

### Changed
- Delete handler signatures updated to accept `*http.Request` for audit context capture (contracts, clients, suppliers, signers)

### Security
- Immutable audit trail (append-only INSERTs, no UPDATE/DELETE on audit_logs)
- All state changes captured as JSON for compliance and forensics
- Audit logging failure is silent — never breaks the primary operation

### Technical Details
- **Files Created:** 2 (`internal/handlers/audit.go`, `internal/handlers/audit_logs.go`)
- **Files Modified:** 6 (`internal/models/models.go`, `internal/handlers/contracts.go`, `internal/handlers/clients.go`, `internal/handlers/suppliers.go`, `internal/handlers/signers.go`, `internal/server/server.go`)
- **Lines Added:** ~230

### Backend Integration
- GET /api/audit-logs - Query audit logs (supports `?entity_type=`, `?entity_id=`, `?user_id=`, `?action=`)

---

## [0.7.0] - 2026-04-11

### Added
- **Signer CRUD endpoints** -- `GET/POST/PUT/DELETE /api/signers` for managing authorized signers on behalf of clients and suppliers
- **Foreign key validation on signer create/update** -- Pre-INSERT/UPDATE checks ensure `company_id` references an existing client or supplier, returning HTTP 400 instead of raw SQLite errors
- **Soft delete support for signers** -- Deleted signers hidden from list/get endpoints, double-delete returns 404
- **Signer model struct** -- `Signer` type in `internal/models/models.go` matching `authorized_signers` schema

### Changed
- Signer error messages sanitized (no raw SQLite errors exposed to clients)
- Consistent CRUD patterns now across all entities (contracts, clients, suppliers, signers)

### Security
- `company_type` validation enforced (only `client` or `supplier` accepted)
- FK validation prevents orphaned signer records

### Technical Details
- **Files Created:** 1 (`internal/handlers/signers.go`)
- **Files Modified:** 2 (`internal/models/models.go`, `internal/server/server.go`)
- **Lines Added:** ~200 lines

### Backend Integration
- GET /api/signers - List all active signers
- POST /api/signers - Create signer (validates company exists + company_type)
- GET /api/signers/{id} - Get signer by ID
- PUT /api/signers/{id} - Update signer (validates company if changed)
- DELETE /api/signers/{id} - Soft delete signer

---

## [0.6.0] - 2026-04-11

### Added
- **Client update and delete endpoints** -- `GET/PUT/DELETE /api/clients/{id}` with soft delete support
- **Supplier update and delete endpoints** -- `GET/PUT/DELETE /api/suppliers/{id}` with soft delete support

### Changed
- Client and supplier error messages now sanitized (no raw SQLite errors)
- Consistent CRUD patterns across all entities (contracts, clients, suppliers)

---

## [0.5.2] - 2026-04-11

### Fixed
- **M-001: Session cookie missing Secure flag** -- Added `Secure: true` to login and logout cookies, ensuring tokens are only transmitted over HTTPS/TLS

### Security
- Session cookies now protected against man-in-the-middle interception on unencrypted connections

---

## [0.5.1] - 2026-04-11

### Fixed
- GoReleaser build failure caused by unused `database/sql` import in `setup.go`

---

## [0.5.0] - 2026-04-11

### Added
- **First-run setup wizard** -- Multi-step wizard replaces hardcoded default admin, allowing users to set their own admin credentials + seed first client and supplier on initial launch
- **Setup status endpoint** -- `GET /api/setup/status` returns whether first-run setup is needed
- **Atomic setup transaction** -- All setup data (admin, client, supplier) created in single SQLite transaction, ensuring no partial state

### Changed
- Removed hardcoded default admin from migration `001_users.sql`
- Setup wizard auto-logins after successful configuration and redirects to dashboard

### Security
- **C-001: Fixed** -- No more default admin with known bcrypt hash; each installation requires unique admin credentials
- Password validation enforces minimum 8 chars, uppercase, number, and special character

### Technical Details
- **Files Created:** 9 (1 Go handler, 7 TypeScript components, 1 TS lib)
- **Files Modified:** 5 (2 Go files, 3 frontend files)

---

## [0.4.1] - 2026-04-11

### Fixed
- **H-001: Foreign key validation on contract create/update** -- Added pre-INSERT and pre-UPDATE validation for `client_id` and `supplier_id` to return proper HTTP 400 errors instead of raw SQLite constraint violations
- **Error message sanitization on update** -- `updateContract` handler no longer exposes internal SQLite error details to clients

### Security
- Contract creation and update now validate foreign key references before database operations, preventing internal error leakage

---

## [0.4.0] - 2026-04-10

### Added
- **Internal contract ID auto-generation** -- System now generates unique internal IDs (`CNT-YYYY-NNNN` format) for each contract, independent of the user-entered legal contract number
- **Duplicate contract number detection** -- Returns HTTP 409 Conflict with clean error message when user tries to create a contract with an existing number
- **Sanitized API error messages** -- Internal database errors no longer expose raw SQLite details to clients

### Changed
- Contract table now displays both Internal ID and Contract Number columns
- Contract edit form shows read-only Internal ID for reference
- `Contract` model and API responses now include `internal_id` field
- All contract queries updated to return `internal_id` alongside existing fields

### Technical Details
- **Files Created:** 1 (migration `011_contracts_internal_id.sql`)
- **Files Modified:** 6 (3 backend Go files, 3 frontend TypeScript files)
- **Migration:** `ALTER TABLE contracts ADD COLUMN internal_id TEXT NOT NULL DEFAULT ''` with unique index
- **Generation algorithm:** `SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))` per year, resets to 0001 each new year

### Fixed
- H-002: Contract number UNIQUE constraint no longer blocks 2nd contract creation (user enters real number, system tracks via internal_id)
- H-003: API error messages no longer expose internal DB details
- Frontend type mismatch: `ContractFormProps` and `handleCreateOrUpdate` now properly omit `internalId` from form data

---

## [0.3.0] - 2026-04-09

### Added
- Route-level authentication guards with `ProtectedRoute` component
- Skip navigation link for keyboard accessibility
- ARIA landmarks (`role="banner"`, `role="main"`) to layout
- Dynamic page titles on route changes
- `prefers-reduced-motion` media query support
- Comprehensive meta tags (description, Open Graph, robots, theme-color)
- `ProtectedRoute` component with role-based access control

### Changed
- All page components now lazy-loaded with `React.lazy()` and `Suspense`
- AuthContext functions memoized with `useCallback` to prevent cascading re-renders
- Mobile sidebar now uses proper dialog semantics (`role="dialog"`, `aria-modal="true"`)
- All icon-only buttons now have descriptive `aria-label` attributes (17+ instances)
- Active navigation links now use `aria-current="page"`
- Loading states now screen reader accessible with `role="status"` and `aria-live="polite"`
- Focus management improved with main content ref and `tabIndex`
- Muted-foreground contrast ratio darkened to meet WCAG AA 4.5:1
- ESLint config replaced Next.js rules with React + TypeScript recommended
- Vite build config optimized (ES2020 target, no sourcemaps, compressed size reporting)
- Filtered navigation in AppSidebar memoized with `useMemo`
- All decorative icons marked with `aria-hidden="true"`

### Fixed
- XSS vulnerability in PDF export HTML (all user input now sanitized with `escapeHTML()`)
- Memory leak in AuthContext fetch calls (added `AbortController`)
- Toast listener accumulation leak (fixed `useEffect` dependency array)
- Heading hierarchy (changed `h2` to `h1` for page titles)

### Security
- Added route-level authentication guards preventing unauthenticated access
- Implemented code splitting to reduce initial bundle attack surface
- Sanitized all user-controlled data in PDF export to prevent stored XSS

### Accessibility
- Added skip navigation link for keyboard users (WCAG 2.4.1)
- Added ARIA landmarks for screen reader navigation (WCAG 1.3.1)
- Fixed icon button labels for screen reader compatibility (WCAG 4.1.2)
- Improved contrast ratio for muted text (WCAG 1.4.3)
- Added reduced motion support for vestibular disorders (WCAG 2.3.3)

---

## [0.1.0] - Initial Release

### Added
- Contract lifecycle management (CRUD operations)
- Party management (clients, suppliers, authorized signers)
- Supplement approval workflows
- Document attachments
- Automated notifications for expiring contracts
- Audit logging
- Role-based access control (admin, manager, editor, viewer)
- Cookie-based session authentication
- SQLite database with SQL migrations
- React 19 + TypeScript frontend with Vite
- shadcn/ui component library
- Tailwind CSS v4 styling
- Multi-platform builds (Linux amd64/arm64, macOS amd64/arm64, Windows amd64)
- CI/CD pipeline with GitHub Actions
- GoReleaser release automation

[0.3.0]: https://github.com/PACTA-Team/pacta/releases/tag/v0.3.0
[0.2.6]: https://github.com/PACTA-Team/pacta/releases/tag/v0.2.6
