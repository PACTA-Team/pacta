# PACTA Landing Page & Theme Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix broken theme toggle, build a modern landing page with Framer Motion animations, and add PACTA branding to the login page.

**Architecture:** Wrap App in ThemeProvider at root, replace HomePage with a landing page (navbar + hero + features), enhance LoginPage with animated logo. All animations via Framer Motion (already in package.json).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Framer Motion, next-themes, lucide-react, shadcn/ui

---

### Task 1: Fix ThemeProvider in main.tsx

**Files:**
- Modify: `pacta_appweb/src/main.tsx`

**Step 1: Add ThemeProvider wrapper to main.tsx**

Import `ThemeProvider` and wrap `<App />`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import App from './App';
import './index.css';

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

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/main.tsx
git commit -m "fix: wrap App in ThemeProvider to enable theme toggle"
```

---

### Task 2: Create AnimatedLogo Component

**Files:**
- Create: `pacta_appweb/src/components/AnimatedLogo.tsx`

**Step 1: Create the AnimatedLogo component**

A reusable animated SVG logo component that uses the project's contract_icon.svg with Framer Motion animations:

```tsx
import { motion, HTMLMotionProps } from 'framer-motion';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function AnimatedLogo({ size = 'md', className = '', animate = true }: AnimatedLogoProps) {
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const floatVariants = {
    float: {
      y: [0, -8, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const LogoSvg = () => (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <path
        d="m48,39c0,4.971-4.029,9-9,9h-30c-4.971,0-9-4.029-9-9v-27-3c0-4.971 4.029-9 9-9h3 27c4.971,0 9,4.029 9,9v30zm-33-30c0-1.656-1.344-3-3-3h-3c-1.656,0-3,1.344-3,3v3c0,1.656 1.344,3 3,3h3c1.656,0 3-1.344 3-3v-3zm27,28.665l-5.619-5.619 2.103-2.049c.858-.858 1.116-2.586 .651-3.705-.465-1.122-1.56-2.292-2.772-2.292h-8.484c-.828,0-2.019,.774-2.562,1.317-.54,.54-1.317,1.731-1.317,2.559v8.484c0,1.215 1.173,2.307 2.292,2.772s2.631,.207 3.489-.651l2.307-2.247 5.763,5.766h-28.851c-1.656,0-3-1.341-3-3v-18h6c4.968,0 9-4.029 9-9v-6h18c1.659,0 3,1.344 3,3v28.665z"
        className="fill-current"
      />
    </svg>
  );

  if (!animate) {
    return (
      <div className={`${sizeMap[size]} ${className}`}>
        <LogoSvg />
      </div>
    );
  }

  return (
    <motion.div
      className={`${sizeMap[size]} ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={floatVariants} animate="float">
        <LogoSvg />
      </motion.div>
    </motion.div>
  );
}
```

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/AnimatedLogo.tsx
git commit -m "feat: add AnimatedLogo component with Framer Motion"
```

---

### Task 3: Create LandingNavbar Component

**Files:**
- Create: `pacta_appweb/src/components/landing/LandingNavbar.tsx`

**Step 1: Create the LandingNavbar component**

A responsive navbar with logo, nav links, and Login button:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedLogo } from '@/components/AnimatedLogo';

const navLinks = [
  { name: 'Features', href: '#features' },
  { name: 'About', href: '#about' },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md"
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <AnimatedLogo size="sm" animate={false} />
            <span className="text-lg font-bold tracking-tight">PACTA</span>
          </button>
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.name}
            </a>
          ))}
          <Button onClick={() => navigate('/login')} size="sm">
            Login
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t bg-background md:hidden"
        >
          <div className="flex flex-col gap-4 px-6 py-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <Button onClick={() => navigate('/login')} className="w-full">
              Login
            </Button>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
```

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/LandingNavbar.tsx
git commit -m "feat: add LandingNavbar with responsive mobile menu"
```

---

### Task 4: Create HeroSection Component

**Files:**
- Create: `pacta_appweb/src/components/landing/HeroSection.tsx`

**Step 1: Create the HeroSection component**

Inspired by 21st.dev's Hero Section 2 and Shape Landing Hero. Animated geometric shapes + PACTA logo + CTA:

```tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedLogo } from '@/components/AnimatedLogo';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const shapeVariants = {
  hidden: { opacity: 0, y: -100, rotate: -15 },
  visible: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 2, ease: [0.23, 0.86, 0.39, 0.96] },
  },
};

const floatAnimation = {
  y: [0, 12, 0],
  transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
};

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
}: {
  className: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
}) {
  return (
    <motion.div
      variants={shapeVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={`absolute ${className}`}
    >
      <motion.div
        animate={floatAnimation}
        style={{ width, height }}
        className="relative rounded-full bg-gradient-to-r from-primary/10 to-transparent blur-[1px] border border-primary/10"
      />
    </motion.div>
  );
}

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

      {/* Animated geometric shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <ElegantShape delay={0.3} width={500} height={120} rotate={12} className="left-[-10%] top-[15%]" />
        <ElegantShape delay={0.5} width={400} height={100} rotate={-15} className="right-[-5%] top-[70%]" />
        <ElegantShape delay={0.4} width={250} height={70} rotate={-8} className="left-[5%] bottom-[5%]" />
        <ElegantShape delay={0.6} width={180} height={50} rotate={20} className="right-[15%] top-[10%]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Logo */}
        <motion.div
          className="mx-auto mb-8 flex justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 200 }}
        >
          <AnimatedLogo size="xl" />
        </motion.div>

        {/* Badge */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">Contract Management System</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl md:leading-tight"
        >
          <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
            Manage Contracts
          </span>
          <br />
          <span className="bg-gradient-to-r from-primary via-foreground/90 to-primary/70 bg-clip-text text-transparent">
            with Clarity
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
        >
          Track, approve, and monitor every contract in one place.
          Never miss a renewal again.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.8 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            size="lg"
            onClick={() => navigate('/login')}
            className="group rounded-xl px-8 text-base"
          >
            Start Now
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const el = document.getElementById('features');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="rounded-xl px-8 text-base"
          >
            Learn More
          </Button>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
```

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/HeroSection.tsx
git commit -m "feat: add HeroSection with animated geometric shapes and CTA"
```

---

### Task 5: Create FeaturesSection Component

**Files:**
- Create: `pacta_appweb/src/components/landing/FeaturesSection.tsx`

**Step 1: Create the FeaturesSection component**

3 feature cards with staggered scroll animations and hover effects:

```tsx
import { motion } from 'framer-motion';
import { FileText, Bell, BarChart3, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: FileText,
    title: 'Contract Management',
    description: 'Create, review, and approve contracts with full version tracking and audit trails.',
  },
  {
    icon: Bell,
    title: 'Expiration Alerts',
    description: 'Never miss a renewal with automated notifications and smart deadline tracking.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Real-time dashboards with contract lifecycle insights and compliance tracking.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
            <span className="text-muted-foreground">Features</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              stay in control
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            PACTA gives you the tools to manage contracts from creation to expiration.
          </p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-6 md:grid-cols-3"
        >
          {features.map((feature, index) => (
            <motion.div key={feature.title} variants={cardVariants}>
              <Card className="group relative h-full overflow-hidden border bg-card/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/5 transition-all duration-300 group-hover:bg-primary/10" />
                <CardHeader>
                  <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span>Learn more</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/FeaturesSection.tsx
git commit -m "feat: add FeaturesSection with staggered scroll animations"
```

---

### Task 6: Replace HomePage with Landing Page

**Files:**
- Modify: `pacta_appweb/src/pages/HomePage.tsx`

**Step 1: Replace HomePage content**

Replace the entire file with the landing page composition:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
    </div>
  );
}
```

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/HomePage.tsx
git commit -m "feat: replace HomePage with full landing page"
```

---

### Task 7: Enhance LoginPage with Animated Logo

**Files:**
- Modify: `pacta_appweb/src/pages/LoginPage.tsx`

**Step 1: Add animated logo and motion to LoginPage**

```tsx
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import { AnimatedLogo } from '@/components/AnimatedLogo';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      {/* Logo */}
      <motion.div
        className="mb-6 cursor-pointer"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        whileHover={{ scale: 1.05 }}
        onClick={() => navigate('/')}
      >
        <AnimatedLogo size="lg" />
      </motion.div>

      {/* Login form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-md"
      >
        <LoginForm />
      </motion.div>
    </div>
  );
}
```

**Step 2: Verify build passes**

Run: `cd pacta_appweb && npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/LoginPage.tsx
git commit -m "feat: add animated PACTA logo to login page"
```

---

### Task 8: Final Build Verification

**Step 1: Run full build**

Run: `cd pacta_appweb && npm run build`
Expected: Successful build with no TypeScript errors and no Vite errors

**Step 2: Run lint**

Run: `cd pacta_appweb && npm run lint`
Expected: No lint errors (or only pre-existing warnings)

**Step 3: Final commit if needed**

```bash
git status
# If any files need committing:
git add -A && git commit -m "chore: final build verification"
```

---

## Summary of Changes

| Task | Files Changed | Type |
|------|--------------|------|
| 1 | `main.tsx` | Modify |
| 2 | `AnimatedLogo.tsx` | Create |
| 3 | `landing/LandingNavbar.tsx` | Create |
| 4 | `landing/HeroSection.tsx` | Create |
| 5 | `landing/FeaturesSection.tsx` | Create |
| 6 | `pages/HomePage.tsx` | Modify |
| 7 | `pages/LoginPage.tsx` | Modify |
| 8 | Build verification | Verify |

**Total**: 4 new files, 3 modified files, 8 tasks
