# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.36.0] - 2026-04-17

### Added
- **Brevo SMTP primary with Gmail fallback** — Email service now uses Brevo as primary SMTP relay with automatic Gmail fallback for reliability
  - `sendWithBrevo()` — sends via `smtp-relay.brevo.com:587` with mandatory TLS, using `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
  - `sendWithGmail()` — fallback via `smtp.gmail.com:587` with mandatory TLS, using `GMAIL_USER`, `GMAIL_APP_PASSWORD`
  - `sendEmailWithFallback()` — orchestrator: tries Brevo first if configured; on any error (connection, auth, send, invalid recipient) automatically retries with Gmail; if Brevo unconfigured, uses Gmail directly
  - Clear logging indicating which provider is used and when fallback occurs
  - Both providers use `mail.TLSMandatory` on port 587 (STARTTLS)
  - Error returns only if both providers fail

### Changed
- **Email configuration documentation** — Renamed and rewrote `docs/RESEND-CONFIGURATION.md` → `docs/EMAIL-CONFIGURATION.md` to cover both Brevo and Gmail providers, including setup instructions for Linux systemd (3 options), Windows (3 options), and development `.env` usage

### Technical Details
- **Files Modified:** 2 (`internal/email/sendmail.go`, `docs/EMAIL-CONFIGURATION.md`)
- **Lines Added:** ~74 (code) + ~373 (docs)
- **Lines Removed:** ~175 (removed old `getMailClient()` and old RESEND doc)
- **No breaking changes** — function signatures (`SendVerificationCode`, `SendAdminNotification`) unchanged; `internal/email/templates.go` and `internal/handlers/auth.go` untouched
- **Environment variables:** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (Brevo); `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Gmail); `EMAIL_FROM` (sender, unchanged)
- **Backward compatible:** Existing single-provider setups continue working (Brevo or Gmail alone)

### Backend Integration
- `internal/email.SendVerificationCode(ctx, email, code, lang)` — unchanged API, now uses fallback orchestrator
- `internal/email.SendAdminNotification(ctx, adminEmail, userName, userEmail, companyName, lang)` — unchanged API, now uses fallback orchestrator

## [0.35.1] - 2026-04-16

### Fixed
- **Sidebar mobile drawer state** — Added missing `sidebarOpen` state declaration in AppSidebar component. This was causing runtime JavaScript errors that rendered the entire application unusable (blank pages on all routes)

### Technical Details
- **Root Cause:** The mobile drawer code in AppSidebar.tsx used `setSidebarOpen()` in multiple places but never declared the state with `useState()`
- **Files Modified:** 1 (`pacta_appweb/src/components/layout/AppSidebar.tsx`)

## [0.35.0] - 2026-04-16

### Fixed
- **Sidebar responsive behavior** — Fixed visual bug where sidebar would get stuck in the corner when page shrinks. The content margin now dynamically adapts to sidebar width when collapsed/expanded
- **Device detection synchronization** — AppLayout now properly detects tablet/desktop/mobile and coordinates with sidebar state

### Added
- **Logo icon in collapsed sidebar** — Replaced the "P" letter with the project logo SVG when sidebar is collapsed. The icon uses `currentColor` to automatically adapt to light/dark theme

### Technical Details
- **Files Modified:** 3 (`internal/config/config.go`, `pacta_appweb/src/components/layout/AppLayout.tsx`, `pacta_appweb/src/components/layout/AppSidebar.tsx`, `pacta_appweb/src/images/contract_icon.svg`)

## [0.34.1] - 2026-04-16

### Fixed
- **Migration goose markers** — Added missing `-- +goose Up` and `-- +goose Down` markers to `026_system_settings.sql` migration file

## [0.34.0] - 2026-04-16

### Fixed
- **SMTP configuration via environment variables** — SMTP settings were hardcoded to `localhost:25`. The system now reads `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` from environment variables, enabling proper email delivery in production environments

### Added
- **System Settings page** — New admin-only settings page (`/settings`) with tabbed interface for configuring:
  - **SMTP tab** — Configure email server (host, port, username, password, from address)
  - **Company tab** — Configure company information (name, address, tax ID)
  - **Registration tab** — Toggle registration enabled/disabled, default user role for new registrations
  - **General tab** — App version display, session timeout settings
