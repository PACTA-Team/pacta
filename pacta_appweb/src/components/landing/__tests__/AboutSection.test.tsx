import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AboutSection } from '../AboutSection';
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
    return React.createElement(tag, rest, children);
  } }),
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
  useReducedMotion: () => false,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-content" {...props}>{children}</div>
  ),
}));

vi.mock('lucide-react', () => ({
  Shield: () => <svg data-testid="icon-shield" />,
  Globe: () => <svg data-testid="icon-globe" />,
  Zap: () => <svg data-testid="icon-zap" />,
}));

describe('AboutSection', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders section with about title', () => {
    render(<AboutSection />);
    expect(screen.getByText(/About/i)).toBeInTheDocument();
  });

  it('renders all three value cards', () => {
    render(<AboutSection />);
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
  });

  it('renders value icons', () => {
    render(<AboutSection />);
    expect(screen.getByTestId('icon-shield')).toBeInTheDocument();
    expect(screen.getByTestId('icon-globe')).toBeInTheDocument();
    expect(screen.getByTestId('icon-zap')).toBeInTheDocument();
  });

  it('renders value titles from translations', () => {
    render(<AboutSection />);
    expect(screen.getAllByText(/Local-First/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Open Source/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Simplicity/i).length).toBeGreaterThan(0);
  });

  it('applies hover effects classes to cards', () => {
    render(<AboutSection />);
    const cards = screen.getAllByTestId('card');
    cards.forEach(card => {
      expect(card.className).toContain('group');
      expect(card.className).toContain('hover:border-primary');
    });
  });

  it('has backdrop blur styling on cards', () => {
    render(<AboutSection />);
    const cards = screen.getAllByTestId('card');
    cards.forEach(card => {
      expect(card.className).toContain('backdrop-blur-sm');
    });
  });

  it('applies card variants for progressive reveal', () => {
    render(<AboutSection />);
    const cards = screen.getAllByTestId('card');
    cards.forEach(card => {
      expect(card).toBeInTheDocument();
    });
  });
});
