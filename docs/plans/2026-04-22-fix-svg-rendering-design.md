# SVG Rendering Fix - Design Document

## Problem
Sidebar blank page on desktop when rendering logo SVG. Root cause: Vite configuration missing `vite-plugin-svgr`, causing `import ...?react` to return URL string instead of React component.

## Solution
Installed and configured `vite-plugin-svgr` with SVGO optimization. Added ErrorBoundary and accessibility attributes to logo component in AppSidebar.

## Technical Details
- Plugin: `vite-plugin-svgr` with `svgo: true`, `titleProp: true`, `ref: true`
- Error handling: React ErrorBoundary with text fallback showing "P" letter mark
- Accessibility: `role="img"`, `aria-label="PACTA Logo"`, `title="PACTA - Contract Management"`
- SVG file: `src/images/contract_icon.svg` uses `fill="currentColor"` to inherit theme colors

## Files Changed
- `pacta_appweb/package.json` (+devDependency: vite-plugin-svgr@^5.2.0)
- `pacta_appweb/vite.config.ts` (+svgr plugin configuration)
- `pacta_appweb/src/components/common/ErrorBoundary.tsx` (new component)
- `pacta_appweb/src/components/layout/AppSidebar.tsx` (+ErrorBoundary wrappers, +a11y attrs)

## Build Verification
- Build succeeds without errors
- SVG is inlined as React component within JS bundle (no separate .svg asset)
- Bundle size: index-DZSrSUkx.js 598KB (gzipped 174KB)
- TypeScript compilation: clean

## Testing
- Manual verification in dev environment: logo renders in expanded and collapsed sidebar states
- No console errors related to SVG rendering
- Logo inherits `text-primary` color via `currentColor`
- ErrorBoundary provides fallback UI if SVG fails to load

## References
- SVGR docs: https://react-svgr.com/docs/plugins/
- Vite plugins: https://vitejs.dev/guide/using-plugins.html
- Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
