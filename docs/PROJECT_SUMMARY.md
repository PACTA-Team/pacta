# PACTA — Project Summary

## What is PACTA?

PACTA is a **local-first Contract Lifecycle Management (CLM) system** distributed as a single Go binary. It enables organizations to manage contracts, clients, suppliers, and authorized signers without relying on any external infrastructure -- no cloud services, no third-party databases, no internet connection required.

All data stays on the user's machine. The entire application -- database, frontend, API server, and migrations -- lives inside one executable.

---

## Problem Statement

Traditional contract management tools fall into two categories:

1. **Spreadsheets and email** -- Unstructured, error-prone, no audit trail, impossible to search at scale.
2. **Enterprise SaaS CLM platforms** -- Expensive, require cloud infrastructure, expose sensitive contract data to third parties, complex onboarding.

PACTA occupies the middle ground: a professional-grade contract management system that runs locally, costs nothing to deploy, and keeps all data under the organization's direct control.

---

## Target Users

- **Small to mid-size legal teams** managing 50-500 active contracts
- **Procurement departments** tracking supplier agreements and renewal dates
- **Consulting firms** managing client contracts across multiple engagements
- **Any organization** that needs contract oversight without cloud dependency

---

## Core Features

| Feature | Description |
|---------|-------------|
| Contract CRUD | Create, read, update, delete contracts with soft delete protection |
| Internal Contract IDs | Auto-generated system identifiers (`CNT-YYYY-NNNN`) for internal tracking, independent of legal contract numbers |
| Party Management | Centralized registry of clients and suppliers with contact details |
| Signer Tracking | Record authorized signers for each party and track execution status |
| Approval Workflows | Supplement lifecycle: draft → approved → active with status transitions |
| Document Attachments | Link supporting documents (PDFs, scans) to contracts and parties |
| Notifications | Automated alerts for expiring contracts and upcoming renewals |
| Audit Logging | Immutable record of every create, update, and delete operation |
| Role-Based Access | Four roles (admin, manager, editor, viewer) with granular permissions |
| Session Management | Secure cookie-based authentication with server-side invalidation |
| Multi-Company Setup | First-run wizard supports single-company and multi-company deployment modes |

---

## Technical Architecture

### Design Principles

1. **Zero external dependencies** -- No PostgreSQL, Redis, or external services required
2. **Single binary distribution** -- Download, run, done
3. **Local-first data** -- All data stays on the machine; no telemetry, no cloud sync
4. **Pure Go** -- No CGO, clean cross-compilation to all major platforms
5. **Embedded everything** -- Frontend, database, migrations all bundled at compile time

### Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend runtime | Go 1.25 | Fast startup, small binary, excellent stdlib |
| Database | SQLite (`modernc.org/sqlite`) | Pure Go, zero-config, perfect for single-user |
| Migrations | goose v3 (`pressly/goose`) | Up/down support, dirty state tracking, CLI tooling |
| HTTP router | `go-chi/chi` | Lightweight, idiomatic, middleware support |
| Frontend framework | React 19 + TypeScript | Type-safe, component-based, large ecosystem |
| Build tool | Vite | Fast HMR during development, optimized production builds |
| Styling | Tailwind CSS v4 | Utility-first, consistent design tokens |
| UI components | shadcn/ui | Accessible, customizable, no component library lock-in |
| Packaging | GoReleaser + NFPM | Automated multi-platform builds, .deb package generation |

### Data Flow

```
Browser → GET / → static HTML/CSS/JS (embedded in binary)
Browser → POST /api/auth/login → Go handler → SQLite → set session cookie
Browser → GET /api/contracts + cookie → Go handler → SQLite → JSON response
```

### Security Model

- Server binds to `127.0.0.1` only -- inaccessible from network
- httpOnly, SameSite=Strict cookies -- no XSS token theft
- bcrypt password hashing (cost 10)
- All SQL queries use parameterized statements -- no injection vectors
- Role-based authorization enforced at API handler level
- Server-side session invalidation on logout

---

## Project Structure

```
pacta/
├── cmd/pacta/              # Entry point + embedded frontend dist
│   ├── main.go             # Application bootstrap
│   └── embed.go            # //go:embed all:dist
├── internal/
│   ├── auth/               # Session management, bcrypt hashing
│   ├── config/             # Application configuration
│   ├── db/                 # SQLite setup + goose migrations
│   │   ├── db.go           # Open() + Migrate() with goose integration
│   │   └── migrations/     # 20 SQL migrations (001-020) with Up/Down markers
│   ├── handlers/           # REST API handlers (contracts, clients, suppliers, signers)
│   ├── models/             # Go data structures
│   └── server/             # HTTP server, chi router, static serving
├── pacta_appweb/           # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/          # Page components (15 pages)
│   │   ├── components/     # React components (shadcn/ui)
│   │   ├── contexts/       # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   ├── types/          # TypeScript type definitions
│   │   └── images/         # Static assets
│   └── vite.config.ts      # Vite build configuration
├── .github/workflows/      # CI/CD (GoReleaser release pipeline)
├── .goreleaser.yml         # Release configuration
└── docs/                   # Architecture, development guides
```

---

## Build & Release Pipeline

The CI/CD pipeline runs on GitHub Actions triggered by version tags (`v*`):

1. **Checkout** repository with full history
2. **Setup** Go 1.25 and Node.js 22
3. **Build frontend** (`npm ci && npm run build` in `pacta_appweb/`)
4. **Copy dist** to `cmd/pacta/dist/` for Go embedding
5. **GoReleaser** builds binaries for 5 platform targets
6. **Package** as `.tar.gz` archives and `.deb` packages
7. **Publish** to GitHub Releases with checksums

### Supported Build Targets

| OS | Arch | Output |
|----|------|--------|
| Linux | amd64 | binary + .deb |
| Linux | arm64 | binary + .deb |
| macOS | amd64 | binary |
| macOS | arm64 | binary |
| Windows | amd64 | binary |

---

## Current Status

