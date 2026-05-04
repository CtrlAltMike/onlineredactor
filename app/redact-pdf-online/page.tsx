import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'Redact PDF online — OnlineRedactor',
  description:
    'Redact supported PDFs online in your browser with export checks and no file upload to the app server.',
};

export default function RedactPdfOnlinePage() {
  return (
    <UseCasePage
      title="Redact PDF online"
      intro="Open a supported PDF, mark sensitive text, and download a checked redacted copy without sending the document to OnlineRedactor servers."
      steps={[
        'Upload a PDF into the browser-based redactor.',
        'Draw redaction boxes, search for exact text, or run auto-detect.',
        'Export only after the redacted output is re-opened and checked.',
      ]}
      notes={[
        'Works best for PDFs with extractable text.',
        'Image-only scans are blocked until OCR redaction ships.',
        'Verification certificates are generated locally after successful export.',
        'Documents with annotations, forms, scripts, attachments, or image-only pages are blocked in V1.',
      ]}
    />
  );
}
