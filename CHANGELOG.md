# Changelog

All notable changes to the PACTA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Landing Page Refactor** — Complete redesign with 5 tutorial animation techniques:
  - Floating/bounce effects in HeroSection (Framer Motion infinite animations)
  - Progressive scroll appearance with stagger animations for all sections
  - Parallax background gradient using `useScroll` + `useTransform`
  - Interactive hover effects: glow, scale, rotation on buttons/cards/icons
  - Sequential text animation (word-by-word reveal) in hero headline
- Plus Jakarta Sans font integration from Google Fonts
- Custom CSS keyframes (`float`, `glow-pulse`, `shimmer`) for complex animations
- DigitalPlat FreeDomain sponsor badge in LandingFooter
- Comprehensive accessibility tests (`Accessibility.test.tsx`)

### Changed
- Enhanced HeroSection with parallax, sequential text, and glow CTA effects
- Improved FeaturesSection with card hover lift/scale/rotation and icon animation
- Updated AboutSection with progressive reveal and spring-physics icon rotation
- Refactored FaqSection with staggered accordion appearance on scroll
- Enhanced ContactSection with glow cards and link hover animations

### Fixed
- Accessibility: All animations respect `prefers-reduced-motion`
- Added missing imports (`useReducedMotion`, `MotionValue`) across landing components
- Test mocks updated to use `React.createElement` for dynamic tags
- TypeScript compilation errors resolved

### Technical
- Framework: Framer Motion `useScroll`, `useTransform`, `whileHover`
- Design System: Trust & Authority with WCAG AA compliance
- Testing: Integration + accessibility tests for keyboard navigation and reduced motion
- CI: Passing builds on all branches