| Area | Status |
|------|--------|
| Authentication | Complete (login, logout, session management) |
| First-Run Setup | Complete (v0.5.1 -- setup wizard, atomic admin + client + supplier creation) |
| Contract CRUD | Complete (create, read, update, soft delete, FK validation, error sanitization) |
| Internal Contract IDs | Complete (v0.4.0 -- auto-generated `CNT-YYYY-NNNN`, resets per year) |
| Client Management | Complete (v0.6.0 -- full CRUD with soft delete, error sanitization) |
| Supplier Management | Complete (v0.6.0 -- full CRUD with soft delete, error sanitization) |
| Signer Tracking | Complete (v0.7.0 -- CRUD API endpoints with FK validation, soft delete) |
| Supplement Workflows | Complete (v0.9.0 — CRUD endpoints, status transition workflow, internal IDs, frontend API migration) |
| Document Attachments | Complete (v0.10.0 -- upload, download, list, delete with audit logging) |
| Notifications | Complete (v0.11.0 -- list, create, mark read, mark all read, count, delete) |
| Audit Logging | Complete (v0.8.0 -- automatic CRUD logging, query endpoint with filtering, JSON state capture) |
| Role-Based Access | Complete (v0.15.0 -- middleware enforcement, 4-tier permission levels, inactive account rejection) |
| User Management | Complete (v0.13.0 -- CRUD, password reset, status management, audit logging) |
| Multi-Company Support | Complete (v0.16.0 -- companies table, user_companies, company_id on all data tables, CompanyMiddleware, company-scoped handlers, frontend CompanyContext + CompanySelector + CompaniesPage) |
| Landing Page | Complete (v0.27.0 — About section, FAQ accordion, Contact card, Footer, Download page, Changelog page, professional SEO, favicon, i18n for all new sections) |
| Auth System | Complete (v0.28.0 — Registration endpoint, auto-login, error message propagation, toast notifications) |
| Hybrid Registration | Complete (v0.29.1 — Resend email integration, email code verification with 5-min timeout, admin approval workflow with company assignment, pending approvals UI, SPA routing fix, login bug fix, spaHandler compilation fix) |
| Landing Page Animations | Complete (v0.18.0 -- Framer Motion animations, animated geometric shapes, feature cards, CTA buttons, responsive navbar) |
| Theme System | Complete (v0.18.0 -- ThemeProvider mounted, dark/light/system toggle with persistent preferences) |
| Documentation | Complete (v0.18.0 -- README redesign with badges/changelog table, Linux production guide, Windows local guide, GitHub repo branding) |
| CI/CD Pipeline | Complete (GoReleaser on GitHub Actions) |
| Multi-platform Builds | Complete (Linux amd64/arm64, macOS amd64/arm64, Windows amd64) |
| Frontend Pages | 15 pages created (Dashboard, Contracts, Clients, Suppliers, Signers, Setup, Login, etc.) |
| Frontend Security | Hardened (route guards, XSS prevention, code splitting) |
| Frontend Accessibility | WCAG 2.2 AA compliant (skip nav, ARIA, keyboard nav) |
| Frontend Performance | Optimized (lazy loading, memoization, build config) |
| Database Migrations | Complete (v0.20.4 -- goose v3, 20 migrations with up/down support, dirty state tracking, `goose_db_version` table) |
| Setup Flow Security | Complete (v0.21.0 -- fresh install redirect to /setup, /setup route guard redirects to /403, ForbiddenPage component, HomePage `needs_setup` bug fix) |
| Setup Mode Auto-Advance | Complete (v0.22.0 -- click mode card to auto-advance, tactile card feedback, focus-visible accessibility, "Cambiar a..." toggle button) |

---

## Landing Page Enhancement (v0.27.0)

### What Changed
The public-facing landing page received a comprehensive professional upgrade with new content sections, dedicated pages, SEO optimization, and browser favicon.

### New Sections Added to Landing Page
- **About section** — Three-column card grid showcasing PACTA's core values (Local-First, Open Source, Simplicity) with icon badges and Framer Motion scroll animations
- **FAQ section** — Six-question accordion covering common questions about PACTA's purpose, requirements, data storage, pricing, and installation
- **Contact section** — Gradient-bordered card with email (pactateam @gmail.com) and GitHub repository links
- **Landing footer** — Three-column footer with logo, navigation links, and contact info

### New Dedicated Pages
- **Download page** (`/download`) — Platform-specific download cards (Linux, macOS, Windows) with direct links to GitHub release assets, version badges, and collapsible installation instructions
- **Changelog page** (`/changelog`) — Blog-style timeline of all GitHub releases with parsed markdown notes, team commentary extraction, and "View on GitHub" links

### Technical Additions
- **GitHub API wrapper** — `github-api.ts` with `fetchLatestRelease()`, `fetchAllReleases()`, localStorage caching (5-min TTL), 3-retry exponential backoff, rate limit handling
- **Professional SEO** — JSON-LD `SoftwareApplication` schema, Open Graph tags, Twitter Card tags, canonical URL, keywords meta, `robots: index, follow`
- **Favicon** — Contract SVG icon as browser favicon, `site.webmanifest` for PWA support
- **i18n** — Full English/Spanish translations for download, changelog, about, faq, contact, footer namespaces

### Files Created/Modified
- **15 new files** — 4 landing components, 2 pages, 2 lib modules, 4 locale files, 1 test file, favicon, webmanifest
- **8 modified files** — App.tsx, HomePage.tsx, LandingNavbar.tsx, index.html, 4 locale files
- **5 new tests** — GitHub API wrapper test suite (caching, retry, error handling)

---

## Frontend Audit & Remediation (v0.2.0)

### Audit Scope
Comprehensive multi-agent review of the React + TypeScript frontend identified **101+ issues** across security, accessibility, performance, and code quality dimensions.

### Issues Identified
| Category | Total | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Security | 25 | 4 | 6 | 7 | 8 |
| Accessibility (WCAG 2.2) | 47 | 8 | 14 | 17 | 8 |
| Performance/Quality | 29 | 3 | 8 | 12 | 6 |

### Fixes Implemented (v0.2.0)
**Security:**
- Route-level authentication guards (`ProtectedRoute` component)
- Code splitting with `React.lazy()` for all 15 page components
- `AbortController` on all fetch calls to prevent memory leaks
- `useCallback` memoization for AuthContext functions
- XSS sanitization in PDF export HTML (`escapeHTML()` function)

