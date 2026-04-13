# Login Page Split-Screen Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the login page into a responsive split-screen layout with integrated branding, consistent with the landing page theme system.

**Architecture:** Separate page-level layout (LoginPage) from the form card (LoginForm). LoginPage owns the full-page split-screen responsive layout with branding panel. LoginForm becomes a pure card component without any layout wrappers.

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion, shadcn/ui components

---

### Task 1: Simplify LoginForm - Remove Layout Wrapper

**Files:**
- Modify: `pacta_appweb/src/components/auth/LoginForm.tsx`

**Step 1: Remove the outer layout wrapper**

In `LoginForm.tsx`, the `return` statement currently wraps everything in:
```tsx
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 sm:p-6 lg:p-8">
  <Card className="w-full max-w-md shadow-lg dark:shadow-2xl">
    ...
  </Card>
</div>
```

Replace the outer `div` with just the `Card` component. The Card should keep its existing classes but lose the parent wrapper:

```tsx
return (
  <Card className="w-full max-w-md shadow-lg dark:shadow-2xl">
    <CardHeader className="space-y-3 pb-6">
      ...
    </CardHeader>
    <CardContent className="px-6 sm:px-8">
      ...
    </CardContent>
  </Card>
);
```

**Step 2: Verify the build**

Run: `cd pacta_appweb && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/auth/LoginForm.tsx
git commit -m "refactor: remove layout wrapper from LoginForm for split-screen layout"
```

---

### Task 2: Rewrite LoginPage with Split-Screen Layout

**Files:**
- Modify: `pacta_appweb/src/pages/LoginPage.tsx`

**Step 1: Replace LoginPage content with split-screen layout**

Replace the entire return statement in `LoginPage.tsx` with:

```tsx
"use client";

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex">
      {/* Left branding panel - hidden on mobile */}
      <motion.div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5 p-8"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div
          className="cursor-pointer"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => navigate('/')}
        >
          <AnimatedLogo size="xl" />
        </motion.div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">PACTA</h1>
        <p className="mt-2 text-lg text-muted-foreground text-center max-w-sm">
          Manage contracts with clarity
        </p>
      </motion.div>

      {/* Right form panel */}
      <motion.div
        className="flex w-full md:w-1/2 lg:w-2/5 items-center justify-center bg-background p-6"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo - visible only on mobile */}
          <motion.div
            className="mb-8 flex justify-center md:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <motion.div
              className="cursor-pointer"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/')}
            >
              <AnimatedLogo size="md" animate={false} />
            </motion.div>
          </motion.div>
          <LoginForm />
        </div>
      </motion.div>
    </div>
  );
}
```

**Step 2: Verify the build**

Run: `cd pacta_appweb && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/LoginPage.tsx
git commit -m "feat: implement split-screen login layout with responsive branding"
```

---

### Task 3: Visual Verification and Responsive Testing

**Files:**
- No code changes

**Step 1: Start the dev server**

Run: `cd pacta_appweb && npm run dev`

**Step 2: Test responsive breakpoints**

Open browser and verify:
- Desktop (>1024px): 60/40 split with branding panel visible
- Tablet (768px-1024px): 50/50 split
- Mobile (<768px): Single column with small logo at top, form below

**Step 3: Test theme consistency**

- Toggle between light/dark mode
- Verify branding panel gradient adapts to theme
- Verify form card uses theme colors (not hardcoded blue/indigo)
- Verify logo is clickable and navigates to home page on both panels

**Step 4: Test form functionality**

- Login form submits correctly
- Register toggle works
- Toast notifications appear
- Navigation to dashboard on successful login

**Step 5: Commit any fixes if needed**

---

### Task 4: Update Design Doc (if changes during implementation)

**Files:**
- Modify: `docs/plans/2026-04-13-login-page-split-design.md` (if needed)

If any deviations from the design were discovered during implementation, update the design doc to reflect the actual implementation.

**Step 1: Review design doc against implementation**

Compare the design doc with the actual code. Update any sections that differ.

**Step 2: Commit**

```bash
git add docs/plans/2026-04-13-login-page-split-design.md
git commit -m "docs: update login page design doc with implementation notes"
```
