import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from '@/components/site-footer';

describe('SiteFooter', () => {
  it('shows the trust-story tagline', () => {
    render(<SiteFooter />);
    expect(
      screen.getByText(/your files never leave your browser/i)
    ).toBeInTheDocument();
  });

  it('shows the current year in the copyright line', () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year} OnlineRedactor`))).toBeInTheDocument();
  });
});
