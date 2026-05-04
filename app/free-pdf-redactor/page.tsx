import { UseCasePage } from '@/components/use-case-page';

export const metadata = {
  title: 'Free PDF redactor — OnlineRedactor',
  description:
    'Use a free browser-based PDF redactor for supported PDFs with export checks and public AGPL source code.',
};

export default function FreePdfRedactorPage() {
  return (
    <UseCasePage
      title="Free PDF redactor"
      intro="OnlineRedactor currently runs as a free AGPL-compliant browser tool while paid checkout remains paused."
      steps={[
        'Open the redactor without creating an account.',
        'Mark sensitive content with manual, search, or auto-detect tools.',
        'Download a checked PDF and a watermarked local certificate.',
      ]}
      notes={[
        'The deployed source is public for AGPL compliance.',
        'Paid Prosumer checkout is paused during the licensing and safety review.',
        'Unsupported PDF structures are blocked instead of exported unchecked.',
      ]}
    />
  );
}
