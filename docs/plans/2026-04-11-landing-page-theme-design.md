# PACTA Landing Page & Theme Fix Design

**Date**: 2026-04-11
**Status**: Approved

## Problem Statement

1. **Theme toggle broken since v0.2.0**: `ThemeProvider` from `next-themes` is never mounted in `main.tsx`, causing `useTheme()` in `ThemeToggle` to fail silently.
2. **No landing page**: `HomePage` renders `LoginForm` directly with no branding or product showcase.
3. **No project branding**: Login page has no PACTA logo.

## Solution

### 1. Theme System Fix

**Root cause**: `main.tsx` renders `<App />` without `ThemeProvider` wrapper.

**Fix**:
```tsx
// main.tsx
import { ThemeProvider } from './components/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="pacta-theme">
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
```

No changes to `ThemeToggle.tsx` or `ThemeProvider.tsx` -- both are correct.

### 2. Landing Page (HomePage)

Replace `HomePage` with a full landing page with Framer Motion animations.

**Components**:
- `LandingNavbar` -- Logo + nav links + Login button (navigates to `/login`)
- `HeroSection` -- Animated PACTA logo, headline, CTA "Start Now" button
- `FeaturesSection` -- 3 feature cards with staggered scroll animations

**Hero**:
- PACTA SVG logo with scale-in + floating animation
- Headline: "Manage Contracts with Clarity"
- Subheadline: "Track, approve, and monitor every contract in one place"
- CTA: "Start Now" -> `/login`
- Background: radial gradient with subtle animated geometric shapes
- Theme-aware colors (light/dark)

**Features** (3 cards):
1. Contract Management -- FileText icon
2. Expiration Alerts -- Bell icon
3. Reports & Analytics -- BarChart icon

**Animations** (Framer Motion):
- Hero: staggered fade-up with blur reveal
- Logo: spring scale-in + continuous float
- Features: staggered slide-up on `whileInView`
- Cards: `whileHover={{ y: -8 }}` with spring physics

### 3. Login Page Enhancement

- Add PACTA SVG logo above the form with scale-in + fade animation
- Card entrance: slide-up with 0.2s delay
- Keep existing login/register logic unchanged

### 4. Dependencies

```bash
npm install framer-motion
```

### 5. File Structure

**New files**:
```
pacta_appweb/src/
├── components/
│   ├── landing/
│   │   ├── LandingNavbar.tsx
│   │   ├── HeroSection.tsx
│   │   └── FeaturesSection.tsx
│   └── AnimatedLogo.tsx
```

**Modified files**:
```
pacta_appweb/src/main.tsx          (add ThemeProvider wrapper)
pacta_appweb/src/pages/HomePage.tsx (full landing page)
pacta_appweb/src/pages/LoginPage.tsx (add logo + animations)
```

**Unchanged**: `LoginForm.tsx`, `ThemeToggle.tsx`, `ThemeProvider.tsx`, `index.css`

### 6. Edge Cases

- Framer Motion must be installed before build
- SVG logo uses responsive Tailwind sizing
- Theme preference persisted in localStorage via `pacta-theme` key
- `prefers-reduced-motion` already handled in `index.css`
- Existing lazy-loaded pages remain unchanged