- **System settings API endpoints** — `GET/PUT /api/system-settings` for persistent configuration storage
- **Modern floating sidebar** — Completely redesigned sidebar with:
  - Glassmorphism effect (backdrop blur, transparency)
  - Floating design (elevated with shadow, rounded corners)
  - Integrated scrollbar (no more separate scroll containers)
  - Responsive behavior: mobile drawer, tablet collapsed icon-only, desktop expanded
  - Smooth collapse/expand animations with tooltips on hover

### Technical Details
- **Files Created:** 7 (`internal/db/migrations/026_system_settings.sql`, `internal/handlers/system_settings.go`, `pacta_appweb/src/lib/settings-api.ts`, `pacta_appweb/src/pages/SettingsPage.tsx`, `pacta_appweb/public/locales/en/settings.json`, `pacta_appweb/public/locales/es/settings.json`, `docs/plans/2026-04-16-system-settings-design.md`)
- **Files Modified:** 8 (`internal/config/config.go`, `internal/email/sendmail.go`, `internal/server/server.go`, `pacta_appweb/package.json`, `pacta_appweb/src/App.tsx`, `pacta_appweb/src/components/layout/AppSidebar.tsx`, `pacta_appweb/src/components/layout/AppLayout.tsx`)

## [0.33.0] - 2026-04-15

### Changed
- **Migrated from Resend API to go-mail** — Replaced `github.com/resend/resend-go/v3` with `github.com/wneessen/go-mail` for direct SMTP email delivery. No longer requires external API key or internet connection for email sending
- **Removed Resend API key dependency** — `RESEND_API_KEY` environment variable no longer required. Emails sent via local SMTP (localhost:25, opportunistic TLS)

### Added
- **i18n email templates** — Verification and admin notification emails now support Spanish (`es`) and English (`en`) based on user's detected language
- **Language detection for emails** — Language detected from registration request body (`language` field), falling back to `Accept-Language` header, defaulting to `"en"`
- **Email error logging** — SMTP send failures now logged with full error details and surfaced to user with clear error message instead of silent failure
- **Spam folder warnings** — Registration toast and verification page now remind users to check their spam folder for verification codes

### Removed
- **`internal/email/resend.go`** — Resend SDK integration removed
- **`ResendAPIKey` from config** — Config struct no longer includes Resend API key field
- **`email.Init()` from server startup** — go-mail requires no initialization

### Technical Details
- **Files Created:** 2 (`internal/email/sendmail.go`, `internal/email/templates.go`)
- **Files Deleted:** 1 (`internal/email/resend.go`)
- **Files Modified:** 10 (`go.mod`, `go.sum`, `internal/config/config.go`, `internal/server/server.go`, `internal/handlers/auth.go`, `internal/handlers/registration.go`, `pacta_appweb/src/lib/registration-api.ts`, `pacta_appweb/src/components/auth/LoginForm.tsx`, `pacta_appweb/src/pages/VerifyEmailPage.tsx`, `pacta_appweb/public/locales/es/login.json`, `pacta_appweb/public/locales/en/login.json`)

## [0.32.0] - 2026-04-15

### Fixed
- **Registration returns 500 error with English alert** — Added detailed error logging to `HandleRegister` to capture root cause of registration failures. Error messages now logged to journalctl for debugging.

### Changed
- **Error logging in auth handler** — All 500 error paths in `HandleRegister` now log the underlying error with `log.Printf` for production debugging

## [0.31.0] - 2026-04-15

### Added
- **Sonner Toaster provider** — Toast notifications now render correctly across the entire app
- **Public companies endpoint** — `GET /api/public/companies` for unauthenticated registration form
- **Role selection in admin approval** — Admins can now set user role (Viewer/Editor/Manager/Admin) when approving registrations
- **Company tooltip** — Guidance tooltip on registration form company selector with i18n support
- **Loading state on forms** — `isSubmitting` state prevents double-submit on login/register/verify
- **i18n keys for registration** — Company label, tip, placeholder, new company option, and toast messages (en/es)