**Accessibility:**
- Skip navigation link for keyboard users
- ARIA landmarks (`role="banner"`, `role="main"`)
- Mobile sidebar dialog semantics (`role="dialog"`, `aria-modal="true"`)
- 17+ icon-only buttons with proper `aria-label` attributes
- `aria-current="page"` for active navigation links
- `aria-hidden="true"` on all decorative icons
- Screen reader accessible loading states
- Dynamic page titles on route changes
- Focus management with main content ref and `tabIndex`
- Muted-foreground contrast ratio fixed (WCAG AA 4.5:1)
- `prefers-reduced-motion` media query support

**Performance:**
- ESLint config fixed (React + TypeScript recommended rules)
- Meta tags added (description, Open Graph, robots, theme-color)
- Toast listener memory leak fixed
- Vite build optimization (ES2020 target, no sourcemaps)
- `useMemo` for filtered navigation in AppSidebar

### Remaining Issues (Future Iterations)
The following were identified but deferred to keep the initial PR focused on critical/high impact:

**Security:**
- [ ] CSRF token implementation (requires backend changes)
- [ ] Password removal from localStorage (requires backend auth system migration)
- [ ] Input validation on all forms (Zod schema enforcement)
- [ ] API client auth interceptors (401/403 handling)
- [ ] Rate limiting on login endpoint (backend concern)

**Accessibility:**
- [ ] Chart accessible alternatives (data tables for screen readers)
- [ ] Toast library migration to sonner (proper `aria-live` regions)
- [ ] Table captions on all data tables
- [ ] Fieldset/legend grouping for related form controls
- [ ] Delete confirmation dialogs with specific context

**Performance:**
- [ ] Replace filter `useEffect` + `useState` with `useMemo` (5 CRUD pages)
- [ ] DashboardPage derived data memoization
- [ ] `crypto.randomUUID()` for ID generation (collision risk)
- [ ] Dead code cleanup across pages
- [ ] SOLID pattern refactoring (ContractForm, GlobalClientEffects)

**Code Quality:**
- [ ] Remove `password` field from User type (client-side storage concern)
- [ ] Remove `initializeDefaultUser()` (hardcoded credentials)
- [ ] Migrate from localStorage to server-side API calls
- [ ] Add comprehensive test suite (vitest configured, no tests exist)

---

## Internal Contract IDs (v0.4.0)

### Design Rationale

Contracts in the real world have **two identifiers**:

1. **Contract Number** (`contract_number`) -- The legal number assigned to the contract by the parties involved (client/supplier). This is the number that appears on the actual legal document. **Users must enter this manually** because it comes from the contract itself, not from PACTA.

2. **Internal ID** (`internal_id`) -- A system-generated identifier (`CNT-YYYY-NNNN` format) used by PACTA to track contracts internally. This is auto-generated on creation and cannot be changed.

### Why Both Are Needed

- The **contract number** is what users reference in legal contexts, invoices, and communications. It may follow any format the organization uses (e.g., `CONTRATO-CLI-2024-001`, `SUP-2024-045`). PACTA cannot auto-generate this because it doesn't know the numbering scheme used by the parties.

- The **internal ID** gives PACTA a reliable, unique, system-controlled identifier for internal operations, audit trails, and database integrity. It follows a predictable format (`CNT-2026-0001`) that resets each year.

### Implementation

| Component | Detail |
|-----------|--------|
| Format | `CNT-YYYY-NNNN` (e.g., `CNT-2026-0001`) |
| Sequence | Increments per contract within the same year |
| Year rollover | Resets to `0001` when year changes |
| Storage | `internal_id TEXT NOT NULL UNIQUE` column |
| Generation | `SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))` filtered by year |
| Thread safety | SQLite serializes writes by default; no explicit transaction needed |
| Migration | `011_contracts_internal_id.sql` -- `ALTER TABLE` + `CREATE UNIQUE INDEX` |

### Error Handling

- **Duplicate contract number**: Returns HTTP 409 Conflict with message `"contract number 'X' already exists"`
- **Sanitized errors**: Internal database errors return generic `"failed to create contract"` message; details are logged server-side only

---

## Supplement Internal IDs (v0.9.0)

### Design Rationale

Supplements follow the same dual-identifier pattern as contracts:

1. **Supplement Number** (`supplement_number`) -- The sequential number of the supplement within its parent contract (e.g., "1", "2", "3"). This is user-entered and represents the legal supplement number on the document.

2. **Internal ID** (`internal_id`) -- A system-generated identifier (`SPL-YYYY-NNNN` format) used by PACTA to track supplements internally. Auto-generated on creation, immutable.

### Why Both Are Needed

- The **supplement number** is a simple ordinal within the contract context (Supplement 1, Supplement 2, etc.). Users know which supplement they're working with by this number.

- The **internal ID** provides a globally unique, system-controlled identifier across all supplements in the database. This is essential for audit trails, API references, and avoiding ambiguity when multiple contracts have supplements with the same number.

### Status Workflow

Supplements follow a three-state lifecycle with enforced transitions:

```
draft ──→ approved ──→ active
  ↑          │
  └──────────┘
```

| Transition | Allowed | Use Case |
|------------|---------|----------|
| draft → approved | Yes | Manager approves supplement content |
| approved → active | Yes | Supplement goes into effect |
| approved → draft | Yes | Manager returns for revision |
| active → any | No | Active supplements are immutable |

Transitions are validated at the handler level. Invalid transitions return HTTP 400 with a descriptive message.

### Implementation

| Component | Detail |
|-----------|--------|
| Format | `SPL-YYYY-NNNN` (e.g., `SPL-2026-0001`) |
| Sequence | Increments per supplement within the same year |
| Year rollover | Resets to `0001` when year changes |
| Storage | `internal_id TEXT NOT NULL UNIQUE` column (migration 012) |
| Generation | `SELECT MAX(CAST(SUBSTR(internal_id, 10) AS INTEGER))` filtered by year |
| Thread safety | SQLite serializes writes by default |
| Migration | `012_supplements_internal_id.sql` -- `ALTER TABLE` + backfill + `CREATE UNIQUE INDEX` |

