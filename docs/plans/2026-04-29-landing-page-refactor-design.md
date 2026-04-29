# Landing Page Refactor Design - Pacta

**Date**: 2026-04-29  
**Based on**: Tutorial "Cómo utilizar Claude para animaciones web bidimensionales"  
**Design System**: Trust & Authority (SaaS Professional) via UI/UX Pro Max  
**Target**: React + Framer Motion + Tailwind CSS

---

## 1. Design System (from UI/UX Pro Max)

### Pattern
- **Name**: Trust & Authority + Minimal
- **CTA Placement**: Above fold
- **Sections**: Hero > Features > CTA

### Style
- **Name**: Trust & Authority
- **Mode Support**: Light ✓ Full | Dark ✓ Full
- **Keywords**: Certificates/badges displayed, expert credentials, case studies with metrics, before/after comparisons, industry recognition, security badges
- **Best For**: Healthcare/medical landing pages, financial services, enterprise software, premium/luxury products, legal services
- **Performance**: ⚡ Excellent | **Accessibility**: ✓ WCAG AAA

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#2563EB` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| Accent/CTA | `#059669` | `--color-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#0F172A` | `--color-foreground` |
| Muted | `#F1F5FD` | `--color-muted` |
| Border | `#E4ECFC` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#2563EB` | `--color-ring` |

### Typography
- **Heading**: Plus Jakarta Sans
- **Body**: Plus Jakarta Sans
- **Mood**: friendly, modern, saas, clean, approachable, professional
- **Best For**: SaaS products, web apps, dashboards, B2B, productivity tools
- **Google Fonts**: https://fonts.google.com/share?selection.family=Plus+Jakarta+Sans:wght@300;400;500;600;700

### Key Effects
Badge hover effects, metric pulse animations, certificate carousel, smooth stat reveal

### Anti-Patterns (Avoid)
- Outdated design
- Hidden credentials
- AI purple/pink gradients

---

## 2. Tutorial Animation Features to Implement

### 2.1 Floating/Bounce Effects (Fotogramas clave CSS)
**Implementation**:
- Enhance `ElegantShape` component in `HeroSection.tsx`
- Add bounce effect using Framer Motion `y: [0, 12, 0]` with `transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' }`
- Create varying float durations (8-12s) and distances for visual interest
- Add rotation float for some elements: `rotate: [0, 5, 0, -5, 0]`

**Location**: `HeroSection.tsx` - `ElegantShape` component

### 2.2 Progressive Appearance on Scroll (Aparición progresiva al desplazamiento vertical)
**Implementation**:
- Use Framer Motion `useScroll` + `useTransform` for scroll-triggered animations
- Implement word-by-word text reveal using `motion.span` with staggered delays
- Add `viewport: { once: true }` to `whileInView` for one-time animations
- Use `staggerChildren` in container variants for sequential child animation

**Components to modify**:
- `HeroSection.tsx` - Headline text
- `FeaturesSection.tsx` - Feature cards
- `AboutSection.tsx` - Value cards
- `FaqSection.tsx` - Accordion items
- `ContactSection.tsx` - Contact cards

### 2.3 Parallax Effects (Efecto paralaje en fondos)
**Implementation**:
- Create parallax background shapes using `useScroll` + `useTransform`
- Multiple layers at different speeds (far: 0.2, middle: 0.5, near: 0.8 parallax factor)
- Background gradient that shifts on scroll: `opacity: useTransform(scrollY, [0, 500], [1, 0.3])`
- Floating geometric shapes with different scroll speeds for depth effect

**Location**: `HeroSection.tsx` - Add parallax background layer

### 2.4 Interactive Hover Effects (Efectos interactivos al pasar el cursor)
**Button Glow Effect**:
```tsx
<motion.button
  whileHover={{
    scale: 1.05,
    boxShadow: "0 0 20px rgba(37, 99, 235, 0.3)",
    transition: { duration: 0.3 }
  }}
  whileTap={{ scale: 0.95 }}
>
```

**Scale + Rotation on Cards**:
```tsx
<motion.div
  whileHover={{
    y: -8,
    scale: 1.02,
    rotate: 0.5,
    transition: { duration: 0.3, ease: 'easeOut' }
  }}
>
```

**Location**:
- `HeroSection.tsx` - Primary CTA button
- `FeaturesSection.tsx` - Feature cards
- `AboutSection.tsx` - Value cards
- `LandingFooter.tsx` - Sponsor badge (already added)

### 2.5 Sequential Text Animation (Animación secuencial de texto palabra por palabra)
**Implementation** (based on "Magic Text" from 21st.dev):
```tsx
const Word = ({ children, progress, range }) => {
  const opacity = useTransform(progress, range, [0, 1]);
  return (
    <span className="relative mr-1">
      <span className="absolute opacity-20">{children}</span>
      <motion.span style={{ opacity }}>{children}</motion.span>
    </span>
  );
};

// Usage with scroll progress
{words.map((word, i) => {
  const start = i / words.length;
  const end = start + 1 / words.length;
  return (
    <Word key={i} progress={scrollYProgress} range={[start, end]}>
      {word}
    </Word>
  );
})}
```

**Location**: `HeroSection.tsx` - Main headline "Gestiona contratos..." 

---

## 3. Component Modifications

