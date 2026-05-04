import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from '@/app/privacy/page';

describe('Privacy page', () => {
  it('states files never leave the browser', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/never leave your browser/i)).toBeInTheDocument();
  });

  it('lists the database schema verbatim', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/stripe_customer_id/i)).toBeInTheDocument();
    expect(screen.getByText(/auth_tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/client_events/i)).toBeInTheDocument();
  });

  it('enumerates what is never stored', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/never sent to or stored/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF bytes/i)).toBeInTheDocument();
    expect(screen.getByText(/saved rules may contain text/i)).toBeInTheDocument();
  });
});