### FK Validation

- `contract_id` must reference an existing, non-deleted contract (HTTP 400 if missing)
- `client_signer_id` and `supplier_signer_id` must reference existing, non-deleted signers (HTTP 400 if missing)
- All validations run before INSERT/UPDATE to return clean errors

### Audit Logging

Every supplement operation is logged with JSON state capture:
- **create**: logs new state (id, internal_id, contract_id, supplement_number, status)
- **update**: logs previous and new state for all changed fields
- **delete**: logs previous state (supplement_number, status)
- **status_change**: logs previous and new status values

### Error Handling

- **Invalid status value**: Returns HTTP 400 with `"status must be 'draft', 'approved', or 'active'"`
- **Invalid transition**: Returns HTTP 400 with `"cannot transition from 'X' to 'Y'"`
- **Missing FK**: Returns HTTP 400 with `"contract not found"` or `"client/supplier signer not found"`
- **Sanitized errors**: Internal database errors return generic messages; details logged server-side

---

## QA Deployment & Testing (v0.3.2 — 2026-04-09)

### Deployment Procedure

PACTA v0.3.2 was deployed to a production VPS for QA testing. The procedure is documented in `docs/plans/2026-04-09-qa-deployment-design.md` and `docs/plans/2026-04-09-qa-deployment-plan.md`.

**Steps performed:**
1. Downloaded latest release from GitHub Releases (`pacta_0.3.2_linux_amd64.tar.gz`)
2. Extracted and installed to `/opt/pacta/pacta`
3. Created systemd service (`/etc/systemd/system/pacta.service`)
4. Configured Caddy reverse proxy at `pacta.duckdns.org` → `localhost:3000`
5. TLS certificate auto-provisioned via Let's Encrypt (valid until Jul 7, 2026)
6. Database created at `/root/.local/share/pacta/data/pacta.db` (XDG spec compliant)

### Changes Made During QA

**Critical fix applied:**
- **C-001: Default admin password hash invalid** — The bcrypt hash in migration `001_users.sql` (`$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`) does NOT match `admin123`. This is a well-known fake test hash. Generated a real bcrypt hash and updated the database directly. **Requires migration fix in source code.**

**Test data created:**
- 3 clients: Test Corp, Sample Inc, Demo LLC
- 3 suppliers: Supply Co, Vendor Ltd, Provider SA
- 1 contract: Active Service Agreement (status: active)

### QA Health Score: 62/100

| Category | Score | Notes |
|----------|-------|-------|
| Console | 100 | No errors detected |
| Links | 100 | No broken links found |
| Visual | 90 | Minor layout issues on mobile |
| Functional | 50 | Contract creation broken |
| UX | 60 | Error messages expose internals |
| Performance | 80 | Fast response times |
| Content | 100 | No typos found |
| Accessibility | 40 | Not tested (requires browser) |
| **Weighted Total** | **62** | |

### Bugs Found

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C-001 | Critical | Default admin password hash doesn't match `admin123` | **Fixed v0.5.1** -- replaced with first-run setup wizard |
| H-001 | High | Contract creation returns 500 with raw SQLite error on missing FK | **Fixed v0.4.1** -- pre-INSERT/UPDATE FK validation, returns 400 Bad Request |
| H-002 | High | Contract number not auto-generated, UNIQUE constraint fails on 2nd contract | **Fixed v0.4.0** -- internal_id auto-generated, user enters legal contract_number |
| H-003 | High | API error messages expose internal DB details to clients | **Fixed v0.4.0** -- sanitized errors, 409 Conflict on duplicates |
| M-001 | Medium | Cookie missing `Secure` flag (implicit via HTTPS) | **Fixed v0.5.2** -- added `Secure: true` to session cookies |

### QA Artifacts

- Full report: `.gstack/qa-reports/qa-report-pacta-duckdns-2026-04-09.md`
- Cookie security: `.gstack/qa-reports/security-cookies.txt`
- Input validation: `.gstack/qa-reports/security-input-validation.txt`
- API results: `.gstack/qa-reports/api-auth-results.txt`

---

## Version Summary

