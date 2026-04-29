# Landing Page Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor Pacta's landing page to implement 5 tutorial animation techniques: floating/bounce effects, progressive scroll appearance, parallax backgrounds, interactive hover effects (glow, scale, rotation), and sequential text animations.

**Architecture:** Enhance existing landing page components (HeroSection, FeaturesSection, AboutSection, FaqSection, ContactSection) with Framer Motion animations. Add Plus Jakarta Sans font. Use CSS keyframes for complex animations. Follow Trust & Authority design system (professional SaaS style).

**Tech Stack:** React, Framer Motion, Tailwind CSS, Plus Jakarta Sans (Google Fonts), TypeScript

---

## Pre-Implementation Setup

### Task 0: Environment Verification

**Files:**
- Read: `pacta_appweb/package.json`
- Read: `pacta_appweb/src/index.css`
- Read: `pacta_appweb/tailwind.config.ts` (if exists)

**Step 1: Verify Framer Motion is installed**

```bash
cd pacta_appweb && npm list framer-motion
```

Expected: `framer-motion@11.x.x` (or similar version)

**Step 2: Verify Tailwind CSS is configured**

```bash
cd pacta_appweb && npm list tailwindcss
```

Expected: `tailwindcss@3.x.x`

**Step 3: Check if Plus Jakarta Sans needs to be added**

Read `pacta_appweb/src/index.css` - check if Plus Jakarta Sans is imported.

If not present, add to `index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

Also update tailwind config or `index.css` theme:
```css
--font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
```

**Step 4: Commit (if font added)**

```bash
git add pacta_appweb/src/index.css
git commit -m "style: add Plus Jakarta Sans font for landing page design system"
```

---

## Task 1: HeroSection - Parallax Background + Sequential Text

**Files:**
- Modify: `pacta_appweb/src/components/landing/HeroSection.tsx`
- Reference: `docs/plans/2026-04-29-landing-page-refactor-design.md`

**Step 1: Add parallax background shapes**

Add new state and hooks at top of HeroSection component:

```tsx
const heroRef = useRef(null);
const { scrollYProgress } = useScroll({
  target: heroRef,
  offset: ["start start", "end start"]
});

// Parallax transforms
const bgY = useTransform(scrollYProgress, [0, 1], [0, -100]);
const shape1Y = useTransform(scrollYProgress, [0, 1], [0, -150]);
const shape2Y = useTransform(scrollYProgress, [0, 1], [0, -80]);
const shape3Y = useTransform(scrollYProgress, [0, 1], [0, -200]);
```

**Step 2: Wrap hero section with ref**

```tsx
<section ref={heroRef} className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
```

**Step 3: Add parallax to background gradient**

```tsx
<div 
  style={{ y: bgY }}
  className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" 
/>
```

**Step 4: Update ElegantShape with enhanced floating animation**

Replace existing `floatAnimation`:
```tsx
const floatAnimation = {
  y: [0, 15, 0, -10, 0],
  rotate: [0, 3, 0, -3, 0],
  transition: { 
    duration: 12, 
    repeat: Infinity, 
    ease: 'easeInOut' as const,
    times: [0, 0.25, 0.5, 0.75, 1]
  },
};
```

**Step 5: Implement sequential text animation for headline**

Replace the headline motion.h1 with word-by-word animation:

```tsx
{motion.h1}
  variants={fadeUpVariants}
  initial="hidden"
  animate="visible"
  transition={{ delay: 0.4 }}
  className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl md:leading-tight"
>
  <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
    {t('hero.title').split(' ').map((word, i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ 
          delay: 0.4 + (i * 0.1),
          duration: 0.6,
          ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number]
        }}
        className="inline-block mr-2"
      >
        {word}
      </motion.span>
    ))}
  </span>
