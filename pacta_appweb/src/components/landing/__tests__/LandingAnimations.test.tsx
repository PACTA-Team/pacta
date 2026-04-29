import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { LandingPage } from '../LandingPage';

// Mock framer-motion to avoid animation issues in tests
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
      // Handle motion.create() method
      if (prop === 'create') {
        return (Component: any) => {
          return (props: any) => <Component {...props} />;
        };
      }
      // For motion.div, motion.h1, etc. - return component that renders correct HTML element
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

// Mock react-router-dom's useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

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
    // Use getAllByText and check length to handle multiple matches
    expect(screen.getAllByText(/features/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/about/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/faq/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/contact/i).length).toBeGreaterThan(0);
  });

  it('should have sponsor badge in footer', () => {
    renderLanding();
    const sponsorLink = screen.getByRole('link', { name: /digitalplat/i });
    expect(sponsorLink).toBeInTheDocument();
    expect(sponsorLink).toHaveAttribute('href', expect.stringContaining('digitalplat'));
  });
});
