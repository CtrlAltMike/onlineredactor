import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RedactorClient } from '@/app/app/redactor-client';

describe('RedactorClient', () => {
  it('shows a drop zone when no file is loaded', () => {
    render(<RedactorClient />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });
});
