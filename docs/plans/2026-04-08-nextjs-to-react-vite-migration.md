# Next.js to React + Vite Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate pacta_appweb from Next.js 15 to React 19 + Vite + React Router, eliminating static export friction.

**Architecture:** Single-page application with Vite as build tool, React Router for client-side routing, same Tailwind + shadcn/ui component library. Build output goes to `dist/` instead of `out/`.

**Tech Stack:** React 19, Vite 6, TypeScript, React Router DOM 7, Tailwind CSS v4, shadcn/ui

---

### Task 1: Scaffold Vite project structure

**Files:**
- Create: `pacta_appweb/vite.config.ts`
- Create: `pacta_appweb/index.html`
- Modify: `pacta_appweb/package.json` (replace Next.js deps with Vite + React Router)

**Step 1: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

**Step 2: Create index.html at project root**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PACTA</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 3: Update package.json scripts and dependencies**

Replace scripts:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

Remove: `next`, `eslint-config-next`, `@types/next`
Add: `vite`, `@vitejs/plugin-react`, `react-router-dom`

**Step 4: Commit**

```bash
git add pacta_appweb/vite.config.ts pacta_appweb/index.html pacta_appweb/package.json
git commit -m "feat: scaffold Vite + React Router setup"
```

---

### Task 2: Create React Router entry point and App shell

**Files:**
- Create: `pacta_appweb/src/main.tsx`
- Create: `pacta_appweb/src/App.tsx`
- Delete: `pacta_appweb/src/app/layout.tsx` (if exists)
- Delete: `pacta_appweb/src/app/page.tsx` (if exists)

**Step 1: Create main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

**Step 2: Create App.tsx with routes**

Map existing Next.js pages to React Router routes:

```typescript
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailsPage from './pages/ContractDetailsPage';
import ClientsPage from './pages/ClientsPage';
import SuppliersPage from './pages/SuppliersPage';
// Add remaining pages as needed

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/contracts" element={<AppLayout><ContractsPage /></AppLayout>} />
        <Route path="/contracts/:id" element={<AppLayout><ContractDetailsPage /></AppLayout>} />
        <Route path="/clients" element={<AppLayout><ClientsPage /></AppLayout>} />
        <Route path="/suppliers" element={<AppLayout><SuppliersPage /></AppLayout>} />
        {/* Add remaining routes */}
      </Routes>
    </AuthProvider>
  );
}

export default App;
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/main.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add React Router entry point and App shell"
```

---

### Task 3: Migrate pages from app/ to pages/

**Files:**
- For each `src/app/<route>/page.tsx`, create `src/pages/<Route>Page.tsx`
- Delete: `src/app/` directory after migration

**Step 1: Identify all existing pages**

Run: `find pacta_appweb/src/app -name "page.tsx" | sort`

Expected pages based on current structure:
- `src/app/page.tsx` → `src/pages/DashboardPage.tsx`
- `src/app/contracts/page.tsx` → `src/pages/ContractsPage.tsx`
- `src/app/contracts/[id]/page.tsx` → `src/pages/ContractDetailsPage.tsx`
- `src/app/clients/page.tsx` → `src/pages/ClientsPage.tsx`
- `src/app/suppliers/page.tsx` → `src/pages/SuppliersPage.tsx`
- `src/app/login/page.tsx` → `src/pages/LoginPage.tsx`
- Plus any additional pages found

**Step 2: For each page, apply these transformations:**

1. Remove `'use client'` directive (everything is client-side now)
2. Replace `useParams()` from `next/navigation` with `useParams()` from `react-router-dom`
3. Replace `useRouter()` from `next/navigation` with `useNavigate()` from `react-router-dom`
4. Replace `next/link` `<Link>` with `react-router-dom` `<Link>`
5. Replace `router.push('/path')` with `navigate('/path')`
6. Move file to `src/pages/<Name>Page.tsx`
7. Change export to `export default function <Name>Page()`

**Step 3: Example transformation for ContractDetailsPage**

```typescript
// Before (Next.js):
// 'use client';
// import { useParams, useRouter } from 'next/navigation';

// After (Vite):
import { useParams, useNavigate } from 'react-router-dom';
// Remove 'use client'
// Remove generateStaticParams() — not needed
```

Navigation changes:
```typescript
// Before:
const router = useRouter();
router.push('/contracts');
<Link href="/contracts">

// After:
const navigate = useNavigate();
navigate('/contracts');
<Link to="/contracts">
```

**Step 4: Delete src/app/ directory**

```bash
rm -rf pacta_appweb/src/app/
```

**Step 5: Commit**

```bash
git add pacta_appweb/src/pages/ -A
git rm -r pacta_appweb/src/app/
git commit -m "feat: migrate pages from app/ to pages/ with React Router"
```

---

### Task 4: Update imports and fix remaining Next.js references

**Files:**
- Search and replace all `next/*` imports
- Update `next.config.ts` references
- Fix `tsconfig.json` paths if needed

**Step 1: Find all remaining Next.js imports**

Run: `grep -r "from 'next" pacta_appweb/src/ --include="*.ts" --include="*.tsx"`

Expected: Should return nothing. If any remain, fix them:
- `next/image` → use `<img>` directly or a simple wrapper
- `next/head` → use `document.title` or `react-helmet` if needed
- Any other `next/*` → remove or replace

**Step 2: Update tsconfig.json**

Ensure paths work with Vite:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 3: Remove Next.js specific files**

```bash
rm -f pacta_appweb/next.config.ts
rm -f pacta_appweb/next-env.d.ts
rm -f pacta_appweb/postcss.config.mjs  (if Tailwind v4 handles this)
```

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: update tsconfig and remove Next.js config files"
```

---

### Task 5: Update Goreleaser and verify build

**Files:**
- Modify: `.goreleaser.yml` (update embed path from `out/` to `dist/`)
- Modify: `internal/server/server.go` (update embed path)

**Step 1: Check current embed path in Go code**

Run: `grep -r "frontend/out\|frontend/dist" /home/mowgli/pacta/internal/`

Update any references from `frontend/out` to `pacta_appweb/dist` or wherever the embed path is configured.

**Step 2: Update .goreleaser.yml if needed**

The before hook already runs `cd pacta_appweb && npm ci && npm run build`. The output directory changes from `out/` to `dist/`. Verify the Go embed path matches.

**Step 3: Install dependencies and test build locally**

```bash
cd pacta_appweb
npm install
npm run build
```

Expected: `dist/` directory created with static files, no errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: update goreleaser embed path for Vite dist/"
```

---

### Task 6: Create release tag and verify CI

**Step 1: Push all changes**

```bash
git push origin main
```

**Step 2: Create new version tag**

```bash
git tag v0.2.0 -m "PACTA v0.2.0 - Migrate from Next.js to React + Vite"
git push origin v0.2.0
```

**Step 3: Monitor CI**

Check: `https://github.com/PACTA-Team/pacta/actions`

Expected: All builds pass, release created with binaries.

---

### Task 7: Cleanup and documentation

**Files:**
- Delete: `pacta_appweb/next.config.ts`
- Delete: `pacta_appweb/next-env.d.ts`
- Delete: `pacta_appweb/src/app/` (if not already deleted)
- Update: `docs/plans/` with migration notes

**Step 1: Verify no Next.js artifacts remain**

```bash
ls pacta_appweb/ | grep -i next
# Should return nothing
```

**Step 2: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove remaining Next.js artifacts"
```

**Step 3: Update design doc status**

Mark `docs/plans/2026-04-08-nextjs-to-react-vite-migration-design.md` as completed.
