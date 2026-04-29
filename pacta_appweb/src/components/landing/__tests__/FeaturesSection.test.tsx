import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeaturesSection } from '../FeaturesSection';
import i18n from '@/i18n';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => (props: any) => {
    const tag = props.as || 'div';
    const { children, ...rest } = props;
    // Remove framer-specific props
    delete rest.animate;
    delete rest.variants;
    delete rest.initial;
    delete rest.whileInView;
    delete rest.viewport;
    delete rest.transition;
    delete rest.whileHover;
    delete rest.whileTap;
    delete rest.as;
    return <tag {...rest}>{children}</tag>;
  } }),
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
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

vi.mock('lucide-react', () => ({
  FileText: () => <svg data-testid="icon-filetext" />,
  Bell: () => <svg data-testid="icon-bell" />,
  BarChart3: () => <svg data-testid="icon-barchart" />,
  ArrowRight: () => <svg data-testid="icon-arrowright" />,
}));

describe('FeaturesSection', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders section with features title', () => {
    render(<FeaturesSection />);
    expect(screen.getByText(/Features/i)).toBeInTheDocument();
  });

  it('renders all three feature cards', () => {
    render(<FeaturesSection />);
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
  });

  it('renders feature icons', () => {
    render(<FeaturesSection />);
    expect(screen.getByTestId('icon-filetext')).toBeInTheDocument();
    expect(screen.getByTestId('icon-bell')).toBeInTheDocument();
    expect(screen.getByTestId('icon-barchart')).toBeInTheDocument();
  });

  it('renders learn more links', () => {
    render(<FeaturesSection />);
    const learnMoreLinks = screen.getAllByText(/Learn More/i);
    expect(learnMoreLinks.length).toBeGreaterThan(0);
  });

  it('applies hover effects classes to cards', () => {
    render(<FeaturesSection />);
    const cards = screen.getAllByTestId('card');
    cards.forEach(card => {
      expect(card.className).toContain('group');
      expect(card.className).toContain('hover:border-primary');
    });
  });

  it('has backdrop blur styling on cards', () => {
    render(<FeaturesSection />);
    const cards = screen.getAllByTestId('card');
    cards.forEach(card => {
      expect(card.className).toContain('backdrop-blur-sm');
    });
  });
});
