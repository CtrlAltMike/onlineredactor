import Link from 'next/link';

export const metadata = {
  title: 'Security — OnlineRedactor',
  description:
    'How OnlineRedactor keeps PDF redaction client-side, verifies exports, and blocks unsupported PDF structures.',
};

const guarantees = [
  'PDF bytes are loaded, rendered, redacted, and verified in the browser.',
  'Redaction uses MuPDF content-stream redaction, not cosmetic black rectangles.',
  'Exports are re-opened and checked for leaked text fragments and text remaining inside redaction regions.',
  'Scanned-only PDFs, fillable forms, document JavaScript, embedded attachments, and unsupported annotations are blocked before export.',
];

const limits = [
  'OCR redaction for scanned PDFs is not part of V1.',
  'Password-protected PDFs are blocked until a verified password workflow is added.',
  'Payment is paused while the AGPL public-source path remains the active licensing route.',
];

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          Security model
        </h1>
        <p className="mt-5 text-lg text-neutral-600">
          OnlineRedactor is designed around a narrow promise: redact PDFs in the
          browser, prove the selected extractable text was removed, and refuse
          PDFs that cannot be verified safely yet.
        </p>
      </section>

      <section className="mt-14 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Current guarantees</h2>
          <ul className="mt-5 space-y-4 text-sm text-neutral-700">
            {guarantees.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Current limits</h2>
          <ul className="mt-5 space-y-4 text-sm text-neutral-700">
            {limits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-14 border-t border-neutral-200 pt-8">
        <h2 className="text-xl font-semibold">Source and licensing</h2>
        <p className="mt-4 max-w-3xl text-sm text-neutral-700">
          This deployment uses the AGPL-licensed MuPDF route. The corresponding
          source is public on GitHub, and paid checkout remains paused unless a
          commercial MuPDF license is purchased or the AGPL source-availability
          path remains the chosen business model.
        </p>
        <Link
          href="/legal/license"
          className="mt-5 inline-block text-sm underline underline-offset-4"
        >
          Read license details
        </Link>
      </section>
    </main>
  );
}
