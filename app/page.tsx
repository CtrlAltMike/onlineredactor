import Link from 'next/link';

const bullets = [
  {
    title: 'Files stay in your browser',
    body: 'Your PDFs never leave your browser. All processing happens client-side.',
  },
  {
    title: 'Verification gates',
    body:
      'Supported PDFs are re-opened before download to check selected extractable text, redaction regions, and stripped metadata.',
  },
  {
    title: 'Works logged-out',
    body: 'No signup required for the free tier. Drop a file, redact, download.',
  },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
      <section className="max-w-2xl">
        <h1 className="text-5xl font-semibold tracking-tight leading-[1.1]">
          A browser PDF redactor with verification gates.
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Redact sensitive text in your browser. For supported PDFs, exports
          are checked for selected text leaks and stripped document metadata
          before download.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/app"
            className="rounded-md bg-black text-white px-5 py-3 text-sm font-medium"
          >
            Try now — no signup
          </Link>
          <Link href="/pricing" className="text-sm underline underline-offset-4">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mt-24 grid md:grid-cols-3 gap-8">
        {bullets.map((b) => (
          <div key={b.title}>
            <h3 className="font-medium">{b.title}</h3>
            <p className="mt-2 text-sm text-neutral-600">{b.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-20 border-t border-neutral-200 pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Built for verifiable redaction
        </h2>
        <div className="mt-5 grid gap-4 text-sm text-neutral-700 md:grid-cols-3">
          <Link href="/how-it-works" className="underline underline-offset-4">
            How the redaction pipeline works
          </Link>
          <Link href="/security" className="underline underline-offset-4">
            Security model and current limits
          </Link>
          <Link
            href="/redact-ssn-from-pdf"
            className="underline underline-offset-4"
          >
            Redact SSNs from PDFs
          </Link>
        </div>
      </section>
    </main>
  );
}
