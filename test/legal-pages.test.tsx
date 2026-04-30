import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DpaPage from '@/app/legal/dpa/page';
import TermsPage from '@/app/legal/terms/page';

describe('legal pages', () => {
  it('renders Phase 1 terms', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByText(/no paid service/i)).toBeInTheDocument();
  });

  it('renders the DPA posture page', () => {
    render(<DpaPage />);
    expect(screen.getByRole('heading', { name: /data processing/i })).toBeInTheDocument();
    expect(screen.getByText(/does not currently offer a signed dpa/i)).toBeInTheDocument();
    expect(screen.getByText(/content-free usage metadata/i)).toBeInTheDocument();
  });
});
