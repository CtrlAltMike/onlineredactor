import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UpgradePage from '@/app/upgrade/page';

describe('Upgrade page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains paid checkout is paused', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Not signed in.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    render(<UpgradePage />);
    expect(screen.getByRole('heading', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.getByText(/paid checkout is paused/i)).toBeInTheDocument();
    expect(screen.getByText(/local 3-redaction daily cap/i)).toBeInTheDocument();
    expect(screen.getByText(/saved local rules/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /stripe/i })).not.toBeInTheDocument();
  });
});