| Version | Release | Key Deliverables |
|---------|---------|------------------|
| v0.29.1 | Current | spaHandler compilation fix (fs.File not io.ReadSeeker → bytes.NewReader), all v0.29.0 features |
| v0.29.0 | - | Hybrid registration (Resend email code + admin approval), email verification with 5-min timeout, admin approval workflow with company assignment, pending approvals UI, SPA routing fix (back button + F5), login bug fix, role constants, user company assignment from admin panel |
| v0.28.0 | Latest | Registration endpoint (`POST /api/auth/register`), auto-login after registration, error message propagation to toasts, silent failure fixes, AuthContext return type refactor |
| v0.27.0 | Latest | Frontend modernization: purple-accented OKLCH color palette (light/dark), collapsible sidebar with tooltips, glassmorphism dashboard cards, gradient button variants, modernized input/badge/card components, landing page gradient accents |
| v0.25.2 | - | Light/dark theme system fix (next-themes `attribute="class"`), ThemeToggle hydration mismatch fix, theme icon state sync |
| v0.25.1 | - | Supplements page crash fix (migration 022 `deleted_at` column) |
| v0.25.0 | - | Split-screen login layout (responsive 60/40 desktop, 50/50 tablet, single-column mobile), theme-aware branding gradient, LoginForm layout wrapper removal, Framer Motion entrance animations |
| v0.24.0 | - | Automatic language detection (i18n), Spanish/English support, LanguageToggle, 32 translation files, 32+ components translated |
| v0.23.0 | - | Complete localStorage elimination (audit logs, notifications, settings), notification settings backend API, all 24 TypeScript errors fixed, 41 tests passing, clean `tsc --noEmit` build |
| v0.22.0 | Latest | Setup mode auto-advance (click card to advance, tactile feedback, focus-visible styles, "Cambiar a..." toggle) |
| v0.21.0 | Latest | Setup flow security (fresh install redirect to /setup, /setup guard redirects to /403, ForbiddenPage component, HomePage `needs_setup` bug fix) |
| v0.20.4 | - | Fix missing migration 016 (documents/notifications/audit_logs company_id), correct migration ordering |
| v0.20.3 | - | Fix backfill migration referencing non-existent `deleted_at` column on supplements table |
| v0.20.2 | - | Fix migration ordering (backfill runs after all ALTER TABLE migrations) |
| v0.20.1 | - | Remove redundant migration 015 (company_id already in authorized_signers CREATE TABLE) |
| v0.20.0 | - | Goose database migrations (up/down support, dirty state tracking, CLI tooling), GoReleaser `before.hooks` for `go mod tidy` |
| v0.19.0 | - | Migration idempotency fix (duplicate column name error handling for fresh installs) |
| v0.18.0 | - | Landing page (Framer Motion), theme toggle fix, README redesign, Linux/Windows installation guides, GitHub repo branding |
| v0.17.0 | Latest | Multi-company setup wizard (company mode selector, company info step, 7-step wizard flow, company data in setup payload) |
| v0.16.0 | - | Multi-company support (companies table, company_id on all data, CompanyMiddleware, company-scoped handlers, frontend CompanyContext + CompanySelector + CompaniesPage) |
| v0.15.0 | - | Role-based access control enforcement (middleware, 4-tier permissions, inactive account rejection) |
| v0.14.0 | - | Users frontend API migration (UsersPage from localStorage to backend API) |
| v0.13.0 | - | User management CRUD endpoints (create, update, delete, password reset, status) |
| v0.12.0 | - | Frontend API migration (documents & notifications from localStorage to backend API) |
| v0.11.0 | - | Notification endpoints (list, create, mark read, mark all read, count, delete) |
| v0.10.0 | - | Document attachments (upload, download, list, delete, audit logging) |
| v0.9.0 | Latest | Supplement workflow (CRUD, status transitions, internal IDs, frontend API migration) |
| v0.8.0 | - | Audit logging system (CRUD logging, query endpoint, JSON state capture) |
| v0.7.0 | - | Signer CRUD endpoints with FK validation and soft delete |
| v0.6.0 | - | Client/Supplier full CRUD with soft delete and error sanitization |
| v0.5.2 | - | Cookie Secure flag fix (M-001) |
| v0.5.1 | - | First-run setup wizard (replaces hardcoded admin password) |
| v0.4.1 | - | FK validation on contract create/update (400 Bad Request, error sanitization) |
| v0.4.0 | - | Internal contract IDs, auth system, contract CRUD, error sanitization |
| v0.3.x | - | QA deployment, Caddy reverse proxy, systemd service |
| v0.2.x | - | Frontend security, accessibility, performance hardening |
| v0.1.x | - | Initial releases, basic contract management |

---

## Progress Tracking

### Completed (v0.26.0)

**Frontend Modernization:**
- [x] Color palette updated to purple primary + orange accent (OKLCH, both light/dark themes)
- [x] Button component: gradient and soft variants, rounded-lg
- [x] Card component: hover shadow transitions, rounded-xl
- [x] Input component: rounded-lg, shadow-sm, purple focus ring
- [x] Badge component: soft variant
- [x] AppSidebar: collapsible with smooth animation, gradient active states, tooltips, modern user profile
- [x] AppLayout: CompanySelector moved to header
- [x] DashboardPage: glassmorphism stat cards, gradient icon backgrounds, improved expiring contracts
- [x] Landing page: gradient CTA button, gradient icon backgrounds, backdrop-blur cards
- [x] TypeScript: 0 errors, clean build
- [x] Design doc: `docs/plans/2026-04-13-frontend-modernization-plan.md`

### Completed (v0.25.0)

**Split-Screen Login Layout:**
- [x] LoginForm outer `min-h-screen` layout wrapper removed — now renders as pure Card component
- [x] LoginPage rewritten with responsive split-screen layout
- [x] Desktop (>1024px): 60/40 split with branding panel (logo + tagline) on left, form on right
- [x] Tablet (768px-1024px): 50/50 split
- [x] Mobile (<768px): Single column with compact logo header above form
- [x] Theme-aware branding gradient using CSS variables (`from-primary/5 via-background to-primary/10`)
- [x] Framer Motion staggered fade-in animations for both panels
- [x] Logo clickable on both panels, navigates to home page
- [x] `prefers-reduced-motion` respected (handled globally in index.css)
- [x] PR merged: https://github.com/PACTA-Team/pacta/pull/61

### Completed (v0.24.0)

**Automatic Language Detection (i18n):**
- [x] i18next ecosystem installed (i18next@26.0.4, react-i18next@17.0.2, i18next-browser-languagedetector@8.2.1)
- [x] i18n configuration (`src/i18n/index.ts`) with browser language detection
- [x] Detection priority chain: localStorage cache → navigator.language → fallback to 'en'
- [x] Spanish detection logic: `navigator.language.startsWith('es')` → 'es', everything else → 'en'
- [x] LanguageToggle component (mirrors ThemeToggle pattern with Languages icon)
- [x] LanguageToggle integrated in AppLayout header and LandingNavbar (desktop + mobile)
- [x] Dynamic HTML lang attribute synced via useEffect in App.tsx
- [x] 32 translation JSON files created (16 Spanish + 16 English)
- [x] 16 namespaces: common, landing, login, setup, contracts, clients, suppliers, supplements, reports, settings, documents, notifications, signers, companies, pending, dashboard
- [x] ~446 translation keys defined per language
- [x] 25+ components wrapped with useTranslation() hooks
- [x] Date/number formatting updated to use i18n.language for locale-aware formatting
- [x] Build verified (vite build passes)

**Remaining i18n tasks:**
- [x] Complete string replacements in 7 files (UsersPage, SupplementsPage, AuthorizedSignersPage, CompaniesPage, NotificationsPage, AuthorizedSignerForm, SupplementForm) — all translated
- [x] Write i18n unit tests (detection config, language switching, namespace verification)
- [x] CHANGELOG update and version bump to 0.24.0
- [x] PR created: https://github.com/PACTA-Team/pacta/pull/59

### Completed (v0.23.0)

