import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FreePdfRedactorPage from '@/app/free-pdf-redactor/page';
import HipaaPdfRedactionPage from '@/app/hipaa-pdf-redaction/page';
import HowItWorksPage from '@/app/how-it-works/page';
import RedactBankStatementPage from '@/app/redact-bank-statement/page';
import RedactPdfOnlinePage from '@/app/redact-pdf-online/page';
import RedactSsnFromPdfPage from '@/app/redact-ssn-from-pdf/page';
import SecurityPage from '@/app/security/page';

describe('static trust and SEO pages', () => {
  it('renders the security page with current limits', () => {
    render(<SecurityPage />);
    expect(screen.getByRole('heading', { name: /security model/i })).toBeInTheDocument();
    expect(screen.getByText(/document javascript/i)).toBeInTheDocument();
  });

  it('renders how-it-works with the verification step', () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /verify/i })).toBeInTheDocument();
  });

  it('renders launch SEO use-case pages', () => {
    render(<RedactPdfOnlinePage />);
    expect(screen.getByRole('heading', { name: /redact pdf online/i })).toBeInTheDocument();

    render(<RedactSsnFromPdfPage />);
    expect(screen.getByRole('heading', { name: /redact ssn from pdf/i })).toBeInTheDocument();

    render(<FreePdfRedactorPage />);
    expect(screen.getByRole('heading', { name: /free pdf redactor/i })).toBeInTheDocument();

    render(<HipaaPdfRedactionPage />);
    expect(screen.getByRole('heading', { name: /hipaa pdf redaction/i })).toBeInTheDocument();

    render(<RedactBankStatementPage />);
    expect(screen.getByRole('heading', { name: /redact bank statement/i })).toBeInTheDocument();
  });
});
