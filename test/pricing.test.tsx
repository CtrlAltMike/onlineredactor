import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PricingPage from '@/app/pricing/page';

describe('Pricing page', () => {
  it('shows three tiers', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { name: /consumer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /prosumer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /enterprise/i })).toBeInTheDocument();
  });

  it('shows the consumer cap honesty line', () => {
    render(<PricingPage />);
    expect(screen.getByText(/honor system/i)).toBeInTheDocument();
  });

  it('shows Enterprise as contact-us', () => {
    render(<PricingPage />);
    expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
  });
});
