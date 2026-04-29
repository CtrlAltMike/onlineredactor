import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedactorClient } from '@/app/app/redactor-client';

const mocks = vi.hoisted(() => ({
  loadPdfFromFile: vi.fn(),
  startRenderPage: vi.fn(),
  extractPageTextItems: vi.fn(),
  findTextRegions: vi.fn(),
  detectSensitiveTextRegions: vi.fn(),
  coveredTextForRegions: vi.fn(),
}));

// `lib/pdf/render` imports pdfjs-dist, which touches DOMMatrix at module-eval
// time and fails under jsdom. Mock it so component tests can focus on UI state.
vi.mock('@/lib/pdf/render', () => ({
  loadPdfFromFile: mocks.loadPdfFromFile,
  startRenderPage: mocks.startRenderPage,
  renderPageToCanvas: vi.fn(),
}));

vi.mock('@/lib/pdf/text', () => ({
  extractPageTextItems: mocks.extractPageTextItems,
  findTextRegions: mocks.findTextRegions,
  detectSensitiveTextRegions: mocks.detectSensitiveTextRegions,
  coveredTextForRegions: mocks.coveredTextForRegions,
}));

describe('RedactorClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fakePage = { view: [0, 0, 612, 792] };
    mocks.loadPdfFromFile.mockResolvedValue({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(fakePage),
      destroy: vi.fn(),
    });
    mocks.startRenderPage.mockReturnValue({
      done: Promise.resolve({ viewportWidth: 918, viewportHeight: 1188 }),
      cancel: vi.fn(),
    });
    mocks.extractPageTextItems.mockResolvedValue([
      { page: 0, text: 'SSN: 123-45-6789', x0: 72, y0: 694, x1: 180, y1: 714 },
    ]);
    mocks.findTextRegions.mockReturnValue([
      { page: 0, text: '123-45-6789', x: 100, y: 694, width: 80, height: 20 },
    ]);
    mocks.detectSensitiveTextRegions.mockReturnValue([
      { page: 0, text: '123-45-6789', x: 100, y: 694, width: 80, height: 20 },
    ]);
    mocks.coveredTextForRegions.mockReturnValue(['123-45-6789']);
  });

  it('shows a drop zone when no file is loaded', () => {
    render(<RedactorClient />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });

  it('adds search matches as redaction targets', async () => {
    const user = userEvent.setup();
    render(<RedactorClient />);

    await user.upload(
      screen.getByLabelText(/pdf file/i),
      new File(['pdf'], 'sample.pdf', { type: 'application/pdf' })
    );

    await screen.findByText(/loaded: sample\.pdf/i);
    await user.type(screen.getByLabelText(/find text/i), '123-45-6789');
    await user.click(screen.getByRole('button', { name: /mark matches/i }));

    expect(mocks.findTextRegions).toHaveBeenCalledWith(
      expect.any(Array),
      '123-45-6789'
    );
    expect(screen.getByText(/added 1 search target/i)).toBeInTheDocument();
    expect(screen.getByText(/1 target selected/i)).toBeInTheDocument();
  });
});