### Fixed
- **Login error messages display raw JSON** — `AuthContext.tsx` used `res.text()` instead of `res.json()`, causing error messages to render as raw JSON strings
- **All toast notifications silently dropped** — Sonner `<Toaster />` component was missing from `main.tsx`
- **Registration company selector empty** — Form fetched `/api/companies` (requires auth); now uses public endpoint
- **First user stuck on login page after registration** — Backend auto-logins first user but frontend didn't navigate to dashboard
- **Approval toast message unclear** — Improved to "Registration submitted! Your account is waiting for admin approval. You will be notified once approved."

### Changed
- **Registration passes `company_id`** — When user selects existing company, the ID is sent to backend for approval workflow
- **Approval handler updates user role** — `approveOrReject` now accepts `role` parameter and updates user's role on approval
- **PendingUsersTable role column** — Added role selector dropdown (Viewer/Editor/Manager/Admin) to approval workflow

### Technical Details
- **Files Created:** 1 (`internal/db/migrations/024_add_role_pending_approvals.sql`)
- **Files Modified:** 11 (`internal/server/server.go`, `internal/handlers/companies.go`, `internal/handlers/auth.go`, `internal/handlers/approvals.go`, `pacta_appweb/src/main.tsx`, `pacta_appweb/src/contexts/AuthContext.tsx`, `pacta_appweb/src/components/auth/LoginForm.tsx`, `pacta_appweb/src/components/admin/PendingUsersTable.tsx`, `pacta_appweb/src/lib/registration-api.ts`, `pacta_appweb/public/locales/en/login.json`, `pacta_appweb/public/locales/es/login.json`)

## [0.30.0] - 2026-04-14
- **Resend email integration** — `github.com/resend/resend-go/v3` SDK with configurable `RESEND_API_KEY` and `EMAIL_FROM` environment variables
- **Email verification flow** — 6-digit verification code sent via email, 5-minute expiration window, auto-redirect to support contact page on expiry
- **Admin approval workflow** — Users can register with company name; admins receive email + in-app notification to approve/reject with company assignment
- **Pending approvals UI** — New "Pending Approvals" tab in Users page with approve/reject actions, company selector dropdown, and optional notes
- **User company assignment** — Admins can now assign or change a user's company from the Users edit form
- **Role constants** — Named constants (`RoleViewer`, `RoleEditor`, `RoleManager`, `RoleAdmin`) replacing magic numbers in route definitions
- **Company selection in registration** — Dropdown with existing companies + "Other" option for new company name

### Fixed
- **Login fails after registration** — Newly registered users without company assignment now get clear error message; registration auto-assigns to first company
- **Pending status checks in login** — `pending_email` and `pending_approval` users receive specific guidance instead of generic "account inactive" error
- **SPA 404 on back button and F5** — Custom `spaHandler` serves `index.html` for non-file routes, enabling React Router to handle client-side navigation
- **Race condition in email client** — `sync.Once` protection for Resend client initialization
- **Silent email failures** — Logging warnings when email service is disabled or code not sent
- **Go version in go.mod** — Corrected from `go 1.25.0` (non-existent) to `go 1.23`
- **spaHandler compilation error** — `fs.File` doesn't implement `io.ReadSeeker`; fixed by reading into bytes and using `bytes.NewReader` (v0.29.1)
- **Verify Email double-submit** — Added `type="button"` to prevent form submission race condition
- **Registration company field** — Now always visible with dropdown of existing companies + "Other" for new company
- **Users page edit form** — Added company selector dropdown; assigns company on submit

### Changed
- **Registration form** — Now includes registration method radio selector (email verification vs admin approval) and conditional company name field
- **HandleRegister logic** — First user gets admin/active; subsequent users get viewer + mode-based status (`pending_email` or `pending_approval`)
- **Database schema** — New `registration_codes` and `pending_approvals` tables (migration 023)

### Technical Details
- **Files Created:** 9 (`internal/email/resend.go`, `internal/auth/roles.go`, `internal/handlers/registration.go`, `internal/handlers/approvals.go`, `internal/db/migrations/023_registration.sql`, `pacta_appweb/src/lib/registration-api.ts`, `pacta_appweb/src/pages/VerifyEmailPage.tsx`, `pacta_appweb/src/pages/RegistrationExpiredPage.tsx`, `pacta_appweb/src/components/admin/PendingUsersTable.tsx`)
- **Files Modified:** 13 (`go.mod`, `go.sum`, `internal/config/config.go`, `internal/server/server.go`, `internal/handlers/auth.go`, `pacta_appweb/.env.example`, `pacta_appweb/src/components/auth/LoginForm.tsx`, `pacta_appweb/src/pages/UsersPage.tsx`, `pacta_appweb/src/pages/UsersPage.tsx`, `pacta_appweb/src/App.tsx`, `pacta_appweb/src/lib/users-api.ts`)

