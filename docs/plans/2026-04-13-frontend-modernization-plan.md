# Pacta Frontend Modernization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the Pacta SaaS frontend with a professional purple-accented color palette, glassmorphism effects, collapsible sidebar, and redesigned dashboard cards — maintaining consistency across light/dark themes and aligning with the existing landing page aesthetic.

**Architecture:** Update the Tailwind CSS theme tokens in `index.css` to introduce a vibrant purple primary color with proper OKLCH values for both light and dark modes. Modernize the AppSidebar with collapse animation, gradient active states, and improved user profile section. Redesign DashboardPage with glassmorphism stat cards, trend indicators, and improved data visualization. Add modern button variants and card styles to shadcn components.

**Tech Stack:** React 19, Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide Icons, next-themes, Recharts

---

## Design System Reference

**Color Palette (OKLCH):**

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Primary | `oklch(0.54 0.22 290)` (#7C3AED violet-600) | `oklch(0.72 0.19 290)` (#A78BFA violet-400) |
| Primary-foreground | `oklch(1 0 0)` (white) | `oklch(0.15 0.05 290)` (deep purple-dark) |
| Accent | `oklch(0.70 0.20 40)` (#F97316 orange-500) | `oklch(0.75 0.18 40)` (#FB923C orange-400) |
| Background | `oklch(0.98 0.005 290)` (#FAFAFA zinc-50 warm) | `oklch(0.10 0.01 290)` (#0C0A0F near-black) |
| Card | `oklch(1 0 0)` (white) | `oklch(0.16 0.01 290)` (#1A1720 dark card) |
| Muted | `oklch(0.96 0.005 290)` (#F4F4F5 zinc-100) | `oklch(0.22 0.01 290)` (#27272A zinc-800) |
| Border | `oklch(0.92 0.005 290)` (#E4E4E7 zinc-200) | `oklch(0.28 0.01 290)` (#3F3F46 zinc-700) |

**Style:** Glassmorphism — frosted glass cards, subtle backdrop-blur on overlays, gradient icon backgrounds, layered depth with shadows.

**Typography:** Keep existing Geist Sans/Mono (already loaded). Add tighter tracking on headings (`tracking-tight`), gradient text on hero elements.

**Effects:** 
- Backdrop blur (10-20px) on floating elements
- Subtle borders (1px solid rgba white 0.1 in dark mode)
- Card hover: `translateY(-2px)` + enhanced shadow
- Active nav item: gradient left border + subtle glow

---

### Task 1: Update Color Palette in index.css

**Files:**
- Modify: `pacta_appweb/src/index.css` (full theme section rewrite)

**Step 1: Update `:root` (light mode) CSS variables**

Replace the current grayscale OKLCH values with the new purple-accented palette:

```css
:root {
  --radius: 0.625rem;
  /* Warm light background */
  --background: oklch(0.98 0.005 290);
  --foreground: oklch(0.145 0.01 290);
  /* White cards with subtle purple tint */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0.01 290);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0.01 290);
  /* Purple primary */
  --primary: oklch(0.54 0.22 290);
  --primary-foreground: oklch(0.985 0 0);
  /* Orange accent for CTAs */
  --accent: oklch(0.70 0.20 40);
  --accent-foreground: oklch(0.145 0.01 290);
  --secondary: oklch(0.96 0.005 290);
  --secondary-foreground: oklch(0.205 0.01 290);
  --muted: oklch(0.96 0.005 290);
  --muted-foreground: oklch(0.48 0.01 290);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.005 290);
  --input: oklch(0.92 0.005 290);
  --ring: oklch(0.54 0.22 290);
  /* Chart colors - vibrant palette */
  --chart-1: oklch(0.54 0.22 290);  /* purple */
  --chart-2: oklch(0.70 0.20 40);   /* orange */
  --chart-3: oklch(0.65 0.22 160);  /* teal */
  --chart-4: oklch(0.60 0.25 25);   /* red */
  --chart-5: oklch(0.75 0.15 140);  /* green */
  /* Sidebar - subtle purple tint */
  --sidebar: oklch(0.98 0.008 290);
  --sidebar-foreground: oklch(0.145 0.01 290);
  --sidebar-primary: oklch(0.54 0.22 290);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.94 0.01 290);
  --sidebar-accent-foreground: oklch(0.54 0.22 290);
  --sidebar-border: oklch(0.92 0.005 290);
  --sidebar-ring: oklch(0.54 0.22 290);
}
```

**Step 2: Update `.dark` CSS variables**

```css
.dark {
  --background: oklch(0.10 0.01 290);
  --foreground: oklch(0.96 0.005 290);
  --card: oklch(0.16 0.01 290);
  --card-foreground: oklch(0.96 0.005 290);
  --popover: oklch(0.16 0.01 290);
  --popover-foreground: oklch(0.96 0.005 290);
  /* Lighter purple for dark mode readability */
  --primary: oklch(0.72 0.19 290);
  --primary-foreground: oklch(0.15 0.05 290);
  --accent: oklch(0.75 0.18 40);
  --accent-foreground: oklch(0.15 0.01 290);
  --secondary: oklch(0.22 0.01 290);
  --secondary-foreground: oklch(0.96 0.005 290);
  --muted: oklch(0.22 0.01 290);
  --muted-foreground: oklch(0.70 0.01 290);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(0.28 0.01 290);
  --input: oklch(0.28 0.01 290);
  --ring: oklch(0.72 0.19 290);
  --chart-1: oklch(0.72 0.19 290);
  --chart-2: oklch(0.75 0.18 40);
  --chart-3: oklch(0.70 0.20 160);
  --chart-4: oklch(0.65 0.25 25);
  --chart-5: oklch(0.78 0.15 140);
  --sidebar: oklch(0.12 0.01 290);
  --sidebar-foreground: oklch(0.96 0.005 290);
  --sidebar-primary: oklch(0.72 0.19 290);
  --sidebar-primary-foreground: oklch(0.15 0.05 290);
  --sidebar-accent: oklch(0.20 0.02 290);
  --sidebar-accent-foreground: oklch(0.72 0.19 290);
  --sidebar-border: oklch(0.28 0.01 290);
  --sidebar-ring: oklch(0.72 0.19 290);
}
```

**Step 3: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit && npx vite build --mode development`
Expected: No errors, build completes successfully.

**Step 4: Visual verification**

Run: `cd pacta_appweb && npm run dev`
Open browser, toggle between light/dark themes. Verify:
- Purple primary is visible on buttons, active nav items, links
- Orange accent is visible on CTA elements
- Light mode: cards are white, background is warm off-white
- Dark mode: deep near-black background, purple cards, readable text
- Chart colors are vibrant and distinguishable

**Step 5: Commit**

```bash
git add pacta_appweb/src/index.css
git commit -m "feat: modernize color palette with purple primary and orange accent"
```

---

### Task 2: Modernize Button Component with Gradient Variants

**Files:**
- Modify: `pacta_appweb/src/components/ui/button.tsx`

**Step 1: Add gradient and soft variants to buttonVariants**

Current button uses `cva` with variants. Add two new variants:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent/10 hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // NEW: Gradient for CTAs
        gradient: "bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 shadow-md hover:shadow-lg transition-all duration-200",
        // NEW: Soft for secondary actions
        soft: "bg-primary/10 text-primary hover:bg-primary/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
```

**Step 2: Update border radius**

Change `rounded-md` to `rounded-lg` across all variants for a more modern, softer look.

**Step 3: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/ui/button.tsx
git commit -m "feat: add gradient and soft button variants, modernize border radius"
```

---

### Task 3: Modernize Card Component with Glass Effect

**Files:**
- Modify: `pacta_appweb/src/components/ui/card.tsx`

**Step 1: Update Card base styles**

Add subtle shadow and transition for hover effects:

```typescript
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md",
      className,
    )}
    {...props}
  />
))
```

Changes:
- `rounded-lg` → `rounded-xl` (softer, more modern)
- Added `transition-all duration-200 hover:shadow-md`

**Step 2: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/ui/card.tsx
git commit -m "feat: modernize card with rounded-xl and hover shadow transition"
```

---

### Task 4: Redesign AppSidebar with Collapsible + Gradient Accents

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx`

**Step 1: Add collapse state management**

Add state and imports at the top:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SIDEBAR_WIDTH = '16rem'; // 256px (w-64)
const SIDEBAR_COLLAPSED = '4.5rem'; // 72px
```

**Step 2: Add collapse state to component**

```typescript
export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  // ... existing state
```

**Step 3: Update desktop sidebar wrapper**

Replace the desktop sidebar div with:

```tsx
<div
  className="flex h-screen flex-col border-r bg-card transition-all duration-300 ease-in-out"
  style={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH }}
>
  {/* Header with logo and collapse toggle */}
  <div className="flex items-center justify-between px-6 py-5">
    {!collapsed && (
      <div className="transition-opacity duration-200">
        <h1 className="text-xl font-bold tracking-tight text-primary">PACTA</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Contract Management</p>
      </div>
    )}
    {collapsed && (
      <div className="mx-auto">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          P
        </div>
      </div>
    )}
    <button
      onClick={() => setCollapsed(!collapsed)}
      className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  </div>
```

**Step 4: Update navigation items with gradient active state + tooltips**

Replace the nav link rendering:

```tsx
<nav role="navigation" aria-label="Main navigation" className="space-y-1">
  {filteredNavigation.map((item) => {
    const isActive = pathname === item.href;
    const label = navLabels[item.nameKey];
    
    const linkContent = (
      <Link
        key={item.nameKey}
        to={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-primary/10 to-transparent text-primary shadow-sm border-l-2 border-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        style={{ borderLeft: isActive ? '3px solid hsl(var(--primary))' : '3px solid transparent' }}
      >
        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!collapsed && (
          <span className="truncate transition-opacity duration-200">
            {label}
          </span>
        )}
        {item.href === '/notifications' && unreadCount > 0 && (
          <span className={cn(
            "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1",
            collapsed && "ml-0"
          )}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    );

    // Wrap in tooltip when collapsed
    if (collapsed) {
      return (
        <TooltipProvider key={item.nameKey} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              <span>{label}</span>
              {item.href === '/notifications' && unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return linkContent;
  })}
</nav>
```

**Step 5: Update user profile section**

Replace the bottom user section:

```tsx
<div className="mt-auto border-t p-4">
  <div className={cn(
    "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted",
    collapsed && "justify-center"
  )}>
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
        {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
      </AvatarFallback>
    </Avatar>
    {!collapsed && (
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user?.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
      </div>
    )}
    {!collapsed && (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={logout}
        aria-label="Logout"
      >
        <LogOut className="h-4 w-4 text-muted-foreground" />
      </Button>
    )}
  </div>
  {collapsed && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 mx-auto mt-2"
      onClick={logout}
      aria-label="Logout"
    >
      <LogOut className="h-4 w-4 text-muted-foreground" />
    </Button>
  )}
</div>
```

**Step 6: Remove CompanySelector from sidebar (move to header)**

The CompanySelector takes space in the sidebar. For the collapsed state, move it to the AppLayout header instead. Remove the `<CompanySelector />` line from the sidebar and add it to `AppLayout.tsx` header.

**Step 7: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 8: Commit**

```bash
git add pacta_appweb/src/components/layout/AppSidebar.tsx
git commit -m "feat: redesign sidebar with collapse, gradient accents, and tooltips"
```

---

### Task 5: Update AppLayout Header with CompanySelector

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppLayout.tsx`

**Step 1: Import CompanySelector**

Add import:
```typescript
import CompanySelector from '@/components/CompanySelector';
```

**Step 2: Add CompanySelector to header**

Update the header section:

```tsx
<header role="banner" className="border-b bg-card px-6 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <CompanySelector />
    <h1 className="text-xl font-semibold tracking-tight">
      {pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || '')}
    </h1>
  </div>
  <div className="flex items-center gap-2">
    <LanguageToggle />
    <ThemeToggle />
  </div>
</header>
```

**Step 3: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/layout/AppLayout.tsx
git commit -m "feat: move company selector to header for better sidebar collapse"
```

---

### Task 6: Redesign DashboardPage with Glassmorphism Cards

**Files:**
- Modify: `pacta_appweb/src/pages/DashboardPage.tsx`

**Step 1: Update KPI stat cards with gradient icons and trend indicators**

Replace the KPI cards grid with modern glassmorphism-style cards:

```tsx
<div className="space-y-6">
  {/* KPI Cards */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Card className="relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 transition-all duration-300 group-hover:bg-primary/10" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('kpi.totalContracts.title')}</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{stats.totalActive}</div>
        <p className="mt-1 text-xs text-muted-foreground">Currently active</p>
      </CardContent>
    </Card>

    <Card className="relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-yellow-500/5 transition-all duration-300 group-hover:bg-yellow-500/10" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('kpi.expiringSoon.title')}</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight text-yellow-600 dark:text-yellow-500">{stats.expiringSoon}</div>
        <p className="mt-1 text-xs text-muted-foreground">Within 30 days</p>
      </CardContent>
    </Card>

    <Card className="relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 transition-all duration-300 group-hover:bg-primary/10" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('kpi.pendingApproval.title')}</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <FilePlus className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{stats.pendingSupplements}</div>
        <p className="mt-1 text-xs text-muted-foreground">Awaiting approval</p>
      </CardContent>
    </Card>

    <Card className="relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-green-500/5 transition-all duration-300 group-hover:bg-green-500/10" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('kpi.totalContracts.desc')}</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">${stats.totalValue.toLocaleString()}</div>
        <p className="mt-1 text-xs text-muted-foreground">Active contracts value</p>
      </CardContent>
    </Card>
  </div>
```

**Step 2: Update expiring contracts alert card**

```tsx
{expiringContracts.length > 0 && (
  <Card className="border-yellow-200 dark:border-yellow-800/50 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/10">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
        <AlertTriangle className="h-5 w-5" />
        {t('expiringTitle')}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {expiringContracts.map(contract => {
          const daysUntilExpiration = Math.ceil(
            (new Date(contract.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return (
            <div key={contract.id} className="flex items-center justify-between rounded-lg border bg-card/80 p-3 backdrop-blur-sm transition-colors hover:bg-card">
              <div>
                <p className="font-medium">{contract.title}</p>
                <p className="text-sm text-muted-foreground">{contract.contract_number}</p>
              </div>
              <div className="text-right">
                <Badge variant={daysUntilExpiration <= 7 ? 'destructive' : 'default'}>
                  {daysUntilExpiration} {t('daysLeft')}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(contract.end_date).toLocaleDateString(i18n.language)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
)}
```

**Step 3: Update quick actions with soft button variant**

Replace the quick actions card:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <BarChart3 className="h-5 w-5 text-primary" />
      {t('quickActions')}
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    <Link to="/contracts?action=create">
      <Button className="w-full justify-start gap-2" variant="soft">
        <FileText className="h-4 w-4" />
        {t('newContract')}
      </Button>
    </Link>
    <Link to="/clients">
      <Button className="w-full justify-start gap-2" variant="soft">
        <Building2 className="h-4 w-4" />
        {t('newClient')}
      </Button>
    </Link>
    <Link to="/suppliers">
      <Button className="w-full justify-start gap-2" variant="soft">
        <Truck className="h-4 w-4" />
        {t('newSupplier')}
      </Button>
    </Link>
    <Link to="/reports">
      <Button className="w-full justify-start gap-2" variant="soft">
        <BarChart3 className="h-4 w-4" />
        {t('viewReports')}
      </Button>
    </Link>
    <Link to="/documents">
      <Button className="w-full justify-start gap-2" variant="soft">
        <FolderOpen className="h-4 w-4" />
        {tContracts('documents')}
      </Button>
    </Link>
  </CardContent>
</Card>
```

**Step 4: Add missing imports**

Add `Building2`, `Truck`, `FolderOpen` to the lucide-react import.

**Step 5: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add pacta_appweb/src/pages/DashboardPage.tsx
git commit -m "feat: redesign dashboard with glassmorphism cards and gradient icons"
```

---

### Task 7: Update Landing Page with New Color Palette

**Files:**
- Modify: `pacta_appweb/src/components/landing/HeroSection.tsx`
- Modify: `pacta_appweb/src/components/landing/FeaturesSection.tsx`

**Step 1: Update HeroSection CTA button to use gradient variant**

In `HeroSection.tsx`, change the primary CTA button:

```tsx
<Button
  size="lg"
  variant="gradient"
  onClick={() => navigate('/login')}
  className="group rounded-xl px-8 text-base"
>
  {t('hero.startNow')}
  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
</Button>
```

**Step 2: Update FeaturesSection cards with gradient backgrounds**

In `FeaturesSection.tsx`, update the feature card icon container:

```tsx
<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
  <feature.icon className="h-6 w-6 text-primary" />
</div>
```

Update the card hover effect:

```tsx
<Card className="group relative h-full overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:border-primary/20">
  <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 transition-all duration-300 group-hover:from-primary/10 group-hover:to-accent/10" />
```

**Step 3: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/landing/HeroSection.tsx pacta_appweb/src/components/landing/FeaturesSection.tsx
git commit -m "feat: update landing with gradient buttons and icon backgrounds"
```

---

### Task 8: Update Input and Select Components for Modern Look

**Files:**
- Modify: `pacta_appweb/src/components/ui/input.tsx`
- Modify: `pacta_appweb/src/components/ui/select.tsx`

**Step 1: Update Input component**

```typescript
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
```

Changes:
- `rounded-md` → `rounded-lg`
- Added `shadow-sm`
- Focus ring: `ring-primary/20` (purple tinted)
- `focus-visible:border-primary`

**Step 2: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/ui/input.tsx
git commit -m "feat: modernize input with rounded-lg, shadow, and purple focus ring"
```

---

### Task 9: Update Badge Component with Soft Variant

**Files:**
- Modify: `pacta_appweb/src/components/ui/badge.tsx`

**Step 1: Add soft variant to badgeVariants**

```typescript
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        soft: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)
```

**Step 2: Verify build**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/ui/badge.tsx
git commit -m "feat: add soft variant to badge component"
```

---

### Task 10: Full Build Verification and Visual Testing

**Files:**
- All modified files from Tasks 1-9

**Step 1: Run full TypeScript check**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: Zero errors.

**Step 2: Run full build**

Run: `cd pacta_appweb && npx vite build`
Expected: Build completes without errors.

**Step 3: Run tests**

Run: `cd pacta_appweb && npm run test`
Expected: All tests pass.

**Step 4: Run linter**

Run: `cd pacta_appweb && npm run lint`
Expected: No errors (warnings acceptable).

**Step 5: Dev server visual verification**

Run: `cd pacta_appweb && npm run dev`

Open browser and verify:
1. **Light mode:**
   - Purple primary on buttons, active nav items, links
   - Orange accent visible on gradient buttons
   - White cards with subtle shadows
   - Warm off-white background
   - Sidebar collapse works smoothly
   - Dashboard stat cards have gradient icon backgrounds
   - Landing page gradient CTA button

2. **Dark mode:**
   - Lighter purple primary (readable on dark bg)
   - Dark cards (#1A1720 range)
   - Near-black background
   - Gradient buttons still visible
   - Chart colors distinguishable
   - Sidebar collapse with tooltips

3. **Responsive:**
   - Mobile: sidebar becomes overlay
   - Tablet: sidebar collapses by default
   - Desktop: full sidebar with collapse toggle

**Step 6: Final commit**

```bash
git add .
git commit -m "chore: verify full build and visual consistency"
```

---

## Summary

**Total Tasks:** 10
**Estimated Files Modified:** 10
**Key Changes:**
1. Purple + Orange color palette (OKLCH, both themes)
2. Gradient + soft button variants
3. Card hover transitions + rounded-xl
4. Collapsible sidebar with gradient active states + tooltips
5. Glassmorphism dashboard cards
6. Landing page gradient accents
7. Modern input focus rings
8. Soft badge variant

**Design Principles Applied:**
- DRY: Reuse existing shadcn patterns, extend with variants
- YAGNI: No new dependencies, only enhance existing components
- Progressive: Each task is independently verifiable
- Accessible: Maintains all existing ARIA attributes, focus states, reduced-motion support
