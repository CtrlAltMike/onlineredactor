import Link from 'next/link';

export const metadata = {
  title: 'How OnlineRedactor works',
  description:
    'A plain-English walkthrough of browser-only PDF redaction, verification, and certificate generation.',
};

const steps = [
  {
    title: 'Load',
    body: 'PDF.js opens the PDF in your browser and renders each page to a canvas.',
  },
  {
    title: 'Mark',
    body: 'You can draw boxes manually, search for exact text, or auto-detect common sensitive patterns.',
  },
  {
    title: 'Apply',
    body: 'MuPDF applies true redactions that remove intersecting text instead of merely covering it.',
  },
  {
    title: 'Verify',
    body: 'The redacted output is opened again and checked for selected text fragments, text left inside redacted regions, and stripped document metadata.',
  },
  {
    title: 'Export',
    body: 'Supported outputs that pass those checks are downloaded with a local certificate containing timestamp, page count, region count, and output hash.',
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          How it works
        </h1>
        <p className="mt-5 text-lg text-neutral-600">
          The tool keeps document processing local to your browser and treats
          verification as part of the export, not an afterthought.
        </p>
      </section>

      <section className="mt-14 space-y-8">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="grid gap-3 border-t border-neutral-200 pt-6 md:grid-cols-[120px_1fr]"
          >
            <p className="text-sm font-medium text-neutral-500">
              Step {index + 1}
            </p>
            <div>
              <h2 className="text-xl font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-neutral-700">{step.body}</p>
            </div>
          </div>
        ))}
      </section>

      <Link
        href="/app"
        className="mt-12 inline-block rounded-md bg-black px-5 py-3 text-sm font-medium text-white"
      >
        Open redactor
      </Link>
    </main>
  );
}
