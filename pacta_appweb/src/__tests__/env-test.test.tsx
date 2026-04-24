import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';

function Simple() {
  const [x] = useState(1);
  return <div>{x}</div>;
}

describe('Simple', () => {
  it('renders', () => {
    render(<Simple />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
