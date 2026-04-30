import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountPage from '@/app/account/page';

describe('AccountPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the sign-in form when the visitor is signed out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Not signed in.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    render(<AccountPage />);

    expect(
      await screen.findByRole('button', { name: /send sign-in link/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF bytes, filenames/i)).toBeInTheDocument();
  });
});