### 3.1 HeroSection.tsx
**Changes**:
1. Add parallax background container with 3-4 layered shapes
2. Enhance `ElegantShape` with varied floating animations (bounce + rotation)
3. Implement sequential word-by-word animation for headline
4. Add glow + scale hover effect to primary CTA button
5. Add `useScroll` + `useTransform` for parallax effects

**New animations**:
- Parallax background: `y: useTransform(scrollY, [0, 500], [0, -100])`
- Sequential text: Word-by-word reveal on scroll
- Enhanced float: `y: [0, 15, 0]` + `rotate: [0, 3, 0, -3, 0]`
- Button glow: `boxShadow: "0 0 30px rgba(37, 99, 235, 0.4)"` on hover

### 3.2 FeaturesSection.tsx
**Changes**:
1. Add stagger animation to feature cards using `containerVariants`
2. Enhance card hover with glow border + scale + slight rotation
3. Add icon rotation on card hover
4. Implement progressive appearance on scroll with `whileInView`

**New animations**:
```tsx
<motion.div
  variants={cardVariants}
  whileHover={{
    y: -8,
    scale: 1.02,
    rotate: 0.5,
    boxShadow: "0 20px 40px rgba(37, 99, 235, 0.15)"
  }}
>
```

### 3.3 AboutSection.tsx
**Changes**:
1. Add staggered animation to value cards
2. Enhance icon animation (pulse + rotate on hover)
3. Add progressive reveal on scroll

### 3.4 FaqSection.tsx
**Changes**:
1. Add staggered animation to accordion items
2. Smooth expand/collapse transitions
3. Add scroll-triggered appearance

### 3.5 ContactSection.tsx
**Changes**:
1. Add scale + glow effect to contact cards
2. Icon animation on hover
3. Progressive appearance on scroll

### 3.6 LandingFooter.tsx (✅ COMPLETED)
**Changes already applied**:
- Added DigitalPlat FreeDomain sponsor badge
- Subtle design with `hover:-translate-y-0.5` and `hover:shadow-md`
- Uses primary color scheme (`bg-primary/10`)
- Small, non-abusive typography (11px)
- i18n ready with translation keys

---

## 4. Technical Implementation Details

### 4.1 Framer Motion Patterns
```tsx
// Scroll-triggered animation
const containerRef = useRef(null);
const { scrollYProgress } = useScroll({
  target: containerRef,
  offset: ["start 0.9", "end 0.2"]
});

// Parallax transform
const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

// Hover animation
whileHover={{
  scale: 1.05,
  boxShadow: "0 0 20px rgba(37, 99, 235, 0.3)",
  transition: { duration: 0.3, ease: 'easeOut' }
}}
```

### 4.2 CSS Keyframes (for complex animations)
```css
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-10px) rotate(2deg); }
  50% { transform: translateY(-5px) rotate(-1deg); }
  75% { transform: translateY(-15px) rotate(3deg); }
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(37, 99, 235, 0.2); }
  50% { box-shadow: 0 0 25px rgba(37, 99, 235, 0.4); }
}
```

### 4.3 Accessibility Considerations
- Respect `prefers-reduced-motion` media query
- Use `min-height: 44x44px` for touch targets
- Maintain 4.5:1 contrast ratio (WCAG AA)
- Add `aria-label` to animated elements
- Ensure keyboard navigation works with animated elements

---

## 5. File Structure

```
pacta_appweb/src/components/landing/
├── HeroSection.tsx        (Modify: parallax, float, sequential text, glow)
├── FeaturesSection.tsx    (Modify: stagger, hover glow, scale)
├── AboutSection.tsx       (Modify: stagger, icon animation)
├── FaqSection.tsx        (Modify: stagger, smooth transitions)
├── ContactSection.tsx    (Modify: glow cards, hover effects)
├── LandingNavbar.tsx     (Keep as-is, already has good animations)
├── LandingFooter.tsx     (✅ COMPLETED: sponsor badge added)
└── __tests__/           (Add tests for new animations)
```

---

## 6. Implementation Order

1. ✅ **LandingFooter.tsx** - Sponsor badge (COMPLETED)
2. **HeroSection.tsx** - Parallax, sequential text, enhanced float
3. **FeaturesSection.tsx** - Card hover effects, stagger animations
4. **AboutSection.tsx** - Value card animations
5. **FaqSection.tsx** - Accordion stagger
6. **ContactSection.tsx** - Contact card effects
7. **index.css** - Add Plus Jakarta Sans import + keyframes
8. **Test** - Verify all animations work correctly

---

## 7. Success Criteria

- [ ] Parallax background effect visible on scroll
- [ ] Sequential word-by-word text animation in hero
- [ ] Floating/bouncing shapes with varied timing
- [ ] Button glow + scale effects on hover
- [ ] Card hover with glow, scale, and rotation
- [ ] Progressive appearance on scroll for all sections
- [ ] Sponsor badge displays correctly (✅ done)
- [ ] Respects `prefers-reduced-motion`
- [ ] Works in both light and dark modes
- [ ] No horizontal scroll on mobile
- [ ] All animations complete within 300-500ms (per UX guidelines)

---

**Design approved**: Ready for implementation  
**Next step**: Use `writing-plans` skill to create detailed implementation plan