## [0.28.0] - 2026-04-13

### Added
- **User registration endpoint** — `POST /api/auth/register` now allows new users to create accounts directly from the login page
- **Auto-login after registration** — Successful registration automatically creates a session and logs the user in
- **First-user admin role** — The first registered user receives admin role; subsequent users receive viewer role
- **Registration validation** — Validates name (required), email (required, unique), password (min 8 characters)
- **Error message propagation** — AuthContext now returns actual server error messages instead of swallowing them

### Fixed
- **Registration flow 404** — Frontend was calling `/api/auth/register` but backend had no handler. Now fully functional
- **Silent login failures** — Login errors now display actual server messages (e.g., "user not found", "invalid password") via toast notifications
- **Silent registration failures** — Registration errors (duplicate email, weak password) now show specific error messages via toast

### Changed
- **AuthContext return type** — `login()` and `register()` now return `{ user: User | null; error?: string }` instead of `User | null`
- **LoginForm error handling** — Now displays actual server error messages instead of generic fallback text

### Technical Details
- **Files Created:** 0
- **Files Modified:** 4 (`internal/handlers/auth.go`, `internal/server/server.go`, `pacta_appweb/src/contexts/AuthContext.tsx`, `pacta_appweb/src/components/auth/LoginForm.tsx`)
- **Lines Added:** ~136 (backend handler + route + frontend error handling)

## [0.27.0] - 2026-04-13

### Added
- **About section** — Landing page now includes an About section with PACTA's mission statement and three core values (Local-First, Open Source, Simplicity) displayed as animated cards with icon badges
- **FAQ section** — Accordion-based FAQ with 6 common questions covering what PACTA is, internet requirements, data storage, pricing, installation, and target audience
- **Contact section** — Centered contact card with email (pactateam @gmail.com) and GitHub repository links, gradient border with hover effects
- **Landing footer** — Three-column footer with logo/tagline, navigation links (Download, Changelog, GitHub), and contact email with copyright
- **Download page** (`/download`) — Dedicated page with platform cards (Linux, macOS, Windows) showing latest version from GitHub Releases API, direct download links to release assets, and collapsible installation instructions
- **Changelog page** (`/changelog`) — Blog-style timeline of all GitHub releases with version badges, dates, parsed markdown release notes, team commentary extraction, and links to full GitHub releases
- **GitHub API wrapper** — `github-api.ts` module with `fetchLatestRelease()`, `fetchAllReleases()`, localStorage caching (5-min TTL), 3-retry exponential backoff, and team commentary extraction helpers
- **Professional SEO** — JSON-LD `SoftwareApplication` structured data, Open Graph meta tags, Twitter Card meta tags, canonical URL, keywords meta tag, changed `robots` from `noindex, nofollow` to `index, follow`
- **Favicon & PWA manifest** — Contract icon as SVG favicon, `site.webmanifest` for PWA support, multiple favicon format references
- **Dynamic page titles** — `page-title.ts` utility that updates `document.title` per route for SEO
- **Navbar anchor links** — About and FAQ anchor links added to landing navbar (desktop + mobile)
- **Full i18n support** — English and Spanish translations for all new sections (download, changelog, about, faq, contact, footer)

### Changed
- **Landing page composition** — HomePage now includes: LandingNavbar, HeroSection, FeaturesSection, AboutSection, FaqSection, ContactSection, LandingFooter
- **App routes** — Added `/download` and `/changelog` as public routes in App.tsx
- **index.html** — Complete SEO overhaul with enhanced meta tags, structured data, and favicon configuration

