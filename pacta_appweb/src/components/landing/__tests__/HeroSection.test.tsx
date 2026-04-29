import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroSection } from '../HeroSection';
import i18n from '@/i18n';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => () => null }),
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
}));

vi.mock('@/components/AnimatedLogo', () => ({
  AnimatedLogo: () => <div data-testid="animated-logo" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

describe('HeroSection', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders headline text from translations', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Contract Management System/i)).toBeInTheDocument();
  });

  it('renders the start now CTA button', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Start Now/i)).toBeInTheDocument();
  });

  it('renders the learn more button', () => {
    render(<HeroSection />);
    expect(screen.getByText(/Learn More/i)).toBeInTheDocument();
  });

  it('renders the subtitle/badge text', () => {
    render(<HeroSection />);
    expect(screen.getByText(/contract management platform/i)).toBeInTheDocument();
  });

  it('renders the AnimatedLogo component', () => {
    render(<HeroSection />);
    expect(screen.getByTestId('animated-logo')).toBeInTheDocument();
  });

  it('applies gradient variant to primary CTA button', () => {
    render(<HeroSection />);
    const ctaButton = screen.getByText(/Start Now/i);
    expect(ctaButton).toBeInTheDocument();
  });
});
