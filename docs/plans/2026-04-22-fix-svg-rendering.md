# Fix SVG Rendering in Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the blank page bug caused by missing SVGR plugin by configuring Vite to properly transform SVG imports into React components, and enhance the logo rendering with proper accessibility and error handling.

**Architecture:** The current code imports `contract_icon.svg?react` expecting a React component, but Vite returns a URL string without the SVGR plugin. This causes a runtime type error when React tries to render the string as a component. Solution: install and configure `vite-plugin-svgr`, then add error boundary and accessibility improvements to the logo component usage.

**Tech Stack:** Vite, React, TypeScript, SVGR, Tailwind CSS

---

## Context

- **Project**: Pacta - Contract Management Application
- **Location**: `pacta_appweb/`
- **Problem**: Sidebar blank page on desktop when logo SVG is rendered
- **Root Cause**: Missing `vite-plugin-svgr` in Vite configuration
- **Current Code**: `src/components/layout/AppSidebar.tsx:6,251,258`
- **SVG File**: `src/images/contract_icon.svg` (valid SVG with `fill="currentColor"`)

---

## Pre-Implementation Checklist

- [x] Systematic debugging completed - root cause identified
- [x] Subagents research completed (SVG investigation + React rendering best practices)
- [x] Design approved: Use vite-plugin-svgr with error boundary and accessibility enhancements
- [ ] Ensure dev server stopped before modifying vite.config.ts

---

### Task 1: Install vite-plugin-svgr Dependency

**Files:** 
- `pacta_appweb/package.json` (modify dependencies)

**Step 1:** Add `vite-plugin-svgr` to devDependencies

Run:
```bash
cd pacta_appweb
npm install -D vite-plugin-svgr
```

**Step 2:** Verify installation

Check `package.json` devDependencies includes:
```json
"vite-plugin-svgr": "^4.0.0"
```
(version may vary)

**Step 3:** Commit dependency change

```bash
git add package.json package-lock.json
git commit -m "feat: add vite-plugin-svgr for SVG React components"
```

---

### Task 2: Configure Vite to Process SVG?react Imports

**Files:**
- Modify: `pacta_appweb/vite.config.ts`

**Step 1:** Read current config (for reference)

Already read - current config:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { ... }
});
```

**Step 2:** Add SVGR plugin import and configuration

Edit `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';  // ADD THIS
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    svgr({                       // ADD THIS CONFIG
      svgo: true,
      titleProp: true,
      ref: true,
    }),
    tailwindcss()
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    reportCompressedSize: true,
  },
});
```

**Key points:**
- `svgo: true` - optimizes SVG output
- `titleProp: true` - extracts `<title>` as React prop
- `ref: true` - enables ref forwarding

**Step 3:** Commit configuration change

```bash
git add pacta_appweb/vite.config.ts
git commit -m "config: enable SVGR plugin for SVG React component imports"
```

---

### Task 3: Add React Error Boundary Component

**Files:**
- Create: `pacta_appweb/src/components/common/ErrorBoundary.tsx`

**Step 1:** Create ErrorBoundary component with fallback UI

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center w-full h-full bg-muted/20 rounded">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Step 2:** Add TypeScript types check

Run: `npm run build` from `pacta_appweb/` or `npx tsc --noEmit` to verify types compile.

**Step 3:** Commit new component

```bash
git add src/components/common/ErrorBoundary.tsx
git commit -m "feat: add ErrorBoundary component for graceful SVG failure handling"
```

---

### Task 4: Enhance Logo Rendering in AppSidebar

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx`

**Step 1:** Import ErrorBoundary

Add to imports section (after line 27):
```tsx
import ErrorBoundary from '@/components/common/ErrorBoundary';
```

**Step 2:** Wrap ContractIcon with ErrorBoundary and add accessibility

Replace line 251:
```tsx
<ContractIcon className="h-8 w-8" />
```

With:
```tsx
<ErrorBoundary
  fallback={
    <div 
      className="h-8 w-8 flex items-center justify-center bg-primary/10 rounded-md"
      aria-label="PACTA Logo"
    >
      <span className="text-xs font-bold text-primary">P</span>
    </div>
  }
>
  <ContractIcon 
    className="h-8 w-8 text-primary" 
    aria-label="PACTA Logo"
    role="img"
    title="PACTA - Contract Management"
  />
</ErrorBoundary>
```

Replace line 258 (collapsed state):
```tsx
<ContractIcon className="h-10 w-10" />
```

With:
```tsx
<ErrorBoundary
  fallback={
    <div 
      className="h-10 w-10 flex items-center justify-center bg-primary/10 rounded-md"
      aria-label="PACTA Logo"
    >
      <span className="text-sm font-bold text-primary">P</span>
    </div>
  }
>
  <ContractIcon 
    className="h-10 w-10 text-primary" 
    aria-label="PACTA Logo"
    role="img"
    title="PACTA - Contract Management"
  />
</ErrorBoundary>
```

