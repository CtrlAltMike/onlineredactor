import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UpgradePage from '@/app/upgrade/page';

describe('Upgrade page', () => {
  it('explains paid checkout is paused', () => {
    render(<UpgradePage />);
    expect(screen.getByRole('heading', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.getByText(/paid checkout is paused/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /stripe/i })).not.toBeInTheDocument();
  });
});
