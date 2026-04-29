import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'Redact PDF online — OnlineRedactor',
  description:
    'Redact a PDF online in your browser with verified export and no file upload to the app server.',
};

export default function RedactPdfOnlinePage() {
  return (
    <UseCasePage
      title="Redact PDF online"
      intro="Open a PDF, mark sensitive text, and download a verified redacted copy without sending the document to OnlineRedactor servers."
      steps={[
        'Upload a PDF into the browser-based redactor.',
        'Draw redaction boxes, search for exact text, or run auto-detect.',
        'Export only after the redacted output is re-opened and verified.',
      ]}
      notes={[
        'Works best for PDFs with extractable text.',
        'Image-only scans are blocked until OCR redaction ships.',
        'Verification certificates are generated locally after successful export.',
      ]}
    />
  );
}