### Technical Details
- **Files Created:** 15 (4 landing components, 2 pages, 2 lib modules, 4 locale files, 1 test file, favicon.svg, site.webmanifest)
- **Files Modified:** 8 (App.tsx, HomePage.tsx, LandingNavbar.tsx, index.html, 4 locale files)
- **Tests:** 5 new tests for GitHub API wrapper (caching, retry, error handling)
- **TypeScript:** 0 errors, clean build
- **Design doc:** `docs/plans/2026-04-13-landing-page-enhancement-design.md`
- **Implementation plan:** `docs/plans/2026-04-13-landing-page-enhancement-plan.md`

## [0.26.0] - 2026-04-13

### Added
- **Collapsible sidebar** — Desktop sidebar now collapses to icon-only mode (72px) with smooth 300ms animation, tooltip labels on hover, and gradient active state indicators
- **Purple-accented color palette** — Professional design system with purple primary (`oklch(0.54 0.22 290)` light / `oklch(0.72 0.19 290)` dark) and orange accent for CTAs, both themes fully accessible
- **Gradient button variants** — New `gradient` variant (primary-to-accent gradient) for CTAs and `soft` variant (primary/10 bg) for secondary actions
- **Glassmorphism dashboard cards** — Stat cards with gradient icon backgrounds, hover effects, and layered depth; expiring contracts alert with gradient backdrop
- **Soft badge variant** — New `soft` variant with primary/10 background and primary/20 border

### Changed
- **Color system** — Full OKLCH palette rewrite for both light/dark modes with warm backgrounds, vibrant chart colors, and purple sidebar tint
- **Button component** — Modernized border radius (`rounded-lg`), consistent focus ring, shadow variants
- **Card component** — Hover shadow transitions (`hover:shadow-md`), consistent `rounded-xl`
- **Input component** — `rounded-lg`, `shadow-sm`, purple focus ring (`ring-primary/20`)
- **AppSidebar** — Gradient left-border active nav items, modern user profile section with avatar, collapse toggle
- **AppLayout** — CompanySelector moved from sidebar to header for better collapsed sidebar UX
- **DashboardPage** — Redesigned KPI cards with gradient icon backgrounds, improved expiring contracts list, soft button quick actions
- **Landing page** — HeroSection gradient CTA button, FeaturesSection gradient icon backgrounds and backdrop-blur cards

