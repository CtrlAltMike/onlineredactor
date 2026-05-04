import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'Redact SSN from PDF — OnlineRedactor',
  description:
    'Find and redact Social Security numbers from supported PDFs with browser-only processing and export checks.',
};

export default function RedactSsnFromPdfPage() {
  return (
    <UseCasePage
      title="Redact SSN from PDF"
      intro="Use search or auto-detect to mark Social Security numbers in supported PDFs, then export only after the output passes checks."
      steps={[
        'Load the PDF locally in your browser.',
        'Search for the SSN or use auto-detect to mark common sensitive patterns.',
        'Download the redacted PDF after verification checks that the selected text is gone.',
      ]}
      notes={[
        'Verification checks full and partial text fragments.',
        'Manual boxes are also checked for text left inside the redaction region.',
        'Document metadata is stripped from the exported PDF.',
        'The certificate avoids including the SSN or filename.',
      ]}
    />
  );
}
