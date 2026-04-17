import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PdfPageCanvas } from '@/components/pdf-page-canvas';

vi.mock('@/lib/pdf/render', () => ({
  // Component now uses startRenderPage (cancellable) so it can abort on
  // StrictMode re-mounts. Tests don't exercise cancel — just return a done
  // promise and a no-op cancel.
  startRenderPage: vi.fn(() => ({
    done: Promise.resolve({ viewportWidth: 600, viewportHeight: 800 }),
    cancel: () => {},
  })),
}));

describe('PdfPageCanvas', () => {
  it('renders a canvas element with aria-label for the page', async () => {
    const fakePage = {} as any;
    render(<PdfPageCanvas page={fakePage} pageIndex={0} />);
    const canvas = await screen.findByLabelText(/page 1/i);
    expect(canvas.tagName).toBe('CANVAS');
  });
});