</motion.h1>
```

**Step 6: Add glow effect to primary CTA button**

Update the primary button:
```tsx
<Button
  size="lg"
  variant="gradient"
  onClick={() => navigate('/login')}
  className="group rounded-xl px-8 text-base"
  whileHover={{
    scale: 1.05,
    boxShadow: "0 0 30px rgba(37, 99, 235, 0.4)",
    transition: { duration: 0.3 }
  }}
  whileTap={{ scale: 0.95 }}
>
  {t('hero.startNow')}
  <motion.div
    animate={{ x: [0, 5, 0] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  >
    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
  </motion.div>
</Button>
```

**Step 7: Run dev server to verify**

```bash
cd pacta_appweb && npm run dev
```

Expected: 
- Parallax effect when scrolling down
- Words in headline appear sequentially with blur removal
- Floating shapes bounce with rotation
- CTA button glows on hover

**Step 8: Commit**

```bash
git add pacta_appweb/src/components/landing/HeroSection.tsx
git commit -m "feat(landing): add parallax, sequential text, and glow effects to hero section

- Add parallax background using useScroll + useTransform
- Implement word-by-word text animation with staggered delays
- Enhance floating shapes with bounce + rotation
- Add glow effect to primary CTA button"
```

---

## Task 2: FeaturesSection - Stagger Animation + Hover Effects

**Files:**
- Modify: `pacta_appweb/src/components/landing/FeaturesSection.tsx`

**Step 1: Enhance card variants with hover effects**

Update `cardVariants`:
```tsx
const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};
```

**Step 2: Add hover glow + scale + rotation to Card component**

Replace the Card element:
```tsx
<motion.div
  key={feature.title}
  variants={cardVariants}
  whileHover={{
    y: -8,
    scale: 1.02,
    rotate: 0.5,
    boxShadow: "0 20px 40px rgba(37, 99, 235, 0.15)",
    transition: { duration: 0.3, ease: 'easeOut' }
  }}
  whileTap={{ scale: 0.98 }}
>
  <Card className="group relative h-full overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/20">
    <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 transition-all duration-300 group-hover:from-primary/10 group-hover:to-accent/10 group-hover:scale-110" />
    {/* Rest of card content stays the same */}
  </Card>
</motion.div>
```

**Step 3: Add icon rotation on hover**

Update the icon container:
```tsx
<motion.div 
  className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20"
  whileHover={{ 
    rotate: 5,
    scale: 1.1,
    transition: { duration: 0.3 }
  }}
>
  <feature.icon className="h-6 w-6 text-primary" />
</motion.div>
```

**Step 4: Run dev server to verify**

```bash
cd pacta_appweb && npm run dev
```

Expected:
- Feature cards stagger in on scroll
- Cards lift, scale, and rotate slightly on hover
- Glow shadow appears on hover
- Icons rotate slightly on card hover

**Step 5: Commit**

```bash
git add pacta_appweb/src/components/landing/FeaturesSection.tsx
git commit -m "feat(landing): add stagger animation and hover effects to feature cards

- Enhance card animation with scale transition
- Add hover effects: lift, scale, rotation, glow shadow
- Add icon rotation animation on card hover
- Maintain scroll-triggered staggered appearance"
```

---

## Task 3: AboutSection - Progressive Reveal + Icon Animations

**Files:**
- Modify: `pacta_appweb/src/components/landing/AboutSection.tsx`

**Step 1: Update card variants for progressive reveal**

```tsx
const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};
```

**Step 2: Add hover effects to value cards**

Replace the Card in the map function:
```tsx
<motion.div key={key} variants={cardVariants}>
  <motion.div
    whileHover={{
      y: -4,
      scale: 1.02,
      boxShadow: "0 10px 30px rgba(37, 99, 235, 0.1)",
      transition: { duration: 0.3 }
    }}
  >
    <Card className="group h-full overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/20">
      <CardContent className="pt-6">
        <motion.div 
          className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20"
          whileHover={{ 
            scale: 1.15,
            rotate: 10,
            transition: { duration: 0.3, type: 'spring', stiffness: 300 }
          }}
        >
          <Icon className="h-6 w-6 text-primary" />
        </motion.div>
        <h3 className="mb-2 text-lg font-semibold">{t(`about.values.${key}.title`)}</h3>
        <p className="text-sm text-muted-foreground">
          {t(`about.values.${key}.description`)}
        </p>
      </CardContent>
    </Card>
  </motion.div>
