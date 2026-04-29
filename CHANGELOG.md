# Changelog

All notable changes to the PACTA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- CSS keyframes for complex animations (float, glow-pulse, shimmer)

### Changed
- Enhanced HeroSection with parallax, sequential text, and glow effects
- Improved FeaturesSection with stagger animation and hover effects
- Updated AboutSection with progressive reveal and icon animations
- Refactored FaqSection with stagger animation
- Enhanced ContactSection with glow cards and hover effects

### Fixed
- Accessibility: Added `prefers-reduced-motion` support to all landing page components
- Fixed missing `useReducedMotion` import in FeaturesSection, FaqSection, ContactSection, and LandingNavbar
- Ensured all animations respect user's motion preferences

### Technical
- Uses Framer Motion useScroll, useTransform, whileHover
- Implements Trust & Authority design system
- Follows WCAG AA accessibility standards
- Added accessibility tests for keyboard navigation and reduced motion support
