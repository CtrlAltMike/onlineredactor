import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'Redact SSN from PDF — OnlineRedactor',
  description:
    'Find and redact Social Security numbers from PDFs with browser-only processing and verified export.',
};

export default function RedactSsnFromPdfPage() {
  return (
    <UseCasePage
      title="Redact SSN from PDF"
      intro="Use search or auto-detect to mark Social Security numbers, then export only after the output passes verification."
      steps={[
        'Load the PDF locally in your browser.',
        'Search for the SSN or use auto-detect to mark common sensitive patterns.',
        'Download the redacted PDF after verification confirms the selected text is gone.',
      ]}
      notes={[
        'Verification checks full and partial text fragments.',
        'Manual boxes are also checked for text left inside the redaction region.',
        'The certificate avoids including the SSN or filename.',
      ]}
    />
  );
}