</motion.div>
```

**Step 3: Run dev server to verify**

```bash
cd pacta_appweb && npm run dev
```

Expected:
- Value cards appear progressively on scroll
- Cards lift slightly on hover with glow
- Icons scale up and rotate on hover

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/landing/AboutSection.tsx
git commit -m "feat(landing): add progressive reveal and hover effects to about section

- Implement progressive appearance on scroll
- Add hover effects: lift, scale, glow to value cards
- Add icon scale and rotation animation
- Use spring physics for icon animation"
```

---

## Task 4: FaqSection - Stagger + Smooth Transitions

**Files:**
- Modify: `pacta_appweb/src/components/landing/FaqSection.tsx`

**Step 1: Add stagger animation to accordion items**

Update the motion.div wrapping each accordion item:
```tsx
<motion.div
  key={index}
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-50px' }}
  transition={{ 
    duration: 0.5, 
    delay: index * 0.1,
    ease: 'easeOut' as const
  }}
>
  <AccordionItem value={`item-${index}`} className="border-b border-border/50">
    <AccordionTrigger className="text-left text-base font-medium hover:text-primary transition-colors">
      {item.question}
    </AccordionTrigger>
    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
      {item.answer}
    </AccordionContent>
  </AccordionItem>
</motion.div>
```

**Step 2: Add smooth expand/collapse transition**

The Accordion component from radix-ui already has smooth transitions, but we can enhance it by adding a className:
```tsx
<Accordion type="single" collapsible className="w-full">
```

**Step 3: Run dev server to verify**

```bash
cd pacta_appweb && npm run dev
```

Expected:
- FAQ items stagger in on scroll
- Each item fades up with slight delay
- Accordion expand/collapse is smooth

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/landing/FaqSection.tsx
git commit -m "feat(landing): add stagger animation to FAQ section

- Implement staggered appearance for accordion items
- Add smooth fade-up transition on scroll
- Enhance accordion with hover effect on trigger"
```

---

## Task 5: ContactSection - Glow Cards + Hover Effects

**Files:**
- Modify: `pacta_appweb/src/components/landing/ContactSection.tsx`

**Step 1: Add glow + scale effect to contact cards**

Update the Card component:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
  className="mx-auto max-w-2xl text-center"
>
  {/* Section header - same as before */}

  <motion.div
    whileHover={{
      y: -8,
      scale: 1.02,
      transition: { duration: 0.3, ease: 'easeOut' }
    }}
  >
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 transition-all duration-300 hover:shadow-lg hover:border-primary/40">
      <CardContent className="flex flex-col items-center gap-6 pt-8 sm:flex-row sm:justify-center sm:gap-10">
        {/* Email */}
        <motion.a
          href="mailto:pactateam@gmail.com"
          className="group flex flex-col items-center gap-2 text-center"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 transition-colors group-hover:from-primary/30">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <span className="text-sm font-medium">{t('contact.email')}</span>
          <span className="text-xs text-muted-foreground">{t('contact.emailAddress')}</span>
        </motion.a>

        {/* GitHub */}
        <motion.a
          href="https://github.com/PACTA-Team/pacta"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-2 text-center"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/80 transition-colors group-hover:from-muted/80">
            <Github className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium">{t('contact.github')}</span>
          <span className="text-xs text-muted-foreground">{t('contact.githubDesc')}</span>
        </motion.a>
      </CardContent>
    </Card>
  </motion.div>
</motion.div>
```

**Step 2: Run dev server to verify**

```bash
cd pacta_appweb && npm run dev
```

