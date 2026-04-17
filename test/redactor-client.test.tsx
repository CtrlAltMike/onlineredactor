import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RedactorClient } from '@/app/app/redactor-client';

// `lib/pdf/render` imports pdfjs-dist, which touches DOMMatrix at module-eval
// time and fails under jsdom. This test only exercises the idle drop zone, so
// mock the module to bypass the pdfjs-dist import.
vi.mock('@/lib/pdf/render', () => ({
  loadPdfFromFile: vi.fn(),
  renderPageToCanvas: vi.fn(),
}));

describe('RedactorClient', () => {
  it('shows a drop zone when no file is loaded', () => {
    render(<RedactorClient />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });
});