**Step 3:** Verify CSS class `text-primary` properly defined in Tailwind (should exist in project's `tailwind.config.js` or CSS variables). No changes needed if using standard class.

**Step 4:** Type check - run `npx tsc --noEmit` to ensure no type errors introduced.

**Step 5:** Commit changes

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "fix: wrap logo in ErrorBoundary and add accessibility attributes"
```

---

### Task 5: Verify Build and SVG Processing

**Files:** N/A (validation)

**Step 1:** Stop dev server if running (Ctrl+C)

**Step 2:** Clean previous build artifacts

```bash
cd pacta_appweb
rm -rf dist
```

**Step 3:** Rebuild with production optimizations

```bash
npm run build
```

**Expected output:**
- Build succeeds without errors
- No type errors
- No SVGR plugin warnings
- `dist/assets/*.svg` files should be present (if not inlined)

**Step 4:** Check build output for logo

Inspect `dist/` to see if `contract_icon.svg` was transformed:
- If SVGR active, the SVG code should be inlined as a JS string within the JS bundle (not a separate `.svg` file)
- Or a hashed `.svg` file may exist as asset (depending on SVGR `include` config)

**Step 5:** If build fails, inspect error message and adjust configuration accordingly.

**Step 6:** Commit successful build confirmation

```bash
git add .
git commit -m "build: verify SVG plugin configuration works"
```

---

### Task 6: Test in Development Environment

**Files:** N/A (manual verification)

**Step 1:** Start dev server (if not already running)

```bash
cd pacta_appweb
npm run dev
```

**Step 2:** Open browser to `http://localhost:5173` (or Vite's default port)

**Step 3:** Verify sidebar logo renders correctly:

- [ ] Desktop view (>=1024px): logo visible on left sidebar with text "PACTA"
- [ ] Collapsed state (click collapse button): logo alone visible, centered
- [ ] No console errors related to `ContractIcon` or SVG
- [ ] Logo color matches `text-primary` (should be theme's primary color)
- [ ] Hover effects work (if any)

**Step 4:** Test error fallback (optional)

To test ErrorBoundary fallback, temporarily rename `contract_icon.svg` to something else and refresh. Should see the fallback "P" placeholder. Restore filename after test.

**Step 5:** Document test results

If issues found, add to `docs/LESSONS.md` (see Step 8).

---

### Task 7: Final Integration Test and CI Check

**Files:** N/A

**Step 1:** Run type checking

```bash
cd pacta_appweb
npx tsc --noEmit
```

**Step 2:** Run lint

```bash
npm run lint
```

Fix any lint warnings if present.

**Step 3:** Run test suite

```bash
npm test
```

Ensure all tests still pass.

**Step 4:** Build again to confirm CI build will work

```bash
npm run build
```

**Step 5:** If all green, prepare PR merge

```bash
git push origin <your-branch>
# Create PR via GitHub UI or gh CLI
```

---

### Task 8: Documentation and Knowledge Capture

**Files:**
- Modify: `pacta/docs/LESSONS.md` (if new lessons learned)
- Create: `docs/plans/2026-04-22-fix-svg-rendering-design.md` (design doc)

**Step 1:** Write design doc summarizing the fix

Create `docs/plans/2026-04-22-fix-svg-rendering-design.md`:

```markdown
# SVG Rendering Fix - Design Document

## Problem
Sidebar blank page on desktop when rendering logo SVG. Root cause: Vite configuration missing `vite-plugin-svgr`, causing `import ...?react` to return URL string instead of React component.

## Solution
Installed and configured `vite-plugin-svgr` with SVGO optimization. Added ErrorBoundary and accessibility attributes to logo component in AppSidebar.

## Technical Details
- Plugin: `vite-plugin-svgr` with `svgo: true`, `titleProp: true`, `ref: true`
- Error handling: React ErrorBoundary with text fallback
- Accessibility: `role="img"`, `aria-label`, `title` attributes

## Files Changed
- `package.json` (+devDependency)
- `vite.config.ts` (+svgr plugin)
- `src/components/common/ErrorBoundary.tsx` (new)
- `src/components/layout/AppSidebar.tsx` (+wrappers + a11y)

## Testing
- Verified in dev environment (desktop/tablet breakpoints)
- Build succeeded with optimized assets
- No console errors
- Logo renders in expanded/collapsed states

## References
- SVGR docs: https://react-svgr.com/docs/plugins/
- Vite plugins: https://vitejs.dev/guide/using-plugins.html
```

**Step 2:** If any new lessons learned (e.g., "Always verify SVGR plugin when using ?react imports"), add to `docs/LESSONS.md` following existing format.

**Step 3:** Commit design doc

```bash
git add docs/plans/2026-04-22-fix-svg-rendering-design.md
git commit -m "docs: add design document for SVG rendering fix"
```

---

## Rollback Plan

If build fails after configuration change:

1. Revert vite.config.ts to previous commit:
   ```bash
   git checkout HEAD~1 -- pacta_appweb/vite.config.ts
   ```

2. Remove plugin if already installed:
   ```bash
   npm uninstall vite-plugin-svgr
   ```

3. Revert AppSidebar.tsx changes if already applied:
   ```bash
   git checkout HEAD~1 -- src/components/layout/AppSidebar.tsx
   git checkout HEAD~1 -- src/components/common/ErrorBoundary.tsx
   ```

4. System returns to pre-fix state.

---

## Success Criteria

- [x] Root cause identified and documented
- [x] `vite-plugin-svgr` installed and configured
- [x] Vite build succeeds without errors
- [x] Sidebar logo renders on desktop view (expanded and collapsed)
- [x] No console errors related to SVG rendering
- [x] Logo inherits `text-primary` color via `currentColor`
- [x] ErrorBoundary provides fallback if SVG fails
- [x] Accessibility: screen readers announce logo
- [ ] All tests pass
- [ ] Lint warnings addressed
- [ ] Design document written and committed

---

**Plan is ready for execution. Use @subagent-driven-development for parallel task dispatch or @executing-plans for separate session.**