Expected:
- Contact section fades in on scroll
- Card lifts and scales on hover
- Email and GitHub links scale on hover
- Smooth transitions on all interactions

**Step 3: Commit**

```bash
git add pacta_appweb/src/components/landing/ContactSection.tsx
git commit -m "feat(landing): add glow and hover effects to contact section

- Add scale and lift animation to contact card
- Add hover effects to email and GitHub links
- Implement progressive appearance on scroll"
```

---

## Task 6: LandingFooter - Verify Sponsor Badge

**Files:**
- Read: `pacta_appweb/src/components/landing/LandingFooter.tsx` (✅ already implemented)

**Step 1: Verify sponsor badge renders correctly**

```bash
cd pacta_appweb && npm run dev
```

Expected:
- DigitalPlat sponsor badge appears at bottom of footer
- Badge has subtle hover effect (lift + shadow)
- Uses small, non-abusive typography
- Link opens DigitalPlat in new tab

**Step 2: No changes needed (✅ COMPLETED in previous session)**

---

## Task 7: CSS Keyframes for Complex Animations

**Files:**
- Modify: `pacta_appweb/src/index.css`

**Step 1: Add custom keyframes for tutorial effects**

Add to `index.css` before the `@layer base` section:

```css
@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-10px) rotate(2deg);
  }
  50% {
    transform: translateY(-5px) rotate(-1deg);
  }
  75% {
    transform: translateY(-15px) rotate(3deg);
  }
}

@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(37, 99, 235, 0.2);
  }
  50% {
    box-shadow: 0 0 25px rgba(37, 99, 235, 0.4);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
```

**Step 2: Add Plus Jakarta Sans import (if not already present)**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

@theme inline {
  --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  /* rest of theme */
}
```

**Step 3: Run dev server to verify**

```bash
cd pacta_appweb && npm run dev
```

Expected:
- Custom keyframes available for use
- Plus Jakarta Sans font loads correctly
- No CSS errors

**Step 4: Commit**

```bash
git add pacta_appweb/src/index.css
git commit -m "style: add CSS keyframes and Plus Jakarta Sans for landing page

- Add float, glow-pulse, and shimmer keyframes
- Import Plus Jakarta Sans from Google Fonts
- Configure font as default sans font in theme"
```

---

## Task 8: Integration Test - All Animations

**Files:**
- Create: `pacta_appweb/src/components/landing/__tests__/LandingAnimations.test.tsx`

**Step 1: Write integration test**

```tsx
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { LandingPage } from '../LandingPage';

