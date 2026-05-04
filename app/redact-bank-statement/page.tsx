import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'Redact bank statement — OnlineRedactor',
  description:
    'Redact account numbers and personal details from supported PDF bank statements with browser-only processing and export checks.',
};

export default function RedactBankStatementPage() {
  return (
    <UseCasePage
      title="Redact bank statement"
      intro="Remove account numbers, addresses, and transaction notes from a supported PDF bank statement without uploading the document to the app server."
      steps={[
        'Load the statement in your browser.',
        'Search for account numbers or draw boxes over sensitive transaction details.',
        'Download only after the redacted PDF passes verification checks.',
      ]}
      notes={[
        'Verification checks extractable text fragments and redaction regions.',
        'Document metadata is stripped from the exported PDF.',
        'The certificate includes the output hash, not your account number or filename.',
        'Image-only scans are blocked until OCR support is added.',
      ]}
    />
  );
}
