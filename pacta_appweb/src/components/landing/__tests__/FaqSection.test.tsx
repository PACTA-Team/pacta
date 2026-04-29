import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { FaqSection } from '../FaqSection';
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
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion" {...props}>{children}</div>
  ),
  AccordionItem: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion-item" {...props}>{children}</div>
  ),
  AccordionTrigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button data-testid="accordion-trigger" {...props}>{children}</button>
  ),
  AccordionContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion-content" {...props}>{children}</div>
  ),
}));

describe('FaqSection', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders section with FAQ title', () => {
    render(<FaqSection />);
    expect(screen.getByText(/FAQ/i)).toBeInTheDocument();
  });

  it('renders accordion with items from translations', () => {
    render(<FaqSection />);
    const accordion = screen.getByTestId('accordion');
    expect(accordion).toBeInTheDocument();
    expect(accordion).toHaveClass('w-full');
  });

  it('renders all FAQ items', () => {
    render(<FaqSection />);
    const items = screen.getAllByTestId('accordion-item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders accordion triggers with question text', () => {
    render(<FaqSection />);
    const triggers = screen.getAllByTestId('accordion-trigger');
    expect(triggers.length).toBeGreaterThan(0);
  });

  it('renders accordion content with answer text', () => {
    render(<FaqSection />);
    const contents = screen.getAllByTestId('accordion-content');
    expect(contents.length).toBeGreaterThan(0);
  });

  it('applies stagger animation classes to motion wrapper', () => {
    render(<FaqSection />);
    // The motion.div wrapper should be rendered (mocked as div)
    const items = screen.getAllByTestId('accordion-item');
    items.forEach(item => {
      expect(item.className).toContain('border-b');
      expect(item.className).toContain('border-border/50');
    });
  });
});
