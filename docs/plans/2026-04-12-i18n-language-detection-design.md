# Design: Automatic Language Detection (i18n)

**Date:** 2026-04-12
**Status:** Approved
**Author:** Qwen Code (brainstorming session)

## Problem

PACTA currently has all UI text hardcoded in Spanish. This limits professionalism, accessibility, and SEO quality. The app needs automatic language detection with support for Spanish and English, defaulting to English unless the user's browser is configured in Spanish.

## Decision

Use **react-i18next** with **i18next-browser-languagedetector** for automatic locale detection and full-app internationalization.

## Architecture

### Technology Stack

| Component | Package |
|-----------|---------|
| Core i18n | `i18next` ^24.x |
| React bindings | `react-i18next` ^15.x |
| Language detection | `i18next-browser-languagedetector` ^8.x |
| Translation extraction CLI | `i18next-parser` ^9.x |

### Detection Priority Chain

1. **User override** — localStorage cached preference from manual language toggle
2. **Browser language** — `navigator.language` on first visit
3. **Fallback** — `en` (English is the default)

Detection logic: if `navigator.language` starts with `es` (handles `es-ES`, `es-MX`, `es-AR`, etc.), set language to `es`. Everything else falls back to `en`.

### Translation File Structure

Namespaced JSON files organized by domain:

```
public/locales/
├── en/
│   ├── common.json        # Shared UI: buttons, labels, nav, dialogs, errors
│   ├── landing.json       # Hero, features, CTA sections
│   ├── login.json         # Login form, validation messages
│   ├── setup.json         # Setup wizard steps and messages
│   ├── contracts.json     # Contract CRUD, forms, status labels
│   ├── clients.json       # Client management
│   ├── suppliers.json     # Supplier management
│   ├── dashboard.json     # Dashboard widgets, stats
│   ├── reports.json       # Report filters, export labels
│   └── settings.json      # Settings, theme, language toggle labels
└── es/
    └── (same structure, Spanish translations)
```

Spanish strings are extracted from the current codebase (which is fully in Spanish). English translations are created from scratch.

### Component Integration

**New files:**

- `pacta_appweb/src/i18n/index.ts` — Central i18next configuration
- `pacta_appweb/src/components/LanguageToggle.tsx` — Compact `[EN]` / `[ES]` toggle button
- `pacta_appweb/public/locales/{lng}/{ns}.json` — Translation files

**Modified files:**

- `pacta_appweb/src/main.tsx` — Import `./i18n`, wrap `<App>` in `<Suspense>`
- `pacta_appweb/src/components/layout/AppLayout.tsx` — Add `<LanguageToggle>` to top bar
- `pacta_appweb/src/components/landing/LandingNavbar.tsx` — Add `<LanguageToggle>` to navbar
- `pacta_appweb/index.html` — Dynamic `lang` attribute via React effect
- ~60-70 component files — Wrap user-facing text with `useTranslation()` hook

### Component Translation Pattern

```tsx
// Before
function LoginPage() {
  return <h1>Iniciar Sesión</h1>;
}

// After
import { useTranslation } from 'react-i18next';

function LoginPage() {
  const { t } = useTranslation('login');
  return <h1>{t('title')}</h1>;
}
```

### Date/Number Localization

All existing `toLocaleDateString()` and `toLocaleString()` calls without locale argument will be updated to pass `i18n.language`:

```tsx
// Before
new Date(contract.end_date).toLocaleDateString()

// After
new Date(contract.end_date).toLocaleDateString(i18n.language)
```

### State Flow

```
User visits site
  → i18next-browser-languagedetector runs
    → Checks localStorage for cached preference
    → If not found, reads navigator.language
    → If starts with 'es' → sets lng to 'es'
    → Otherwise → falls back to 'en'
  → i18n.language is set
  → All useTranslation() hooks react
  → Components render in detected language
  → <html lang> attribute updated via effect
  → User clicks LanguageToggle → i18n.changeLanguage('es' | 'en')
  → localStorage updated → all components re-render
```

### Language Toggle UI

Compact button showing current language code: `[EN]` or `[ES]`. Placed in:
- `AppLayout` top bar (next to `ThemeToggle`)
- `LandingNavbar` (next to theme toggle)

Clicking cycles: `en` → `es` → `en`.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing translation key | Returns key name in prod, logs warning in dev |
| Translation file load failure | Suspense fallback shows spinner; falls back to `en` |
| Corrupt localStorage | Falls back to `navigator.language` → `en` |
| Unsupported browser language | Falls back to `en` |

### SEO Considerations

- Dynamic `<html lang="es">` or `<html lang="en">` set via React effect hook
- `hreflang` meta tags on landing page for future multi-URL support
- Initial HTML is always English (static export); language switch is client-side via React
- Acceptable for PACTA as a local-first app; `lang` attribute helps accessibility scanners

### Testing Strategy

| Test Type | Scope |
|-----------|-------|
| Unit | `i18n/index.ts` initialization, detection order, fallback behavior |
| Component | Render `LoginPage`, `HeroSection`, `AppSidebar` in both languages |
| Integration | Simulate `navigator.language = 'es-MX'`, verify Spanish on first load |
| Toggle | Click language toggle, verify localStorage + re-render |

### Migration Strategy

1. **Install dependencies** — `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `i18next-parser`
2. **Create i18n config** — `src/i18n/index.ts` with detection setup
3. **Create translation files** — Start with `common.json` (shared strings), then domain-by-domain
4. **Extract Spanish strings** — Use `i18next-parser` to auto-extract `t('key')` calls
5. **Translate to English** — Create English equivalents
6. **Wrap components** — Apply `useTranslation()` hook to all components with user-facing text
7. **Add LanguageToggle** — Integrate into `AppLayout` and `LandingNavbar`
8. **Update date/number formatting** — Pass `i18n.language` to `toLocale*` methods
9. **Test** — Verify detection, toggle, and both language renders
10. **Update CHANGELOG** — Document new feature

### Estimated Scope

- ~2000-3000 translation keys
- ~10 namespace files per language
- ~60-70 component files modified
- 2 new components (`LanguageToggle`, `i18n/index.ts`)
- 4 new dependencies
