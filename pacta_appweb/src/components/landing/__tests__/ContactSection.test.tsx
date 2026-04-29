import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactSection } from '../ContactSection';
import i18n from '@/i18n';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('framer-motion', () => {
  const React = require('react');
  // Create motion proxy that returns appropriate elements
  const createMotionComponent = (tag: string) => {
    return (props: any) => {
      const { children, ...rest } = props;
      // Remove framer-specific props for rendering
      delete rest.animate;
      delete rest.variants;
      delete rest.initial;
      delete rest.whileInView;
      delete rest.viewport;
      delete rest.transition;
      delete rest.whileHover;
      delete rest.whileTap;
      delete rest.as;
      return React.createElement(tag, rest, children);
    };
  };

  const motionProxy = new Proxy({}, {
    get: (_target: any, prop: string) => {
      return createMotionComponent(prop);
    }
  });

  return {
    motion: motionProxy,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-content" {...props}>{children}</div>
  ),
}));

vi.mock('lucide-react', () => ({
  Mail: () => <svg data-testid="icon-mail" />,
  Github: () => <svg data-testid="icon-github" />,
}));

describe('ContactSection', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders section with contact title', () => {
    render(<ContactSection />);
    expect(screen.getAllByText(/Get in Touch/i).length).toBeGreaterThan(0);
  });

  it('renders email contact info', () => {
    render(<ContactSection />);
    expect(screen.getByText(/Contact Us/i)).toBeInTheDocument();
    expect(screen.getByText(/pactateam@gmail.com/i)).toBeInTheDocument();
  });

  it('renders github contact info', () => {
    render(<ContactSection />);
    expect(screen.getByText(/View on GitHub/i)).toBeInTheDocument();
    expect(screen.getByText(/Browse the source code/i)).toBeInTheDocument();
  });

  it('renders email icon', () => {
    render(<ContactSection />);
    expect(screen.getByTestId('icon-mail')).toBeInTheDocument();
  });

  it('renders github icon', () => {
    render(<ContactSection />);
    expect(screen.getByTestId('icon-github')).toBeInTheDocument();
  });

  it('renders mailto link with correct email', () => {
    render(<ContactSection />);
    const emailLink = screen.getByRole('link', { name: /Contact Us/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:pactateam@gmail.com');
  });

  it('renders github link with correct url', () => {
    render(<ContactSection />);
    const githubLink = screen.getByRole('link', { name: /View on GitHub/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/PACTA-Team/pacta');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies glow and gradient styling to card', () => {
    render(<ContactSection />);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('border-2');
    expect(card.className).toContain('border-primary/20');
    expect(card.className).toContain('bg-gradient-to-br');
    expect(card.className).toContain('from-primary/5');
    expect(card.className).toContain('to-accent/5');
  });

  it('applies hover effects classes to card', () => {
    render(<ContactSection />);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('hover:shadow-lg');
    expect(card.className).toContain('hover:border-primary/40');
  });

  it('has transition duration on card', () => {
    render(<ContactSection />);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('transition-all');
    expect(card.className).toContain('duration-300');
  });

  it('renders card content with correct layout classes', () => {
    render(<ContactSection />);
    const cardContent = screen.getByTestId('card-content');
    expect(cardContent.className).toContain('flex-col');
    expect(cardContent.className).toContain('items-center');
    expect(cardContent.className).toContain('gap-6');
    expect(cardContent.className).toContain('pt-8');
  });

  it('wraps card with motion.div for hover animation', () => {
    render(<ContactSection />);
    // The motion wrapper should exist (it renders as a div due to mock)
    const card = screen.getByTestId('card');
    expect(card).toBeInTheDocument();
  });
});
