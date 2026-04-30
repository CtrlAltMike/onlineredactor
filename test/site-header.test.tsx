import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from '@/components/site-header';

describe('SiteHeader', () => {
  it('renders the brand name linking to home', () => {
    render(<SiteHeader />);
    const brand = screen.getByRole('link', { name: /onlineredactor/i });
    expect(brand).toHaveAttribute('href', '/');
  });

  it('links to pricing, account, security, and privacy', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /pricing/i })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: /security/i })).toHaveAttribute('href', '/security');
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });
});
