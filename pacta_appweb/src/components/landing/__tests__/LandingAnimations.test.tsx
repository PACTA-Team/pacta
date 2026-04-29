import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-content" {...props}>{children}</div>
  ),
  CardDescription: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-description" {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-header" {...props}>{children}</div>
  ),
  CardTitle: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-title" {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion" {...props}>{children}</div>
  ),
  AccordionContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion-content" {...props}>{children}</div>
  ),
  AccordionItem: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion-item" {...props}>{children}</div>
  ),
  AccordionTrigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button data-testid="accordion-trigger" {...props}>{children}</button>
  ),
}));

vi.mock('@/components/AnimatedLogo', () => ({
  AnimatedLogo: () => <div data-testid="animated-logo" />,
}));

vi.mock('@/components/LanguageToggle', () => ({
  LanguageToggle: () => <div data-testid="language-toggle" />,
}));

vi.mock('lucide-react', () => ({
  FileText: () => <svg data-testid="icon-filetext" />,
  Bell: () => <svg data-testid="icon-bell" />,
  BarChart3: () => <svg data-testid="icon-barchart" />,
  ArrowRight: () => <svg data-testid="icon-arrowright" />,
  Shield: () => <svg data-testid="icon-shield" />,
  Globe: () => <svg data-testid="icon-globe" />,
  Zap: () => <svg data-testid="icon-zap" />,
  Mail: () => <svg data-testid="icon-mail" />,
  Github: () => <svg data-testid="icon-github" />,
  Menu: () => <svg data-testid="icon-menu" />,
  X: () => <svg data-testid="icon-x" />,
}));

// Import after mocks
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

  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should render hero section with parallax container', () => {
    renderLanding();
    const hero = screen.getByRole('banner');
    expect(hero).toBeInTheDocument();
  });

  it('should render all landing sections', () => {
    renderLanding();
    // Use getAllBy to verify sections exist, then check count
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

  it('should render hero headline with animated text', () => {
    renderLanding();
    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline).toBeInTheDocument();
  });

  it('should render CTA buttons in hero', () => {
    renderLanding();
    // Use getAllBy and check that elements exist
    expect(screen.getAllByText(/start now/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/learn more/i).length).toBeGreaterThan(0);
  });
});
