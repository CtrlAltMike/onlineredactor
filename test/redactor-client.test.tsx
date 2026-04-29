import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedactorClient } from '@/app/app/redactor-client';
import { MAX_PDF_FILE_BYTES } from '@/lib/pdf/limits';
import { FREE_USAGE_STORAGE_KEY } from '@/lib/usage/free-tier';

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
    window.localStorage.clear();
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

  it('saves and applies local text rules', async () => {
    const user = userEvent.setup();
    render(<RedactorClient />);

    await user.upload(
      screen.getByLabelText(/pdf file/i),
      new File(['pdf'], 'sample.pdf', { type: 'application/pdf' })
    );

    await screen.findByText(/loaded: sample\.pdf/i);
    await user.type(screen.getByLabelText(/find text/i), '123-45-6789');
    await user.click(screen.getByRole('button', { name: /save rule/i }));
    expect(screen.getAllByText('123-45-6789').length).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(mocks.findTextRegions).toHaveBeenCalledWith(
      expect.any(Array),
      '123-45-6789'
    );
    expect(screen.getByText(/1 target selected/i)).toBeInTheDocument();
  });

  it('disables export when the local free cap is reached', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      FREE_USAGE_STORAGE_KEY,
      JSON.stringify({ date: localDateKey(new Date()), count: 3 })
    );
    render(<RedactorClient />);

    await user.upload(
      screen.getByLabelText(/pdf file/i),
      new File(['pdf'], 'sample.pdf', { type: 'application/pdf' })
    );

    await screen.findByText(/free redactions today: 3\/3/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/exports are paused/i);
    expect(screen.getByRole('button', { name: /redact/i })).toBeDisabled();
  });

  it('blocks PDFs above the Phase 1 size limit before loading', async () => {
    const user = userEvent.setup();
    const file = new File(['pdf'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: MAX_PDF_FILE_BYTES + 1 });
    render(<RedactorClient />);

    await user.upload(screen.getByLabelText(/pdf file/i), file);

    expect(screen.getByRole('alert')).toHaveTextContent(/phase 1 browser limit/i);
    expect(mocks.loadPdfFromFile).not.toHaveBeenCalled();
  });
});

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