**localStorage Elimination:**
- [x] `audit-api.ts` module — `list()`, `listByContract()`, `listByEntityType()` calling `GET /api/audit-logs`
- [x] `audit.ts` refactored — `addAuditLog()` removed, `getContractAuditLogs()` reads from API
- [x] `notifications.ts` migrated — `generateNotifications()` POSTs to API, `markNotificationAsRead`/`markNotificationAsAcknowledged` call PATCH API
- [x] `notification-settings-api.ts` module — `get()`, `update()` calling `GET/PUT /api/notification-settings`
- [x] Backend notification settings — migration 021, `notification_settings.go` handler, routes registered
- [x] `notifications-api.ts` — `create()` method added
- [x] `GlobalClientEffects.tsx` — async notification generation via API
- [x] `ContractDetailsPage.tsx` — audit logs from API with error handling
- [x] `AuthorizedSignerForm.tsx` — client/supplier dropdowns from API
- [x] `storage.ts` cleanup — 6 functions removed, 3 STORAGE_KEYS entries removed
- [x] `AuditLog` type updated to match backend format (snake_case)

**TypeScript Error Resolution (24 errors fixed):**
- [x] `ForbiddenPage.tsx` — 5 motion-dom variant errors fixed with `Variants` type + `as const`
- [x] `NotFoundPage.tsx` — 6 motion-dom variant errors fixed with `Variants` type + `as const`
- [x] `ModificationsReport.tsx` — 2 number/string mismatch errors fixed (`getContractInfo` accepts `number | string`)
- [x] `SupplementsReport.tsx` — 5 errors fixed (signature, `contractId` vs `contract_id`, Map type)
- [x] `DocumentsPage.tsx` — 1 unknown type error fixed (`as any[]` cast)
- [x] `SupplementsPage.tsx` — 1 unknown type error fixed (`as any` cast)
- [x] `SupplementForm.tsx` — 1 event target error fixed (`e.target as HTMLFormElement`)
- [x] `UsersPage.tsx` — 2 disabled prop errors fixed (ternary instead of `&&`)

**Verification:**
- [x] 0 TypeScript errors (`tsc --noEmit` clean)
- [x] 41/41 tests passing (7 test files)
- [x] 0 localStorage dependencies for audit, notifications, settings

### Completed (v0.21.0)

- [x] `ForbiddenPage` component (403 Access Denied page with shield icon, action buttons)
- [x] Setup route guard in `SetupPage` — checks `/api/setup/status`, redirects to `/403` if `needs_setup === false`
- [x] HomePage bug fix — `data.firstRun` → `data.needs_setup` for correct API field reading
- [x] `/403` route added to `App.tsx`
- [x] AuthContext no longer redirects to `/setup` on 401 (only on network errors)

### Completed (v0.20.4)

- [x] Migrated from custom `migrate.go` to goose v3 (`internal/db/db.go`)
- [x] 20 goose migrations with `-- +goose Up` / `-- +goose Down` markers
- [x] `goose_db_version` table replaces old `schema_migrations`
- [x] GoReleaser `before.hooks: go mod tidy` (no dirty state in CI)
- [x] Migration 013: `companies` + `user_companies` tables
- [x] Migration 014: `company_id` on users, clients, suppliers
- [x] Migration 016: `company_id` on documents, notifications, audit_logs
- [x] Migration 017: `company_id` on contracts
- [x] Migration 018: `company_id` on supplements
- [x] Migration 019: `company_id` on sessions
- [x] Migration 020: Backfill existing data to default company
- [x] `CompanyMiddleware` — company scoping with context injection
- [x] Company CRUD endpoints (list, create, get, update, delete)
- [x] User company membership endpoints (list, switch)
- [x] Session struct updated with `CompanyID`
- [x] Login flow resolves user's default company
- [x] All handlers company-scoped (contracts, clients, suppliers, signers, supplements, documents, notifications, audit_logs)
- [x] `auditLog` helper updated to accept `companyID` (23 callers updated)
- [x] Model structs: `CompanyID` added to Client, Supplier, Contract, Supplement, AuditLog
- [x] Frontend: TypeScript types (`Company`, `UserCompany`)
- [x] Frontend: Companies API client (`companies-api.ts`)
- [x] Frontend: `CompanyContext` React provider
- [x] Frontend: `CompanySelector` component (sidebar dropdown)
- [x] Frontend: Companies page (CRUD with search, create, edit, delete)
- [x] Frontend: App.tsx wrapped with `CompanyProvider`
- [x] Frontend: Sidebar nav link for Companies (admin/manager)

### Completed (v0.14.0)

- [x] Users API client module (`src/lib/users-api.ts`)
- [x] UsersPage migrated from localStorage to API
- [x] Password reset UI with dedicated form
- [x] Delete user button with self-protection
- [x] Loading states and error handling
- [x] Support for locked status

### Completed (v0.13.0)

- [x] User list endpoint (`GET /api/users` — excludes password_hash)
- [x] User create endpoint (`POST /api/users` — bcrypt password hashing)
- [x] User get by ID endpoint (`GET /api/users/{id}`)
- [x] User update endpoint (`PUT /api/users/{id}` — name, email, role)
- [x] User delete endpoint (`DELETE /api/users/{id}` — soft delete, cannot delete own)
- [x] Password reset endpoint (`PATCH /api/users/{id}/reset-password`)
- [x] User status endpoint (`PATCH /api/users/{id}/status` — active/inactive/locked)
- [x] Self-protection: cannot demote own admin role, delete own account, or change own status
- [x] Audit logging on all operations (create, update, delete, reset_password, update_status)
- [x] Duplicate email detection (409 Conflict)
- [x] Role validation (admin, manager, editor, viewer only)

### Completed (v0.12.0)

- [x] Documents API client module (`src/lib/documents-api.ts`)
- [x] Notifications API client module (`src/lib/notifications-api.ts`)
- [x] DocumentsPage migrated from localStorage to API
- [x] NotificationsPage migrated from localStorage to API
- [x] ContractDetailsPage docs section migrated to API
- [x] Notification badge count in AppSidebar (polls every 30s)
- [x] Removed generateNotifications from DashboardPage
- [x] Updated TypeScript types to match backend snake_case format

### Completed (v0.11.0)