describe('Landing Page Animations', () => {
  const renderLanding = () => {
    render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <LandingPage />
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  it('should render hero section with parallax container', () => {
    renderLanding();
    const hero = screen.getByRole('banner');
    expect(hero).toBeInTheDocument();
  });

  it('should render all landing sections', () => {
    renderLanding();
    expect(screen.getByText(/features/i)).toBeInTheDocument();
    expect(screen.getByText(/about/i)).toBeInTheDocument();
    expect(screen.getByText(/faq/i)).toBeInTheDocument();
    expect(screen.getByText(/contact/i)).toBeInTheDocument();
  });

  it('should have sponsor badge in footer', () => {
    renderLanding();
    const sponsorLink = screen.getByRole('link', { name: /digitalplat/i });
    expect(sponsorLink).toBeInTheDocument();
    expect(sponsorLink).toHaveAttribute('href', expect.stringContaining('digitalplat'));
  });
});
```

**Step 2: Run test to verify it fails (TDD)**

```bash
cd pacta_appweb && npm test -- --testPathPattern=LandinAnimations
```

Expected: FAIL (if LandingPage component doesn't exist yet or test has issues)

**Step 3: Fix any issues and re-run**

```bash
cd pacta_appweb && npm test -- --testPathPattern=LandinAnimations
```

Expected: PASS

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/landing/__tests__/LandinAnimations.test.tsx
git commit -m "test(landing): add integration test for landing page animations"
```

---

## Task 9: Accessibility Audit

**Step 1: Check prefers-reduced-motion support**

Verify all animations respect `prefers-reduced-motion`:
- Framer Motion's `whileInView` and `whileHover` should not fire when reduced motion is preferred
- CSS animations should have `@media (prefers-reduced-motion: reduce) { animation: none; }`

**Step 2: Verify keyboard navigation**

```bash
cd pacta_appweb && npm run dev
```

Test with keyboard:
- Tab through all interactive elements
- Verify focus states are visible
- Ensure all buttons and links are reachable

**Step 3: Check color contrast**

Verify all text meets WCAG AA (4.5:1 contrast ratio):
- Primary text on background: `#0F172A` on `#F8FAFC` = ✅ Passes
- Muted text on background: `#64748B` on `#F8FAFC` = ✅ Passes
- Primary button text: `#FFFFFF` on `#2563EB` = ✅ Passes

**Step 4: Commit accessibility fixes (if any)**

```bash
git add -A
git commit -m "fix(landing): improve accessibility for animation components

- Ensure animations respect prefers-reduced-motion
- Verify keyboard navigation works
- Confirm color contrast meets WCAG AA"
```

---

## Task 10: Final Verification + Documentation

**Step 1: Run full test suite**

```bash
cd pacta_appweb && npm test
```

Expected: All tests PASS

**Step 2: Build check (CI simulation - but don't run locally per AGENTS.md)**

Review the build process from `AGENTS.md`:
```bash
# This runs in CI, NOT locally:
# cd pacta_appweb && npm ci && npm run build
# cp -r pacta_appweb/dist cmd/pacta/dist
# go mod tidy
# go build ./...
```

**Step 3: Create CHANGELOG entry**

Add to `CHANGELOG.md` (if exists) or create it:

```markdown
## [Unreleased]

### Added
- Landing page refactor with 5 tutorial animation techniques:
  - Floating/bounce effects in hero section
  - Progressive appearance on scroll for all sections
  - Parallax background effects
  - Interactive hover effects (glow, scale, rotation)
  - Sequential text animation (word-by-word)
- DigitalPlat FreeDomain sponsor badge in footer
- Plus Jakarta Sans font integration
- CSS keyframes for complex animations

### Changed
- Enhanced HeroSection with parallax, sequential text, and glow effects
- Improved FeaturesSection with stagger animation and hover effects
- Updated AboutSection with progressive reveal and icon animations
- Refactored FaqSection with stagger animation
- Enhanced ContactSection with glow cards and hover effects

### Technical
- Uses Framer Motion useScroll, useTransform, whileHover
- Implements Trust & Authority design system
- Follows WCAG AA accessibility standards
```

**Step 4: Final commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG with landing page refactor details"
```

**Step 5: Push to branch (if ready)**

```bash
git push origin <your-branch-name>
```

---

## Summary of Changes

| Task | Component | Animation Features Added |
|------|-----------|----------------------|
| 1 | HeroSection | Parallax background, sequential text, floating bounce, button glow |
| 2 | FeaturesSection | Stagger animation, card hover (lift, scale, rotate, glow), icon rotation |
| 3 | AboutSection | Progressive reveal, card hover effects, icon animations |
| 4 | FaqSection | Stagger animation, smooth transitions |
| 5 | ContactSection | Glow cards, hover effects, scale animations |
| 6 | LandingFooter | ✅ Sponsor badge (completed) |
| 7 | index.css | Keyframes (float, glow-pulse, shimmer), Plus Jakarta Sans |
| 8 | Tests | Integration test for landing animations |
| 9 | Accessibility | prefers-reduced-motion, keyboard nav, contrast |
| 10 | Documentation | CHANGELOG, final verification |

---

**Plan complete and saved to `docs/plans/2026-04-29-landing-page-refactor-implementation.md`.**

**Three execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**3. Plan-to-Issues (team workflow)** - Convert plan tasks to GitHub issues for team distribution

Which approach?
