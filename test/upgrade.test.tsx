import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UpgradePage from '@/app/upgrade/page';

describe('Upgrade page', () => {
  it('explains Stripe-hosted checkout', () => {
    render(<UpgradePage />);
    expect(screen.getByRole('heading', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.getByText(/handled by Stripe/i)).toBeInTheDocument();
  });
});