- [x] Notification list endpoint (`GET /api/notifications` with `?unread=true` filter)
- [x] Notification create endpoint (`POST /api/notifications`)
- [x] Notification mark read endpoint (`PATCH /api/notifications/{id}/read`)
- [x] Mark all notifications read endpoint (`PATCH /api/notifications/mark-all-read`)
- [x] Notification count endpoint (`GET /api/notifications/count`)
- [x] Notification get by ID endpoint (`GET /api/notifications/{id}`)
- [x] Notification delete endpoint (`DELETE /api/notifications/{id}`)
- [x] User-scoped queries (notifications filtered by authenticated user)

### Completed (v0.10.0)

- [x] Document upload endpoint (`POST /api/documents` with multipart/form-data)
- [x] Document list endpoint (`GET /api/documents?entity_id=X&entity_type=contract`)
- [x] Document download endpoint (`GET /api/documents/{id}/download`)
- [x] Document delete endpoint (`DELETE /api/documents/{id}`)
- [x] Local filesystem storage with UUID filenames (path traversal prevention)
- [x] 50MB file size limit
- [x] FK validation (contract existence check)
- [x] Audit logging on upload and delete

### Completed (v0.9.0)

- [x] Supplement CRUD endpoints (`GET/POST/PUT/DELETE /api/supplements`)
- [x] Supplement status transition endpoint (`PATCH /api/supplements/{id}/status`)
- [x] Supplement internal IDs (auto-generated `SPL-YYYY-NNNN`, resets per year)
- [x] FK validation on supplement create/update (contract, signers)
- [x] Audit logging on all supplement operations (create, update, delete, status_change)
- [x] Frontend migration from localStorage to API (SupplementsPage, SupplementForm)
- [x] Status workflow UI buttons (approve, activate, return to draft)
- [x] Contracts API client module (`src/lib/contracts-api.ts`)
- [x] Supplements API client module (`src/lib/supplements-api.ts`)
- [x] Loading/error states with accessible markup
- [x] AbortController on all API calls

### Completed (v0.8.0)

- [x] Audit logging system — automatic recording of all CRUD operations
- [x] Audit log query endpoint (`GET /api/audit-logs` with filtering)
- [x] JSON state capture on updates (previous + new state)
- [x] IP address tracking on all audit entries
- [x] Silent failure design (audit never breaks primary operation)
- [x] Delete handler signatures updated to accept `*http.Request`

### Completed (v0.7.0)

- [x] Signer CRUD endpoints (`GET/POST/PUT/DELETE /api/signers`)
- [x] Foreign key validation on signer create/update (pre-INSERT/UPDATE checks for client/supplier existence)
- [x] Soft delete support for signers
- [x] `company_type` validation (only `client` or `supplier` accepted)
- [x] Sanitized error messages on signer handlers (no raw SQLite errors)
- [x] Signer model struct added to `internal/models/models.go`

### Completed (v0.6.0)

- [x] Client update and delete endpoints (`GET/PUT/DELETE /api/clients/{id}`)
- [x] Supplier update and delete endpoints (`GET/PUT/DELETE /api/suppliers/{id}`)
- [x] Soft delete support for clients and suppliers
- [x] Sanitized error messages on client/supplier handlers
- [x] Full CRUD parity across contracts, clients, and suppliers

### Completed (v0.5.2)

- [x] M-001: Cookie Secure flag fix (`Secure: true` on login/logout cookies)

### Completed (v0.5.1)

- [x] First-run setup wizard (replaces hardcoded default admin, fixes C-001)
- [x] Setup status endpoint (`GET /api/setup/status`)
- [x] Atomic setup transaction (admin + client + supplier)
- [x] Auto-redirect to setup on first run
- [x] Multi-step wizard: Welcome → Admin → Client → Supplier → Review (extended to 7 steps in v0.17.0)
- [x] Zod validation + password strength indicator
- [x] GoReleaser build fix (unused import removal)

### Completed (v0.18.0)

- [x] Theme toggle fix — `ThemeProvider` from `next-themes` mounted in `main.tsx` (broken since v0.2.0)
- [x] AnimatedLogo component — reusable animated SVG logo with scale-in + floating animation
- [x] LandingNavbar — responsive navbar with mobile hamburger menu and `AnimatePresence`
- [x] HeroSection — full-screen hero with animated geometric shapes, gradient text, CTA buttons
- [x] FeaturesSection — 3 feature cards with staggered scroll-triggered animations
- [x] HomePage replaced with full landing page composition (navbar + hero + features)
- [x] LoginPage enhanced with animated PACTA logo and spring entrance animation
- [x] Setup redirect preserved in new HomePage (first-run check → `/setup`)
- [x] Code review completed with two-stage review process (spec compliance + code quality)
- [x] README.md redesigned with shields.io badges, updated features, changelog table
- [x] Linux installation guide created (production: .deb/tarball, systemd, Caddy/Nginx, firewall, troubleshooting)
- [x] Windows installation guide created (local: download, extract, shortcut, auto-start, troubleshooting)
- [x] GitHub repository description updated with professional tagline
- [x] 15 topics/tags added to GitHub repository

### Completed (v0.17.0)

- [x] Multi-company setup wizard (single/multi-company mode selection)
- [x] Company mode selector component (`SetupModeSelector.tsx`)
- [x] Company info step component (`StepCompany.tsx`) — captures name, address, tax_id
- [x] Extended wizard flow from 5 to 7 steps (Welcome → Company Mode → Company Info → Admin → Client → Supplier → Review)
- [x] Updated setup API payload to include `company_mode` and `company` fields
- [x] Review screen updated to display company information and mode
- [x] Backend `setup.go` updated to accept and process company data

### Completed (v0.4.1)

- [x] Fix H-001: FK validation on contract create/update (pre-INSERT/UPDATE checks, 400 Bad Request, error sanitization)

### Completed (v0.4.0)