### Technical Details
- **Files Modified:** 10 (`index.css`, `button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `AppSidebar.tsx`, `AppLayout.tsx`, `DashboardPage.tsx`, `HeroSection.tsx`, `FeaturesSection.tsx`)
- **Design doc:** `docs/plans/2026-04-13-frontend-modernization-plan.md`
- **TypeScript:** 0 errors, clean build

## [0.25.2] - 2026-04-13

### Fixed
- **Light/dark/system theme not working** — ThemeProvider was missing `attribute="class"` prop required by next-themes v0.4+ to toggle the `.dark` CSS class on the `<html>` element. Tailwind's `@custom-variant dark (&:is(.dark *))` now correctly applies dark mode styles
- **ThemeToggle hydration mismatch** — Added mounted state guard to prevent SSR/client hydration warnings. Active theme now highlighted in dropdown menu
- **Theme icon not reflecting state** — Sun/Moon icons now use JavaScript state (`resolvedTheme`) instead of relying on CSS `dark:` classes that conflicted with the toggle's own styling

### Technical Details
- **Files Changed:** 3 (`ThemeProvider.tsx`, `ThemeToggle.tsx`, `main.tsx`)
- **Root Cause:** `next-themes` v0.4+ requires explicit `attribute="class"` configuration. Without it, the library defaulted to toggling a `data-theme` attribute instead of the `class` attribute, so Tailwind's `.dark` selector never matched
- **System theme support** — `enableSystem` prop enables automatic detection of OS-level `prefers-color-scheme` setting

## [0.25.1] - 2026-04-13

### Fixed
- **Supplements page crash** — Added missing `deleted_at` column to `supplements` table via migration `022_supplements_deleted_at.sql`. The backend handler queried `WHERE deleted_at IS NULL` but the column was never created, causing `Error loading supplements: failed to list supplements` on page load

### Technical Details
- **Files Created:** 1 (`internal/db/migrations/022_supplements_deleted_at.sql`)
- **Root Cause:** Migration `006_supplements.sql` created the table without `deleted_at`, while all other soft-delete-enabled tables (contracts, clients, suppliers, etc.) included it from the start

## [0.25.0] - 2026-04-13

### Added
- **Split-screen login layout** — Responsive two-panel layout with branding panel (logo + tagline) on desktop, single-column stacked layout on mobile
- **Theme-aware branding gradient** — Login page branding panel uses CSS variable-based gradient (`from-primary/5 via-background to-primary/10`) that adapts to light/dark mode
- **Framer Motion entrance animations** — Staggered fade-in animations for both branding and form panels with proper `prefers-reduced-motion` support

### Changed
- **LoginForm.tsx** — Removed outer `min-h-screen` layout wrapper with hardcoded blue/indigo gradient. Now renders as a pure Card component without layout concerns
- **LoginPage.tsx** — Full rewrite with split-screen responsive layout:
  - Desktop (>1024px): 60/40 split with branding panel on left, form on right
  - Tablet (768px-1024px): 50/50 split
  - Mobile (<768px): Single column with compact logo header above form
- **Logo integration** — PACTA logo now visually connected to form (inside card on mobile, in branding panel on desktop), no longer floating disconnected above

### Technical Details
- **Files Modified:** 2 (`LoginForm.tsx`, `LoginPage.tsx`)
- **Lines Changed:** +136 / -110
- **Design doc:** `docs/plans/2026-04-13-login-page-split-design.md`
- **Implementation plan:** `docs/plans/2026-04-13-login-page-split-implementation.md`

## [0.24.0] - 2026-04-13

### Added
- **Automatic language detection** — Browser locale detection via `i18next-browser-languagedetector`; Spanish browsers (`es-*`) auto-display in Spanish, all others default to English
- **Language toggle UI** — `LanguageToggle` component (dropdown with Languages icon) integrated in AppLayout header and LandingNavbar; manual override persists to localStorage
- **Full Spanish translations** — 16 namespace JSON files with ~446 translation keys covering all UI text: common, landing, login, setup, contracts, clients, suppliers, supplements, reports, settings, documents, notifications, signers, companies, pending, dashboard
- **Full English translations** — Matching 16 namespace JSON files with English equivalents for all Spanish keys
- **Dynamic HTML lang attribute** — `<html lang>` synced via `useEffect` in App.tsx for accessibility and SEO
- **Locale-aware date/number formatting** — `toLocaleDateString()` and `toLocaleString()` calls updated to pass `i18n.language` for locale-specific formatting
- **i18n unit tests** — Test suite for i18n configuration, translation loading, language switching, and namespace verification

### Changed
- **32+ components translated** — All page and form components wrapped with `useTranslation()` hooks: landing, auth, setup, layout, contracts, clients, suppliers, supplements, reports, settings, documents, notifications, signers, companies, pending, dashboard
- **Multi-namespace support** — Components using shared strings import both primary namespace and `common` via `useTranslation('primary')` + `useTranslation('common')`
- **PROJECT_SUMMARY updated** — Added v0.24.0 section, i18n usage guide for end users and developers, roadmap updated

### Technical Details
- **Stack:** i18next v26.0.4, react-i18next v17.0.2, i18next-browser-languagedetector v8.2.1
- **Detection chain:** localStorage cache → `navigator.language` → fallback `en`
- **Storage key:** `pacta-language` for user preference persistence
- **Zero breaking changes** — All existing functionality preserved; English remains default

## [0.23.0] - 2026-04-12

### Added
- **Audit Logs API module** — New `audit-api.ts` frontend module with `list()`, `listByContract()`, and `listByEntityType()` methods calling existing `GET /api/audit-logs` backend endpoint
- **Notification Settings API** — Backend `GET/PUT /api/notification-settings` endpoints with SQLite table, upsert logic, and default fallback; frontend `notification-settings-api.ts` module
- **Notification creation via API** — `notificationsAPI.create()` method for generating expiration alerts through the backend instead of localStorage
- **Comprehensive test coverage** — 5 new test files (audit-api, notification-settings-api) with 5 new tests; total test suite: 41 tests across 7 files

### Changed
- **Complete localStorage elimination** — All remaining localStorage dependencies migrated to backend API:
  - **Audit logs** — `audit.ts` now reads from `GET /api/audit-logs`; `addAuditLog()` removed (backend auto-logs all CRUD operations)
  - **Notifications** — `generateNotifications()` now POSTs to API instead of writing localStorage; `markNotificationAsRead`/`markNotificationAsAcknowledged` call PATCH API
  - **Notification settings** — `getNotificationSettings`/`setNotificationSettings` replaced with `notificationSettingsAPI.get()`/`update()`
  - **GlobalClientEffects** — Async notification generation via API
  - **ContractDetailsPage** — Audit logs loaded from API with proper error handling
  - **AuthorizedSignerForm** — Client/supplier dropdowns populated from API
- **TypeScript error resolution** — All 24 remaining TypeScript errors fixed:
  - **motion-dom variants** (11 errors) — Proper `Variants` type annotations with `as const` literals in `ForbiddenPage.tsx` and `NotFoundPage.tsx`
  - **number/string mismatches** (7 errors) — `getContractInfo()` accepts `number | string`; `contractId` vs `contract_id` fixed in report components; Map type updated to `number | string`
  - **unknown type casts** (2 errors) — Explicit `as any[]` casts on `contractsAPI.list()` results in `DocumentsPage.tsx` and `SupplementsPage.tsx`
  - **Event target** (1 error) — `e.target as HTMLFormElement` in `SupplementForm.tsx`
  - **Disabled prop** (2 errors) — Ternary expression instead of `&&` short-circuit in `UsersPage.tsx`
- **storage.ts cleanup** — Removed 6 unused functions (`getNotifications`, `setNotifications`, `getAuditLogs`, `setAuditLogs`, `getNotificationSettings`, `setNotificationSettings`) and 3 STORAGE_KEYS entries
- **AuditLog type** — Updated to match backend format (snake_case: `user_id`, `entity_type`, `entity_id`, `created_at`)

### Technical Details
- **Files Modified:** 22 (8 backend, 14 frontend)
- **New Files:** 6 (2 API modules, 2 test files, 1 migration, 1 handler)
- **Tests:** 41 passing (7 test files)
- **TypeScript:** 0 errors (clean `tsc --noEmit` build)
- **localStorage:** 0 remaining dependencies for audit, notifications, settings

---

## [0.22.0] - 2026-04-12

### Added
- **Setup mode auto-advance** — Clicking a company mode card in the setup wizard now automatically advances to the next step, fixing the missing "Next" button on step 1
- **Mode toggle button** — "Cambiar a..." ghost button for quick mode switching without re-clicking cards
- **Tactile card feedback** — Hover/active scale transforms (`hover:scale-[1.02] active:scale-[0.98]`) and shadow emphasis on selected mode card
- **Keyboard accessibility** — Focus-visible ring styles on mode selection cards

### Changed
- **SetupModeSelector** — `onSelect` callback prop (optional) fires on card click, enabling auto-advance
- **SetupWizard** — Wired `onSelect={next}` to mode selector for seamless flow
- **Language consistency** — Ghost button text localized to Spanish ("Cambiar a Multiempresa" / "Cambiar a Empresa Individual")

### Technical Details
- **Files Modified:** 2 (`SetupModeSelector.tsx`, `SetupWizard.tsx`)
- **Lines Added:** ~15
- **Design doc:** `docs/plans/2026-04-12-setup-mode-auto-advance-design.md`

---

## [0.21.0] - 2026-04-12

### Added
- **ForbiddenPage (403)** — Access denied page for users attempting to reach `/setup` after configuration is complete
- **Setup route guard** — SetupPage checks `/api/setup/status` and redirects to `/403` if setup already completed

### Fixed
- **HomePage setup redirect bug** — Fixed reading `data.firstRun` (always undefined) to `data.needs_setup` (correct API field), enabling fresh installs to redirect to `/setup`
- **AuthContext no longer redirects to /setup on 401** — Only redirects on network errors, not on authentication failures

### Technical Details
- **Files Created:** 1 (`ForbiddenPage.tsx`)
- **Files Modified:** 3 (`HomePage.tsx`, `SetupPage.tsx`, `App.tsx`)
- **Lines Added:** ~60

---

## [0.20.4] - 2026-04-12

### Fixed
- **Missing migration 016** — Added `company_id` columns for documents, notifications, audit_logs that were lost during goose migration conversion
- **Migration ordering** — Backfill (020) now runs after all ALTER TABLE migrations

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
