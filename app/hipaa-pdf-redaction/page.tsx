import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'HIPAA PDF redaction — OnlineRedactor',
  description:
    'Redact health information from supported PDFs in your browser with export checks and no document upload to OnlineRedactor servers.',
};

export default function HipaaPdfRedactionPage() {
  return (
    <UseCasePage
      title="HIPAA PDF redaction"
      intro="Redact patient identifiers and other sensitive health information locally in your browser before sharing a supported PDF."
      steps={[
        'Open the PDF in the browser-only redactor.',
        'Use search, auto-detect, or manual boxes to mark patient identifiers.',
        'Export only after verification checks that the selected extractable text is gone.',
      ]}
      notes={[
        'OnlineRedactor does not receive PDF bytes or redacted text.',
        'Scanned documents are blocked until OCR redaction is available.',
        'PDFs with annotations, forms, scripts, or attachments are blocked in V1.',
        'A BAA is not offered in Phase 1; enterprise compliance support is deferred.',
      ]}
    />
  );
}