- [x] Authentication system (login, logout, session management)
- [x] Contract CRUD (create, read, update, soft delete)
- [x] Internal contract IDs (auto-generated `CNT-YYYY-NNNN`, migration 011)
- [x] Client management (create, list)
- [x] Supplier management (create, list)
- [x] Signer tracking (database schema)
- [x] Supplement workflows (database schema)
- [x] Document attachments (database schema)
- [x] Notifications (database schema)
- [x] Audit logging (database schema)
- [x] Role-based access control (database schema)
- [x] CI/CD pipeline (GoReleaser)
- [x] Multi-platform builds (Linux, macOS, Windows)
- [x] Frontend security hardening (v0.2.0)
- [x] Frontend accessibility improvements (v0.2.0)
- [x] Frontend performance optimization (v0.2.0)
- [x] QA deployment to VPS (v0.3.2)
- [x] Caddy reverse proxy configuration
- [x] Systemd service setup
- [x] Duplicate contract number detection (409 Conflict, clean error messages)
- [x] API error message sanitization (no raw SQLite errors)

### In Progress

_No active work in progress. Latest PR: [#59 — Automatic language detection (i18n)](https://github.com/PACTA-Team/pacta/pull/59)_

### Pending — Backend (Highest Priority)

- [ ] **Rate limiting on login endpoint** — Brute force protection
- [ ] **Company data initialization during setup** — Store company info from setup wizard into companies table

### Pending — Frontend

- [ ] **Document upload UI** — Requires backend endpoints first
- [ ] **Notification center UI** — Requires backend endpoints first
- [ ] **User management page** — Requires backend endpoints first (admin only)
- [ ] **Contract creation form with client/supplier dropdowns** — Backend ready, UI incomplete
- [ ] **Contract detail view with edit functionality** — Backend ready, UI incomplete
- [ ] **Client/supplier edit/delete flows** — Backend ready, UI incomplete
- [ ] **Signer management UI** — Backend ready (v0.7.0), UI incomplete
- [ ] **Settings/profile page** — Not started
- [ ] Full browser-based QA of all pages (dashboard, contracts, clients, suppliers)
- [ ] Mobile responsive testing at 375px, 768px, 1280px
- [ ] Keyboard navigation testing (WCAG 2.1)
- [ ] Screen reader testing (ARIA landmarks, labels)
- [ ] Color contrast verification (WCAG AA 4.5:1)
- [ ] CSRF token implementation
- [ ] Remove password from localStorage
- [ ] Add Zod validation to all forms
- [ ] Add API auth interceptors (401/403 handling)

### Pending — Testing

- [ ] Unit tests for Go handlers (auth, contracts, clients, suppliers, signers, audit)
- [ ] Integration tests for API endpoints
- [ ] Frontend unit tests (vitest configured, none exist)
- [ ] E2E tests with Playwright
- [ ] Load testing for concurrent users

### Completed — Recent

- [x] Split-screen login layout refactor — PR #61 merged, v0.25.0
- [x] i18n automatic language detection — PR #59 merged, v0.24.0
- [x] localStorage elimination (audit, notifications, settings) — v0.23.0
- [x] Setup mode auto-advance — v0.22.0
- [x] Setup flow security (ForbiddenPage, guard) — v0.21.0
- [x] Goose database migrations — v0.20.0
- [x] Multi-company support — v0.16.0
- [x] Role-based access control — v0.15.0

### Pending — Documentation

- [ ] User guide / manual
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Backup and restore procedures
- [ ] Troubleshooting guide

---

## Future Roadmap

- [ ] Contract template system with variable substitution
- [ ] Bulk operations (export, import, status updates)
- [ ] Advanced search with full-text indexing
- [ ] Contract comparison view (side-by-side diff)
- [ ] Email notifications for renewal alerts
- [ ] Custom role definitions and permission matrices
- [ ] Data export (CSV, PDF report generation)
- [ ] Backup and restore utilities
- [ ] Multi-language UI support (i18n) — **Complete (v0.24.0)** — PR #59, 18 commits, 32 translation files, 32+ components translated
- [ ] systemd service template for easy installation
- [ ] Docker container option
- [ ] Windows installer (.exe with auto-start and browser launch)

---

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | SQLite over PostgreSQL | Zero external dependencies, perfect for single-user local apps |
| Frontend | Static export over SSR | No Node.js runtime needed, smaller binary, faster startup |
| Sessions | Cookies over JWT | Simpler for local-only apps, httpOnly prevents XSS theft |
| Embed location | `cmd/pacta/` over `internal/server/` | Go embed paths are relative to source file; must be at build root |
| Build pipeline | GoReleaser over manual scripts | Automated multi-platform builds, checksums, release management |
| Data directory | XDG spec (`~/.local/share/pacta/data`) | Professional standard, follows Linux conventions |
| QA deployment | Caddy reverse proxy | Auto TLS, simple config, production-ready |

---

## Using the Language Toggle

### For End Users

The language toggle is available on **every page** of the application:

1. **Landing page** — Top-right corner of the navbar, next to the Login button
2. **Authenticated app** — Top-right corner of the header, next to the theme toggle

**How it works:**
- Click the Languages icon (🌐) to open the dropdown
- Select **English** or **Español**
- Your preference is saved to localStorage and persists across sessions
- The entire UI updates immediately without page reload

**Automatic detection:**
- On first visit, PACTA detects your browser's language setting
- If your browser is configured in Spanish (`es`, `es-MX`, `es-AR`, etc.), the app displays in Spanish automatically
- All other browser languages default to English
- Manual override always takes precedence over automatic detection

### For Developers

**Adding a new language:**

1. Create translation files in `pacta_appweb/public/locales/{lang}/` for each namespace
2. Add the language to `supportedLngs` in `src/i18n/index.ts`
3. Update the LanguageToggle component to include the new option
4. No code changes needed — i18next loads the new JSON files automatically

**Translating a new component:**

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('namespace'); // e.g., 'contracts', 'common'
  
  return (
    <div>
      <h1>{t('myKey')}</h1>
      <p>{t('anotherKey', { count: 5 })}</p> {/* with interpolation */}
    </div>
  );
}
```

**Using multiple namespaces:**

```tsx
const { t } = useTranslation('contracts');
const { t: tCommon } = useTranslation('common');

// Use t() for contract-specific strings, tCommon() for shared UI
```

**Date/number formatting:**

```tsx
const { i18n } = useTranslation();

// Locale-aware formatting
new Date(contract.end_date).toLocaleDateString(i18n.language)
amount.toLocaleString(i18n.language)
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
