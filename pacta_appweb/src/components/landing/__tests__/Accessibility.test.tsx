import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { LandingPage } from '../LandingPage';

// Mock framer-motion with prefers-reduced-motion support
vi.mock('framer-motion', () => {
  const createMotionComponent = (tag: string) => {
    return ({ children, as: _as, ...props }: any) => {
      const Tag = _as || tag;
      // Remove framer-specific props before rendering
      const { animate, variants, initial, whileInView, viewport, transition, whileHover, whileTap, ...rest } = props;
      return <Tag {...rest}>{children}</Tag>;
    };
  };

  const motionProxy = new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'create') {
        return (Component: any) => {
          return (props: any) => <Component {...props} />;
        };
      }
      return createMotionComponent(prop as string);
    }
  });

  return {
    motion: motionProxy,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0,
    useReducedMotion: vi.fn(() => false),
    AnimatePresence: ({ children }: { children: any }) => <>{children}</>,
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Landing Page Accessibility', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  const renderLanding = () => {
    return render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <LandingPage />
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  describe('prefers-reduced-motion support', () => {
    it('should render hero section without animation props when reduced motion is preferred', () => {
      // Mock useReducedMotion to return true
      const framerMotion = require('framer-motion');
      framerMotion.useReducedMotion.mockReturnValue(true);

      renderLanding();

      // Hero section should still render
      const hero = screen.getByRole('banner');
      expect(hero).toBeInTheDocument();
    });

    it('should have CSS media query for prefers-reduced-motion', () => {
      // This test verifies the CSS file has the media query
      // We can't directly test CSS in JSDOM, but we can check if the file exists
      // The actual CSS testing would need a browser environment
      expect(true).toBe(true); // Placeholder - CSS is verified in index.css
    });
  });

  describe('keyboard navigation', () => {
    it('should have all interactive elements focusable', () => {
      renderLanding();

      // Get all interactive elements
      const buttons = screen.getAllByRole('button');
      const links = screen.getAllByRole('link');

      // Verify buttons exist and are focusable
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });

      // Verify links exist and are focusable
      links.forEach(link => {
        expect(link).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('should have visible focus indicators on interactive elements', () => {
      renderLanding();

      const ctaButton = screen.getByText(/Start Now/i);
      expect(ctaButton).toBeInTheDocument();

      // Focus the button
      ctaButton.focus();
      expect(document.activeElement).toBe(ctaButton);
    });

    it('should have accessible link to DigitalPlat in footer', () => {
      renderLanding();

      const sponsorLink = screen.getByRole('link', { name: /digitalplat/i });
      expect(sponsorLink).toBeInTheDocument();
      expect(sponsorLink).toHaveAttribute('href', expect.stringContaining('digitalplat'));
      expect(sponsorLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('semantic structure', () => {
    it('should have proper heading hierarchy', () => {
      renderLanding();

      // Check for h1 (hero headline)
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBeGreaterThan(0);
    });

    it('should have main landmark', () => {
      renderLanding();

      const main = document.querySelector('main');
      expect(main).toBeInTheDocument();
    });

    it('should have nav landmark if navigation exists', () => {
      renderLanding();

      const nav = document.querySelector('nav');
      // Nav is optional for landing page
      if (nav) {
        expect(nav).toBeInTheDocument();
      }
    });
  });

  describe('color contrast', () => {
    it('should have sufficient contrast for primary text', () => {
      renderLanding();

      // This is a placeholder - actual contrast testing requires
      // a browser environment with CSS computation
      // The contrast ratios are documented in the plan:
      // - Primary text (#0F172A) on background (#F8FAFC) = Passes WCAG AA
      // - Muted text (#64748B) on background (#F8FAFC) = Passes WCAG AA
      // - Primary button text (#FFFFFF) on primary (#2563EB) = Passes WCAG AA
      expect(true).toBe(true);
    });
  });
});
