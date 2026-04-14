# PACTA Landing Page Enhancement Design

**Date**: 2026-04-13
**Status**: Approved

## Overview

Enhance the PACTA landing page with About, FAQ, Contact sections and a Footer. Add dedicated Download and Changelog pages. Implement professional SEO optimization and browser favicon.

## Approach

**Approach A (Component-Driven)**: New sections added to existing landing page, dedicated pages for Download and Changelog, Footer with navigation links.

---

## 1. Landing Page Sections

### 1.1 About Section
- **Position**: Below existing hero/features, before Contact
- **Layout**: Two-column desktop (text left, illustration right), stacked mobile
- **Animation**: Framer Motion scroll-triggered entrance
- **Background**: Subtle purple gradient tint
- **Content**: Product story, mission, value propositions
- **i18n**: `landing` namespace (EN/ES)

### 1.2 FAQ Section
- **Position**: Below About, before Contact
- **Layout**: Accordion using shadcn `Accordion` component
- **Content**: 6-8 questions (What is PACTA? Who is it for? Internet required? Data storage? Pricing? Installation?)
- **Animation**: Smooth expand/collapse, purple accent on expanded items
- **i18n**: `landing` namespace (EN/ES)

### 1.3 Contact Section
- **Position**: Last section before Footer
- **Layout**: Centered card with email + GitHub icons
- **Content**: Email (pactateam @gmail.com), GitHub repo link
- **Style**: Gradient border card, hover lift, Framer Motion entrance
- **i18n**: `landing` namespace (EN/ES)

### 1.4 Footer
- **Layout**: 3-column desktop, stacked mobile
  - Left: PACTA logo + tagline
  - Center: Links to Download, Changelog, GitHub repo
  - Right: Contact email, copyright
- **Style**: Dark background (`bg-card`), subtle top border
- **i18n**: `common` namespace

---

## 2. Dedicated Pages

### 2.1 Download Page (`/download`)
- **Route**: Public, no auth
- **Content**: Platform cards (Linux, macOS, Windows) with:
  - Platform icon + name
  - Latest version badge (from GitHub Releases API)
  - Direct download link to release asset
  - Collapsible installation instructions
- **Data source**: `GET /repos/mowgliph/pacta/releases/latest`
- **Fallback**: Link to `github.com/mowgliph/pacta/releases`
- **Style**: Dark cards, gradient border, hover lift
- **i18n**: `download` namespace (EN/ES)

### 2.2 Changelog Page (`/changelog`)
- **Route**: Public, no auth
- **Layout**: Blog-style timeline, newest first
- **Content per release**:
  - Version badge, release date, title
  - Release notes (parsed from GitHub release body markdown)
  - Team commentary (extracted from `<!-- team-comment -->` blocks in release body)
  - Link to full GitHub release
- **Data source**: `GET /repos/mowgliph/pacta/releases` (paginated)
- **Style**: Vertical timeline, purple accent cards, Framer Motion stagger
- **Loading**: Skeleton cards while fetching
- **i18n**: `changelog` namespace (EN/ES)

---

## 3. SEO & Technical

### 3.1 SEO
- Remove `noindex, nofollow` from `index.html`
- Add canonical URL, Twitter Card meta tags, `keywords` meta
- JSON-LD: `SoftwareApplication` schema + `Organization` schema
- Unique page titles per route
- Semantic HTML (`<header>`, `<main>`, `<footer>`, `<section>`, `<article>`)

### 3.2 Favicon
- Replace `/favicon.svg` with proper PACTA icon
- Generate `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`
- Add `site.webmanifest` for PWA support

### 3.3 Architecture
- **New routes**: `/download`, `/changelog` in `App.tsx` (public)
- **New components**:
  - `src/components/landing/AboutSection.tsx`
  - `src/components/landing/FaqSection.tsx`
  - `src/components/landing/ContactSection.tsx`
  - `src/components/landing/LandingFooter.tsx`
  - `src/pages/DownloadPage.tsx`
  - `src/pages/ChangelogPage.tsx`
- **New API layer**: `src/lib/github-api.ts` (GitHub Releases API wrapper, localStorage cache, 5-min TTL)
- **New i18n**: `download.json`, `changelog.json` (EN + ES)
- **Error handling**: Retry logic (3 attempts, exponential backoff), graceful fallback

### 3.4 Design System
- Colors: OKLCH purple primary, orange accent (existing tokens)
- Components: shadcn/ui primitives, Lucide icons, Framer Motion
- Responsive: Mobile-first, Tailwind breakpoints
- Accessibility: ARIA landmarks, keyboard navigation, prefers-reduced-motion
