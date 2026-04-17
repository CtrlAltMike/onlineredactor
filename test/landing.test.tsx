import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/app/page';

describe('Landing page', () => {
  it('shows the headline', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 1, name: /proves your redactions worked/i })
    ).toBeInTheDocument();
  });

  it('has a primary CTA linking to /app', () => {
    render(<Home />);
    const cta = screen.getByRole('link', { name: /try now/i });
    expect(cta).toHaveAttribute('href', '/app');
  });

  it('advertises works-logged-out', () => {
    render(<Home />);
    expect(screen.getByText(/works logged-out/i)).toBeInTheDocument();
  });

  it('advertises files-stay-in-browser', () => {
    render(<Home />);
    expect(screen.getAllByText(/never leave your browser/i).length).toBeGreaterThan(0);
  });
});
