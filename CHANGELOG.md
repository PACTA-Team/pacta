# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
