import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LicensePage from '@/app/legal/license/page';

describe('License page', () => {
  it('renders the h1 and embeds the canonical AGPL header', () => {
    render(<LicensePage />);
    expect(screen.getByRole('heading', { level: 1, name: /license/i })).toBeInTheDocument();
    expect(screen.getByText(/GNU AFFERO GENERAL PUBLIC LICENSE/)).toBeInTheDocument();
  });
});
