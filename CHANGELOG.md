# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
