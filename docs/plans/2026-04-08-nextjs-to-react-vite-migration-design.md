# Next.js to React + Vite Migration Design

**Date:** 2026-04-08
**Status:** Approved
**Author:** brainstorming session

---

## Summary

Migrate `pacta_appweb` from Next.js 15 (`output: 'export'`) to React 19 + Vite + React Router. Eliminates static export friction, reduces build time, and simplifies the codebase.

---

## Why

- Next.js `output: 'export'` is a second-class mode with frequent breaking changes
- No SSR/SSG/SEO needed — fully local-first SPA
- Vite is the enterprise standard for SPAs
- Build time: ~5s vs ~45s
- No server/client component conflicts
- No `generateStaticParams` for dynamic routes

---

## Architecture

```
pacta_appweb/
├── index.html              (Vite entry point)
├── vite.config.ts
├── package.json
├── src/
│   ├── main.tsx            (ReactDOM.createRoot)
│   ├── App.tsx             (React Router setup)
│   ├── components/         (shadcn/ui — unchanged)
│   ├── lib/                (storage, audit, export-utils — unchanged)
│   ├── contexts/           (AuthContext — unchanged)
│   ├── types/              (TypeScript types — unchanged)
│   └── pages/              (replaces app/ — one file per route)
└── dist/                   (Vite build output → embedded in Go)
```

---

## Changes

| From | To |
|------|-----|
| `next.config.ts` | `vite.config.ts` |
| `app/` (App Router) | `pages/` (React Router) |
| `next/link` | `react-router-dom` `<Link>` |
| `next/navigation` | `react-router-dom` `useNavigate`, `useParams` |
| `output: 'export'` → `out/` | `vite build` → `dist/` |
| `page.tsx` per route | `Page.tsx` per route in `pages/` |
| `layout.tsx` | `<AppLayout>` wrapper component |
| `generateStaticParams()` | Not needed — client-side routing |

---

## Dependencies

**Remove:** `next`, `eslint-config-next`, `@types/next`
**Add:** `vite`, `@vitejs/plugin-react`, `react-router-dom`, `@types/react-router-dom`
**Keep:** `react`, `react-dom`, `tailwindcss`, `shadcn/ui`, `lucide-react`, `recharts`, `zod`, `sonner`, `framer-motion`

---

## Go Binary Impact

- Goreleaser hook: `cd pacta_appweb && npm ci && npm run build`
- Go embed path changes: `frontend/out/` → `frontend/dist/`
- No other Go changes needed

---

## Build Pipeline

```
before hooks:
  1. cd pacta_appweb && npm ci && npm run build
     → generates pacta_appweb/dist/ (static SPA)
  2. go build ./cmd/pacta
     → //go:embed includes dist/ + migrations/
```
