# Login Page Split-Screen Design

**Date**: 2026-04-13
**Status**: Approved

## Problem Statement

1. **Logo disconnected from form**: The `AnimatedLogo` in `LoginPage.tsx` renders outside the form card, creating visual disconnect.
2. **Double layout wrappers**: Both `LoginPage` and `LoginForm` use `min-h-screen flex items-center justify-center`, causing responsive inconsistencies.
3. **Background mismatch**: LoginForm uses hardcoded `from-blue-50 via-white to-indigo-50` gradient that doesn't match the landing page's theme system (`bg-background`).
4. **Poor responsive behavior**: Layout doesn't adapt cleanly between desktop and mobile viewports.

## Solution

### Split-Screen Layout

**Desktop (lg+)**: 60/40 split - branding panel on the left, form centered on the right.
**Tablet (md-lg)**: 50/50 split.
**Mobile (<md)**: Single column with compact header containing small logo, form below.

### Component Changes

#### LoginPage.tsx (rewritten)

```tsx
<div className="relative min-h-screen flex">
  {/* Left branding panel - hidden on mobile */}
  <motion.div
    className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5 p-8"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5 }}
  >
    <AnimatedLogo size="xl" />
    <h1 className="mt-6 text-4xl font-bold tracking-tight">PACTA</h1>
    <p className="mt-2 text-lg text-muted-foreground text-center max-w-sm">
      Manage contracts with clarity
    </p>
    {/* Decorative geometric shapes */}
  </motion.div>

  {/* Right form panel */}
  <motion.div
    className="flex w-full md:w-1/2 lg:w-2/5 items-center justify-center bg-background p-6"
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay: 0.15 }}
  >
    <div className="w-full max-w-md">
      {/* Mobile logo - visible only on mobile */}
      <div className="mb-8 flex justify-center md:hidden">
        <AnimatedLogo size="md" />
      </div>
      <LoginForm />
    </div>
  </motion.div>
</div>
```

#### LoginForm.tsx (simplified)

- **Remove** the outer `min-h-screen flex items-center justify-center bg-gradient-to-br...` wrapper entirely.
- **Keep** only the `Card` component with form logic (login/register toggle, inputs, buttons).
- Becomes a pure card component that can be placed in any layout context.

### Theme Consistency

- Form panel uses `bg-background` (matches landing page theme system).
- Branding panel gradient uses `from-primary/5 via-background to-primary/10` - derived from CSS variables in `index.css`, adapts to dark mode automatically.
- No hardcoded blue/indigo colors - all colors come from the design token system.

### Animations

| Element | Animation |
|---------|-----------|
| Branding panel | Fade-in from left (`x: -20 -> 0`) |
| Form panel | Fade-in from right (`x: 20 -> 0`) with 0.15s delay |
| Logo | Existing spring scale-in + continuous float |
| Card | Inherits form panel animation |

### Accessibility

- `prefers-reduced-motion` already handled globally in `index.css`.
- Form maintains existing `required` attributes and proper `htmlFor`/`id` associations.
- Mobile logo uses same `AnimatedLogo` component with `animate` prop respected.

### File Changes

**Modified**:
- `pacta_appweb/src/pages/LoginPage.tsx` - Full rewrite with split-screen layout
- `pacta_appweb/src/components/auth/LoginForm.tsx` - Remove outer layout wrapper, keep card only

**Unchanged**:
- `AnimatedLogo.tsx`, `AuthContext.tsx`, UI components, i18n files
